import { Download, FileSpreadsheet, FileText, Info } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import { api, saveBlob } from '../api'
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  EstimateNote,
  PageHeader,
  ProgressBar,
  Select,
  Spinner,
} from '../components/ui'
import { longDate, money, moneyExact, pct, signedPct } from '../format'

export default function Reports() {
  const [month, setMonth] = useState(null)
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [downloading, setDownloading] = useState(null)

  const load = useCallback(async (requested) => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.get(
        `/api/reports/monthly${requested ? `?month=${requested}` : ''}`,
      )
      setReport(data)
      setMonth(data.meta.month)
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(null)
  }, [load])

  async function download(kind) {
    setDownloading(kind)
    try {
      const path =
        kind === 'pdf'
          ? `/api/reports/monthly.pdf?month=${month}`
          : '/api/reports/transactions.csv'
      const { blob, filename } = await api.download(path)
      saveBlob(blob, filename)
    } catch (err) {
      setError(err)
    } finally {
      setDownloading(null)
    }
  }

  if (loading && !report) return <Spinner label="Building your report" />
  if (error && !report) return <ErrorState error={error} onRetry={() => load(month)} />

  const meta = report.meta
  const { totals, previous_totals: previous } = report

  return (
    <>
      <PageHeader
        title="Monthly Statements"
        subtitle="Audit-ready monthly ledger summary and exportable register"
        action={
          <>
            <Select
              value={month ?? ''}
              onChange={(event) => load(event.target.value)}
              aria-label="Report month"
              className="w-auto"
            >
              {meta.available_months.map((option) => (
                <option key={option.month} value={option.month}>
                  {option.label}
                </option>
              ))}
            </Select>
            <Button onClick={() => download('pdf')} loading={downloading === 'pdf'}>
              <FileText size={14} /> Export PDF
            </Button>
            <Button
              variant="secondary"
              onClick={() => download('csv')}
              loading={downloading === 'csv'}
            >
              <FileSpreadsheet size={14} /> Export CSV
            </Button>
          </>
        }
      />

      {meta.is_sample_data && (
        <div className="mb-5 flex items-start gap-2.5 rounded-md border border-ink-200 bg-[#F1EFEA] px-4 py-2.5 text-xs dark:border-[#242422] dark:bg-[#171715]">
          <Info size={14} className="mt-0.5 shrink-0 text-warn" />
          <span>
            <strong className="font-semibold">Sample ledger.</strong> {meta.sample_notice} The exported PDF carries the same notice.
          </span>
        </div>
      )}

      {meta.partial_month && (
        <p className="mb-5 text-xs muted">
          {meta.month_label} is still in progress, so these are month-to-date figures.
        </p>
      )}

      {!report.has_data ? (
        <Card>
          <EmptyState
            icon={FileText}
            title={`No transactions in ${meta.month_label}`}
            body="Choose another month, or add transactions and the report will fill itself in."
          />
        </Card>
      ) : (
        <div className="space-y-6">
          <Card className="overflow-hidden">
            <CardHeader
              title={`Statement summary — ${meta.month_label}`}
              subtitle={
                report.previous_month
                  ? `Compared with ${meta.available_months.find((m) => m.month === report.previous_month)?.label ?? report.previous_month}`
                  : 'No earlier month to compare against'
              }
            />
            <div className="grid divide-y divide-slate-200/80 sm:grid-cols-2 sm:divide-x lg:grid-cols-4 lg:divide-y-0 dark:divide-slate-800/80">
              <SummaryCell label="Gross inflows" value={totals.income} before={previous?.income} />
              <SummaryCell
                label="Total outflows"
                value={totals.expense}
                before={previous?.expense}
                invert
              />
              <SummaryCell label="Net retained" value={totals.savings} before={previous?.savings} />
              <SummaryCell
                label="Retention rate"
                value={totals.savings_rate}
                before={previous?.savings_rate}
                isPercent
              />
            </div>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="overflow-hidden">
              <CardHeader title="Outflow allocation" subtitle={`${totals.transactions} entries`} />
              <div className="space-y-3.5 p-5">
                {report.category_breakdown.length === 0 && (
                  <p className="text-sm muted">No expenses recorded this month.</p>
                )}
                {report.category_breakdown.map((item) => (
                  <div key={item.category}>
                    <div className="flex justify-between text-xs">
                      <span className="font-medium text-slate-900 dark:text-white">{item.category}</span>
                      <span className="font-mono tnum">
                        {moneyExact(item.amount)}{' '}
                        <span className="muted">({item.share}%)</span>
                      </span>
                    </div>
                    <ProgressBar className="mt-1.5" value={item.share} />
                  </div>
                ))}
              </div>
            </Card>

            <Card className="overflow-hidden">
              <CardHeader
                title="Composite health index"
                subtitle={report.health.band}
                action={
                  report.health.provisional ? (
                    <Badge tone="warning">provisional</Badge>
                  ) : null
                }
              />
              <div className="p-5">
                <p className="font-display font-bold text-3xl tracking-tight text-slate-900 dark:text-white tnum">
                  {report.health.score}
                  <span className="font-sans text-base font-normal muted"> / 100</span>
                </p>
                <div className="mt-4 space-y-2 border-t border-slate-200/80 pt-3 dark:border-slate-800/80">
                  {report.health.components.map((component) => (
                    <div key={component.key} className="flex justify-between text-xs">
                      <span className="muted">{component.label}</span>
                      <span className="font-mono text-slate-900 dark:text-white tnum">
                        {component.points.toFixed(1)} / {component.max_points}
                      </span>
                    </div>
                  ))}
                </div>
                <EstimateNote>{report.health.disclaimer}</EstimateNote>
              </div>
            </Card>
          </div>

          {report.comparison.length > 0 && (
            <Card className="overflow-hidden">
              <CardHeader
                title="Month-on-month movement"
                subtitle={
                  meta.partial_month
                    ? 'Both months truncated to the same elapsed day'
                    : 'Sorted by largest variance'
                }
              />
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-slate-200/80 bg-slate-50/60 text-xs muted dark:border-slate-800/80 dark:bg-slate-900/40">
                    <tr>
                      <th className="px-5 py-2.5 text-left font-medium">Category</th>
                      <th className="px-5 py-2.5 text-right font-medium">This month</th>
                      <th className="px-5 py-2.5 text-right font-medium">Previous</th>
                      <th className="px-5 py-2.5 text-right font-medium">Variance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/60">
                    {report.comparison.slice(0, 8).map((row) => (
                      <tr key={row.category} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="px-5 py-2.5 font-medium text-slate-900 dark:text-white">{row.category}</td>
                        <td className="px-5 py-2.5 text-right font-mono text-xs tnum">{moneyExact(row.current)}</td>
                        <td className="px-5 py-2.5 text-right font-mono text-xs muted tnum">{moneyExact(row.previous)}</td>
                        <td
                          className={`px-5 py-2.5 text-right font-mono text-xs tnum ${
                            row.change > 0 ? 'text-neg' : row.change < 0 ? 'text-pos' : 'muted'
                          }`}
                        >
                          {row.change > 0 ? '+' : ''}
                          {money(row.change)}
                          {row.change_pct !== null && (
                            <span className="muted"> ({signedPct(row.change_pct)})</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {report.anomalies.anomalies.length > 0 && (
            <Card className="overflow-hidden">
              <CardHeader
                title="Flagged entries"
                subtitle="Included in the PDF statement"
                action={<Badge tone="warning">{report.anomalies.count}</Badge>}
              />
              <ul className="divide-y divide-slate-200/60 dark:divide-slate-800/60">
                {report.anomalies.anomalies.map((item) => (
                  <li key={item.id} className="px-5 py-3 text-sm">
                    <span className="font-medium text-ink-900 dark:text-ink-100">{item.description}</span>{' '}
                    <span className="font-mono text-xs tnum">{moneyExact(item.amount)}</span>
                    <span className="font-mono text-xs muted"> · {longDate(item.date)}</span>
                    <p className="mt-0.5 text-xs muted">{item.reason}</p>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card>
            <CardHeader
              title="Statement register"
              subtitle={`${report.transactions.length} entries, chronological`}
            />
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 border-b border-ink-200 bg-white text-xs muted dark:border-[#222220] dark:bg-[#141413]">
                  <tr>
                    <th className="px-5 py-2.5 text-left font-medium">Date</th>
                    <th className="px-5 py-2.5 text-left font-medium">Description</th>
                    <th className="px-5 py-2.5 text-left font-medium">Category</th>
                    <th className="px-5 py-2.5 text-right font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-200 dark:divide-[#1F1F1D]">
                  {report.transactions.map((row) => (
                    <tr key={row.id}>
                      <td className="whitespace-nowrap px-5 py-2.5 font-mono text-xs muted">{longDate(row.date)}</td>
                      <td className="px-5 py-2.5 text-ink-900 dark:text-ink-100">{row.description}</td>
                      <td className="px-5 py-2.5 text-xs muted">{row.category}</td>
                      <td
                        className={`whitespace-nowrap px-5 py-2.5 text-right font-mono text-xs font-medium tnum ${
                          row.txn_type === 'income' ? 'text-pos' : 'text-ink-900 dark:text-ink-100'
                        }`}
                      >
                        {row.txn_type === 'income' ? '+' : '−'}
                        {moneyExact(row.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      <p className="mt-4 flex items-start gap-1.5 text-[11px] leading-relaxed muted">
        <Download size={12} className="mt-0.5 shrink-0" />
        The PDF contains this summary plus the full transaction register. The CSV exports
        every transaction on your account, not only this month.
      </p>
      <EstimateNote>{meta.disclaimer}</EstimateNote>
    </>
  )
}

function SummaryCell({ label, value, before, invert = false, isPercent = false }) {
  const shown = isPercent ? (value === null ? '—' : pct(value)) : moneyExact(value)
  const delta =
    before === null || before === undefined || value === null ? null : value - before

  return (
    <div className="bg-white p-5 dark:bg-[#0F1422]">
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
      <p className="font-display font-bold mt-1.5 text-2xl tracking-tight text-slate-900 dark:text-white tnum">{shown}</p>
      {delta !== null && (
        <p
          className={`mt-1 font-mono text-[11px] tnum ${
            delta === 0
              ? 'muted'
              : (delta > 0) !== invert
                ? 'text-pos'
                : 'text-neg'
          }`}
        >
          {delta === 0
            ? 'flat vs prior month'
            : `${delta > 0 ? '+' : ''}${isPercent ? `${delta.toFixed(1)} pts` : money(delta)} vs prior`}
        </p>
      )}
    </div>
  )
}
