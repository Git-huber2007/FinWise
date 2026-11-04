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
  ProgressBar,
  Select,
  Spinner,
} from '../components/ui'
import { longDate, money, moneyExact, pct, signedPct } from '../format'

/**
 * Reports.
 *
 * The preview on this page and the downloaded PDF are rendered from one
 * `/api/reports/monthly` payload on the server, so a report the user saves
 * cannot disagree with the one they were just looking at.
 */
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
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Reports</h1>
          <p className="mt-1 text-sm muted">
            A monthly summary you can keep, built from your recorded transactions
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
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
            <FileText size={15} /> PDF
          </Button>
          <Button
            variant="secondary"
            onClick={() => download('csv')}
            loading={downloading === 'csv'}
          >
            <FileSpreadsheet size={15} /> CSV
          </Button>
        </div>
      </div>

      {meta.is_sample_data && (
        <div className="mb-5 flex items-start gap-2 rounded-xl border border-warn/30 bg-warn/[0.07] p-4 text-sm">
          <Info size={16} className="mt-0.5 shrink-0 text-warn" />
          <span>
            <strong>Sample data.</strong> {meta.sample_notice} The PDF is stamped the same
            way.
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
        <div className="space-y-5">
          <Card>
            <CardHeader
              title={`Summary — ${meta.month_label}`}
              subtitle={
                report.previous_month
                  ? `Compared with ${meta.available_months.find((m) => m.month === report.previous_month)?.label ?? report.previous_month}`
                  : 'No earlier month to compare against'
              }
            />
            <div className="grid gap-px overflow-hidden bg-ink-200 sm:grid-cols-2 lg:grid-cols-4 dark:bg-ink-800">
              <SummaryCell label="Income" value={totals.income} before={previous?.income} />
              <SummaryCell
                label="Expenses"
                value={totals.expense}
                before={previous?.expense}
                invert
              />
              <SummaryCell label="Savings" value={totals.savings} before={previous?.savings} />
              <SummaryCell
                label="Savings rate"
                value={totals.savings_rate}
                before={previous?.savings_rate}
                isPercent
              />
            </div>
          </Card>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader title="Where the money went" subtitle={`${totals.transactions} entries`} />
              <div className="space-y-3 p-5 pt-0">
                {report.category_breakdown.length === 0 && (
                  <p className="text-sm muted">No expenses recorded this month.</p>
                )}
                {report.category_breakdown.map((item) => (
                  <div key={item.category}>
                    <div className="flex justify-between text-sm">
                      <span>{item.category}</span>
                      <span className="tnum">
                        {moneyExact(item.amount)}{' '}
                        <span className="muted">({item.share}%)</span>
                      </span>
                    </div>
                    <ProgressBar className="mt-1.5" value={item.share} />
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <CardHeader
                title="Financial health"
                subtitle={report.health.band}
                action={
                  report.health.provisional ? (
                    <Badge tone="warning">provisional</Badge>
                  ) : null
                }
              />
              <div className="p-5 pt-0">
                <p className="text-2xl font-semibold tnum">
                  {report.health.score}
                  <span className="text-base font-normal muted"> / 100</span>
                </p>
                <div className="mt-4 space-y-2">
                  {report.health.components.map((component) => (
                    <div key={component.key} className="flex justify-between text-xs">
                      <span className="muted">{component.label}</span>
                      <span className="tnum">
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
            <Card>
              <CardHeader
                title="Month-on-month movement"
                subtitle={
                  meta.partial_month
                    ? 'Both months truncated to the same elapsed day'
                    : 'Biggest changes first'
                }
              />
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-ink-200 text-xs muted dark:border-ink-800">
                    <tr>
                      <th className="px-5 py-2 text-left font-medium">Category</th>
                      <th className="px-5 py-2 text-right font-medium">This month</th>
                      <th className="px-5 py-2 text-right font-medium">Previous</th>
                      <th className="px-5 py-2 text-right font-medium">Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.comparison.slice(0, 8).map((row) => (
                      <tr key={row.category} className="border-b border-ink-200 last:border-0 dark:border-ink-800">
                        <td className="px-5 py-2">{row.category}</td>
                        <td className="px-5 py-2 text-right tnum">{moneyExact(row.current)}</td>
                        <td className="px-5 py-2 text-right tnum">{moneyExact(row.previous)}</td>
                        <td
                          className={`px-5 py-2 text-right tnum ${
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
            <Card>
              <CardHeader
                title="Spending to confirm"
                subtitle="Included in the PDF"
                action={<Badge tone="warning">{report.anomalies.count}</Badge>}
              />
              <ul className="divide-y divide-ink-200 dark:divide-ink-800">
                {report.anomalies.anomalies.map((item) => (
                  <li key={item.id} className="px-5 py-3 text-sm">
                    <span className="font-medium">{item.description}</span>{' '}
                    <span className="tnum">{moneyExact(item.amount)}</span>
                    <span className="muted"> · {longDate(item.date)}</span>
                    <p className="mt-0.5 text-xs muted">{item.reason}</p>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card>
            <CardHeader title="Transactions in this report" subtitle={`${report.transactions.length} entries, oldest first`} />
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 border-b border-ink-200 bg-white text-xs muted dark:border-ink-800 dark:bg-ink-900">
                  <tr>
                    <th className="px-5 py-2 text-left font-medium">Date</th>
                    <th className="px-5 py-2 text-left font-medium">Description</th>
                    <th className="px-5 py-2 text-left font-medium">Category</th>
                    <th className="px-5 py-2 text-right font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {report.transactions.map((row) => (
                    <tr key={row.id} className="border-b border-ink-200 last:border-0 dark:border-ink-800">
                      <td className="whitespace-nowrap px-5 py-2 muted">{longDate(row.date)}</td>
                      <td className="px-5 py-2">{row.description}</td>
                      <td className="px-5 py-2 muted">{row.category}</td>
                      <td
                        className={`whitespace-nowrap px-5 py-2 text-right tnum ${
                          row.txn_type === 'income' ? 'text-pos' : ''
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
    <div className="bg-white p-4 dark:bg-ink-900">
      <p className="text-[11px] font-medium uppercase tracking-wide muted">{label}</p>
      <p className="mt-1 text-lg font-semibold tnum">{shown}</p>
      {delta !== null && (
        <p
          className={`mt-0.5 text-[11px] tnum ${
            delta === 0
              ? 'muted'
              : (delta > 0) !== invert
                ? 'text-pos'
                : 'text-neg'
          }`}
        >
          {delta === 0
            ? 'no change vs previous month'
            : `${delta > 0 ? '+' : ''}${isPercent ? `${delta.toFixed(1)} pts` : money(delta)} vs previous month`}
        </p>
      )}
    </div>
  )
}
