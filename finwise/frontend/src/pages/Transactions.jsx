import { Pencil, Plus, Receipt, Search, Trash2, Upload, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import { api, qs } from '../api'
import AnomalyAlerts from '../components/AnomalyAlerts'
import CsvImporterModal from '../components/CsvImporterModal'
import TransactionForm from '../components/TransactionForm'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  Modal,
  PageHeader,
  Select,
  Spinner,
} from '../components/ui'
import { money, moneyExact, shortDate } from '../format'

const BLANK_FILTERS = {
  search: '',
  category: '',
  txn_type: '',
  start_date: '',
  end_date: '',
}

export default function Transactions() {
  const [meta, setMeta] = useState(null)
  const [filters, setFilters] = useState(BLANK_FILTERS)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [adding, setAdding] = useState(false)
  const [importing, setImporting] = useState(false)
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)

  const [anomalies, setAnomalies] = useState(null)

  useEffect(() => {
    api.get('/api/meta').then(setMeta).catch(() => {})
  }, [])

  const loadAnomalies = useCallback(() => {
    api
      .post('/api/ai/detect-anomalies', { month: null })
      .then(setAnomalies)
      .catch(() => setAnomalies(null))
  }, [])

  useEffect(() => {
    loadAnomalies()
  }, [loadAnomalies])

  const load = useCallback(async (activeFilters) => {
    setLoading(true)
    setError(null)
    try {
      setData(await api.get(`/api/transactions${qs({ ...activeFilters, limit: 200 })}`))
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => load(filters), 250)
    return () => clearTimeout(timer)
  }, [filters, load])

  const setFilter = (key) => (event) => setFilters((f) => ({ ...f, [key]: event.target.value }))
  const hasFilters = Object.values(filters).some(Boolean)

  async function confirmDelete() {
    await api.del(`/api/transactions/${deleting.id}`)
    setDeleting(null)
    afterWrite()
  }

  function afterWrite() {
    load(filters)
    loadAnomalies()
  }

  const totals = data?.totals

  return (
    <>
      <PageHeader
        title="Transaction Ledger"
        subtitle="Chronological record of all inflows and outflows"
        action={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="lg" onClick={() => setImporting(true)}>
              <Upload size={14} />
              Import statement
            </Button>
            <Button size="lg" onClick={() => setAdding(true)}>
              <Plus size={14} />
              Record entry
            </Button>
          </div>
        }
      />

      {totals && (
        <section className="mb-5 card overflow-hidden grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 divide-x divide-slate-200/80 dark:divide-slate-800/80">
          <SummaryCell label="Filtered Inflows" value={totals.income} dot="bg-pos" />
          <SummaryCell label="Filtered Outflows" value={totals.expense} dot="bg-ink-400" />
          <SummaryCell
            label="Net Balance"
            value={totals.net}
            prefix={totals.net < 0 ? '−' : '+'}
          />
          <SummaryCell label="Matching Entries" value={data.total} raw />
        </section>
      )}

      {anomalies?.anomalies?.length > 0 && (
        <div className="mb-5">
          <AnomalyAlerts anomalies={anomalies.anomalies} note={anomalies.note} />
        </div>
      )}

      {/* Unified Filter Toolbar + Accounting Table Sheet */}
      <Card className="overflow-hidden">
        <div className="border-b border-slate-200/80 bg-slate-50/70 p-3.5 dark:border-slate-800/80 dark:bg-slate-900/40">
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-6">
            <div className="relative lg:col-span-2">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
              <Input
                className="pl-8"
                placeholder="Filter description or notes…"
                value={filters.search}
                onChange={setFilter('search')}
                aria-label="Search transactions"
              />
            </div>

            <Select value={filters.category} onChange={setFilter('category')} aria-label="Category">
              <option value="">All categories</option>
              {(meta?.categories ?? []).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>

            <Select value={filters.txn_type} onChange={setFilter('txn_type')} aria-label="Type">
              <option value="">All types</option>
              <option value="income">Inflow (Income)</option>
              <option value="expense">Outflow (Expense)</option>
            </Select>

            <div className="flex min-w-0 gap-2 lg:col-span-2">
              <Input
                type="date"
                className="min-w-0 font-mono text-xs"
                value={filters.start_date}
                onChange={setFilter('start_date')}
                aria-label="From date"
              />
              <Input
                type="date"
                className="min-w-0 font-mono text-xs"
                value={filters.end_date}
                onChange={setFilter('end_date')}
                aria-label="To date"
              />
            </div>
          </div>

          {hasFilters && (
            <div className="mt-2.5 flex justify-end">
              <button
                onClick={() => setFilters(BLANK_FILTERS)}
                className="inline-flex items-center gap-1 font-mono text-[11px] font-medium text-ink-700 hover:text-ink-900 dark:text-ink-300 dark:hover:text-white"
              >
                <X size={12} />
                Reset filters
              </button>
            </div>
          )}
        </div>

        {loading && !data ? (
          <Spinner label="Loading ledger entries" />
        ) : error ? (
          <ErrorState error={error} onRetry={() => load(filters)} />
        ) : data?.transactions.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title={hasFilters ? 'No matching ledger entries' : 'No entries recorded'}
            body={
              hasFilters
                ? 'Widen or reset your filter criteria.'
                : 'Record your first inflow or outflow to populate the ledger.'
            }
            action={
              hasFilters ? (
                <Button variant="secondary" size="sm" onClick={() => setFilters(BLANK_FILTERS)}>
                  Reset filters
                </Button>
              ) : (
                <Button size="sm" onClick={() => setAdding(true)}>
                  <Plus size={14} />
                  Record entry
                </Button>
              )
            }
          />
        ) : (
          <TransactionTable
            rows={data.transactions}
            onEdit={setEditing}
            onDelete={setDeleting}
          />
        )}
      </Card>

      {data && data.total > data.transactions.length && (
        <p className="mt-3 text-center font-mono text-[11px] muted">
          Displaying {data.transactions.length} of {data.total} entries. Narrow filters to inspect earlier records.
        </p>
      )}

      <CsvImporterModal
        open={importing}
        onClose={() => setImporting(false)}
        onImported={() => afterWrite()}
      />

      <Modal open={adding} onClose={() => setAdding(false)} title="Record ledger entry">
        <TransactionForm
          meta={meta}
          onSaved={() => {
            setAdding(false)
            afterWrite()
          }}
          onCancel={() => setAdding(false)}
        />
      </Modal>

      <Modal open={Boolean(editing)} onClose={() => setEditing(null)} title="Edit ledger entry">
        <TransactionForm
          meta={meta}
          initial={editing}
          onSaved={() => {
            setEditing(null)
            afterWrite()
          }}
          onCancel={() => setEditing(null)}
        />
      </Modal>

      <Modal
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title="Delete ledger entry?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={confirmDelete}>
              Delete entry
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-700 dark:text-ink-300">
          {deleting?.description} — <span className="font-mono">{moneyExact(deleting?.amount)}</span>. This action permanently removes the entry from your ledger.
        </p>
      </Modal>
    </>
  )
}

function SummaryCell({ label, value, dot, prefix = '', raw = false }) {
  return (
    <div className="px-4 py-3.5 bg-white dark:bg-[#0F1422]">
      <div className="flex items-center gap-1.5 text-xs muted">
        {dot && <span className={`size-1.5 rounded-full ${dot}`} />}
        <span>{label}</span>
      </div>
      <p className="mt-1.5 font-mono text-lg font-semibold text-slate-900 dark:text-white tnum">
        {raw ? value : `${prefix}${money(Math.abs(value))}`}
      </p>
    </div>
  )
}

function TransactionTable({ rows, onEdit, onDelete }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200/80 bg-slate-50/60 text-left font-mono text-[11px] uppercase muted dark:border-slate-800/80 dark:bg-slate-900/40">
            <th className="px-4 py-2.5 font-medium">Date</th>
            <th className="px-4 py-2.5 font-medium">Description</th>
            <th className="px-4 py-2.5 font-medium">Category</th>
            <th className="hidden px-4 py-2.5 font-medium sm:table-cell">Method</th>
            <th className="px-4 py-2.5 text-right font-medium">Amount</th>
            <th className="w-20 px-4 py-2.5" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/60">
          {rows.map((row) => (
            <tr
              key={row.id}
              className="group hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
            >
              <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs muted tnum">
                {shortDate(row.date)}
              </td>
              <td className="max-w-[20rem] px-4 py-2.5">
                <p className="truncate text-xs sm:text-sm font-medium text-slate-900 dark:text-white">
                  {row.description}
                </p>
                {row.notes && <p className="truncate text-xs muted">{row.notes}</p>}
              </td>
              <td className="px-4 py-2.5">
                <Badge tone={row.txn_type === 'income' ? 'positive' : 'neutral'}>
                  {row.category}
                </Badge>
              </td>
              <td className="hidden whitespace-nowrap px-4 py-2.5 font-mono text-xs muted sm:table-cell">
                {row.payment_method || '—'}
              </td>
              <td
                className={`whitespace-nowrap px-4 py-2.5 text-right font-mono text-xs sm:text-sm font-medium tnum ${
                  row.txn_type === 'income'
                    ? 'text-pos dark:text-emerald-400'
                    : 'text-slate-900 dark:text-white'
                }`}
              >
                {row.txn_type === 'income' ? '+' : '−'}
                {moneyExact(row.amount)}
              </td>
              <td className="whitespace-nowrap px-3 py-2.5 text-right">
                <div className="flex justify-end gap-0.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-within:opacity-100">
                  <button
                    onClick={() => onEdit(row)}
                    aria-label={`Edit ${row.description}`}
                    className="rounded p-1 muted hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => onDelete(row)}
                    aria-label={`Delete ${row.description}`}
                    className="rounded p-1 muted hover:bg-rose-100 hover:text-neg dark:hover:bg-rose-950/40"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
