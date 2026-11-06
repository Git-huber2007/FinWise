import { ArrowDownRight, ArrowUpRight, LineChart, Minus } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import { api } from '../api'
import { useCategoryColor } from '../components/charts'
import {
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  PageHeader,
  ProgressBar,
  Spinner,
} from '../components/ui'
import { money, pct, signedPct } from '../format'
import { InsightRow } from './Dashboard'

export default function Insights() {
  const categoryColor = useCategoryColor()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setData(await api.post('/api/ai/analyze'))
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (loading && !data) return <Spinner label="Analysing your spending" />
  if (error) return <ErrorState error={error} onRetry={load} />

  if (!data?.has_data) {
    return (
      <>
        <PageHeader title="Spending Analysis" subtitle="Variance and allocation patterns computed from your ledger" />
        <Card>
          <EmptyState
            icon={LineChart}
            title="Nothing to analyse yet"
            body="Record a month of income and expenses and the patterns will appear here."
          />
        </Card>
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Spending Analysis"
        subtitle={`${data.month_label} — deterministic variance and category share across your recorded ledger`}
      />

      <Card className="overflow-hidden">
        <CardHeader
          title="Notable movements"
          subtitle={
            data.previous_month
              ? `Compared with ${data.previous_month}`
              : 'No earlier month to compare against yet'
          }
        />
        <div className="divide-y divide-slate-200/80 dark:divide-slate-800/80">
          {data.insights.length ? (
            data.insights.map((insight, index) => <InsightRow key={index} insight={insight} />)
          ) : (
            <EmptyState
              icon={LineChart}
              title="No notable patterns this month"
              body="Nothing moved enough to be worth flagging. That is usually a good sign."
            />
          )}
        </div>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <CardHeader title="Category allocation" subtitle="Ranked by share of total outflow" />
          <div className="space-y-3.5 p-5">
            {data.category_breakdown.map((item) => (
              <div key={item.category}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="flex items-center gap-2 font-medium text-slate-900 dark:text-white">
                    <span
                      className="h-2 w-2 shrink-0 rounded-[2px]"
                      style={{ background: categoryColor(item.category) }}
                    />
                    {item.category}
                  </span>
                  <span className="font-mono text-xs tnum">
                    <span className="font-medium text-slate-900 dark:text-white">{money(item.amount)}</span>
                    <span className="muted"> · {pct(item.share)}</span>
                  </span>
                </div>
                <ProgressBar
                  className="mt-1.5"
                  value={item.share}
                  color={categoryColor(item.category)}
                />
                <p className="mt-1 font-mono text-[11px] muted">
                  {item.transactions} txn(s) · avg {money(item.average)}
                </p>
              </div>
            ))}
          </div>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader
            title="Month-over-month variance"
            subtitle={
              data.previous_month ? `vs ${data.previous_month}` : 'Needs two months of data'
            }
          />
          {data.comparison.length ? (
            <div className="divide-y divide-slate-200/80 dark:divide-slate-800/80">
              {data.comparison.map((row) => (
                <ComparisonRow key={row.category} row={row} />
              ))}
            </div>
          ) : (
            <EmptyState
              title="No comparison available"
              body="Record a second month and changes will show up here."
            />
          )}
        </Card>
      </div>

      {data.budget_alerts.length > 0 && (
        <Card className="mt-6 overflow-hidden">
          <CardHeader title="Ceiling utilisation" subtitle={data.month_label} />
          <div className="space-y-3.5 p-5">
            {data.budget_alerts.map((alert) => (
              <div key={alert.budget_id}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-medium text-ink-900 dark:text-ink-100">{alert.label}</span>
                  <span className="font-mono text-xs tnum">
                    <span
                      className={`font-medium ${
                        alert.status === 'over' ? 'text-neg' : alert.status === 'warning' ? 'text-warn' : 'text-ink-900 dark:text-ink-100'
                      }`}
                    >
                      {money(alert.spent)}
                    </span>
                    <span className="muted"> / {money(alert.budget)}</span>
                  </span>
                </div>
                <ProgressBar
                  className="mt-1.5"
                  value={alert.used_pct}
                  tone={
                    alert.status === 'over'
                      ? 'negative'
                      : alert.status === 'warning'
                        ? 'warning'
                        : 'positive'
                  }
                />
                <p className="mt-1 font-mono text-[11px] muted">
                  {alert.remaining >= 0
                    ? `${money(alert.remaining)} remaining`
                    : `Over by ${money(Math.abs(alert.remaining))}`}
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </>
  )
}

function ComparisonRow({ row }) {
  const categoryColor = useCategoryColor()
  const rose = row.change > 0
  const flat = row.change === 0
  const Icon = flat ? Minus : rose ? ArrowUpRight : ArrowDownRight
  const tone = flat ? 'muted' : rose ? 'text-neg' : 'text-pos'

  return (
    <div className="flex items-center gap-3 px-5 py-3">
      <span
        className="h-6 w-1 shrink-0 rounded-[1px]"
        style={{ background: categoryColor(row.category) }}
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink-900 dark:text-ink-100">{row.category}</p>
        <p className="font-mono text-[11px] muted tnum">
          {money(row.previous)} → {money(row.current)}
        </p>
      </div>
      <span className={`flex shrink-0 items-center gap-0.5 font-mono text-xs tnum ${tone}`}>
        <Icon size={13} />
        {row.change_pct === null ? 'new' : signedPct(row.change_pct)}
      </span>
    </div>
  )
}
