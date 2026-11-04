import { Pencil, Plus, Receipt, Search, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import { api, qs } from '../api'
import AnomalyAlerts from '../components/AnomalyAlerts'
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
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)

  const [anomalies, setAnomalies] = useState(null)

  useEffect(() => {
    api.get('/api/meta').then(setMeta).catch(() => {})
  }, [])

  // Over the whole history, not the filtered page: what counts as unusual is
  // learned from everything the user has recorded. Deliberately a separate
  // request from the table, so a failed detector cannot blank the list of
  // transactions -- the table is the page's job, the alerts are a bonus.
  const loadAnomalies = useCallback(() => {
    api.post('/api/ai/detect-anomalies', { month: null })
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

  // Debounced so typing in the search box does not fire a request per keystroke.
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

  /** A write changes what is typical, so the alerts are recomputed too. */
  function afterWrite() {
    load(filters)
    loadAnomalies()
  }

  const totals = data?.totals

  return (
    <>
      <PageHeader
        title="Transactions"
        subtitle="Every income and expense entry"
        action={
          <Button onClick={() => setAdding(true)}>
            <Plus size={16} />
            Add transaction
          </Button>
        }
      />

      {/* Totals reflect the whole filtered set, not just the visible page. */}
      {totals && (
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SummaryTile label="Income" value={totals.income} tone="text-pos" />
          <SummaryTile label="Expenses" value={totals.expense} tone="text-neg" />
          <SummaryTile
            label="Net"
            value={totals.net}
            tone={totals.net >= 0 ? 'text-pos' : 'text-neg'}
          />
          <SummaryTile label="Entries" value={data.total} raw />
        </div>
      )}

      {anomalies?.anomalies?.length > 0 && (
        <div className="mb-5">
          <AnomalyAlerts anomalies={anomalies.anomalies} note={anomalies.note} />
        </div>
      )}

      <Card className="mb-5 p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <div className="relative lg:col-span-2">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <Input
              className="pl-9"
              placeholder="Search description or notes…"
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
            <option value="income">Income</option>
            <option value="expense">Expense</option>
          </Select>

          {/* min-w-0 on both the wrapper and the inputs: a flex item defaults
              to min-width:auto, and Chrome's date input has a wide intrinsic
              size, so without this the pair refuses to shrink and overflows. */}
          <div className="flex min-w-0 gap-2 lg:col-span-2">
            <Input
              type="date"
              className="min-w-0"
              value={filters.start_date}
              onChange={setFilter('start_date')}
              aria-label="From date"
            />
            <Input
              type="date"
              className="min-w-0"
              value={filters.end_date}
              onChange={setFilter('end_date')}
              aria-label="To date"
            />
          </div>
        </div>

        {hasFilters && (
          <button
            onClick={() => setFilters(BLANK_FILTERS)}
            className="mt-3 inline-flex items-center gap-1 text-xs text-brand-400 hover:underline"
          >
            <X size={13} />
            Clear filters
          </button>
        )}
      </Card>

      <Card>
        {loading && !data ? (
          <Spinner label="Loading transactions" />
        ) : error ? (
          <ErrorState error={error} onRetry={() => load(filters)} />
        ) : data?.transactions.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title={hasFilters ? 'No matching transactions' : 'No transactions yet'}
            body={
              hasFilters
                ? 'Try widening or clearing your filters.'
                : 'Add your first income or expense to start building your financial picture.'
            }
            action={
              hasFilters ? (
                <Button variant="secondary" size="sm" onClick={() => setFilters(BLANK_FILTERS)}>
                  Clear filters
                </Button>
              ) : (
                <Button size="sm" onClick={() => setAdding(true)}>
                  <Plus size={15} />
                  Add transaction
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
        <p className="mt-3 text-center text-xs muted">
          Showing {data.transactions.length} of {data.total}. Narrow your filters to see the rest.
        </p>
      )}

      <Modal open={adding} onClose={() => setAdding(false)} title="Add transaction">
        <TransactionForm
          meta={meta}
          onSaved={() => {
            setAdding(false)
            afterWrite()
          }}
          onCancel={() => setAdding(false)}
        />
      </Modal>

      <Modal open={Boolean(editing)} onClose={() => setEditing(null)} title="Edit transaction">
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
        title="Delete transaction?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={confirmDelete}>
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-600 dark:text-ink-400">
          {deleting?.description} — {moneyExact(deleting?.amount)}. This cannot be undone.
        </p>
      </Modal>
    </>
  )
}

function SummaryTile({ label, value, tone = '', raw = false }) {
  return (
    <Card className="px-4 py-3">
      <p className="text-[11px] uppercase tracking-wide muted">{label}</p>
      <p className={`mt-1 text-lg font-semibold tnum ${tone}`}>{raw ? value : money(value)}</p>
    </Card>
  )
}

function TransactionTable({ rows, onEdit, onDelete }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-ink-200 text-left text-[11px] uppercase tracking-wide muted dark:border-ink-800">
            <th className="px-4 py-2.5 font-medium">Date</th>
            <th className="px-4 py-2.5 font-medium">Description</th>
            <th className="px-4 py-2.5 font-medium">Category</th>
            <th className="hidden px-4 py-2.5 font-medium sm:table-cell">Method</th>
            <th className="px-4 py-2.5 text-right font-medium">Amount</th>
            <th className="px-4 py-2.5" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className="group border-b border-ink-100 last:border-0 hover:bg-ink-50 dark:border-ink-800/60 dark:hover:bg-ink-800/40"
            >
              <td className="whitespace-nowrap px-4 py-3 text-xs muted tnum">
                {shortDate(row.date)}
              </td>
              <td className="max-w-[18rem] px-4 py-3">
                <p className="truncate font-medium">{row.description}</p>
                {row.notes && <p className="truncate text-xs muted">{row.notes}</p>}
              </td>
              <td className="px-4 py-3">
                <Badge tone={row.txn_type === 'income' ? 'positive' : 'neutral'}>
                  {row.category}
                </Badge>
              </td>
              <td className="hidden whitespace-nowrap px-4 py-3 text-xs muted sm:table-cell">
                {row.payment_method || '—'}
              </td>
              <td
                className={`whitespace-nowrap px-4 py-3 text-right font-semibold tnum ${
                  row.txn_type === 'income' ? 'text-pos' : 'text-ink-800 dark:text-ink-100'
                }`}
              >
                {row.txn_type === 'income' ? '+' : '−'}
                {/* Exact to the paise on an individual row. Rounding is fine
                    for the aggregate tiles, but a row that reads 350 when the
                    user entered 349.50 looks like a bug in a finance app. */}
                {moneyExact(row.amount)}
              </td>
              <td className="whitespace-nowrap px-2 py-3 text-right">
                <div className="flex justify-end gap-0.5 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
                  <button
                    onClick={() => onEdit(row)}
                    aria-label={`Edit ${row.description}`}
                    className="rounded p-1.5 muted hover:bg-ink-200 hover:text-ink-800 dark:hover:bg-ink-700 dark:hover:text-ink-100"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => onDelete(row)}
                    aria-label={`Delete ${row.description}`}
                    className="rounded p-1.5 muted hover:bg-neg/10 hover:text-neg"
                  >
                    <Trash2 size={14} />
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
