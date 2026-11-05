import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  Info,
  Plus,
  Receipt,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { api } from '../api'
import AnomalyAlerts from '../components/AnomalyAlerts'
import {
  BudgetUtilisationChart,
  CategoryBars,
  ExpenseTrendChart,
  IncomeVsExpenseChart,
  SavingsGrowthChart,
  useCategoryColor,
} from '../components/charts'
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  PageHeader,
  ProgressBar,
  Spinner,
} from '../components/ui'
import { money, moneyExact, pct, shortDate } from '../format'

export default function Dashboard() {
  const categoryColor = useCategoryColor()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setData(await api.get('/api/dashboard'))
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (loading && !data) return <Spinner label="Loading ledger statement" />
  if (error) return <ErrorState error={error} onRetry={load} />

  if (!data?.has_data) {
    return (
      <>
        <PageHeader title="Ledger Overview" subtitle="Monthly cash flow and account position" />
        <Card>
          <EmptyState
            icon={Receipt}
            title="No ledger entries recorded"
            body="Record inflows or outflows to compute your net position, budget pace, and historical trajectory."
            action={
              <Link to="/transactions">
                <Button size="sm">
                  Record entry
                  <ArrowRight size={13} />
                </Button>
              </Link>
            }
          />
        </Card>
      </>
    )
  }

  const { totals, previous, budget, monthly_series: series } = data
  const isCurrentMonth = data.month === new Date().toISOString().slice(0, 7)

  return (
    <>
      <PageHeader
        title={`${data.month_label} Statement`}
        subtitle={
          isCurrentMonth
            ? `Month-to-date position computed across ${totals.transactions} recorded entries`
            : `Closed monthly ledger across ${totals.transactions} recorded entries`
        }
        action={
          <div className="flex items-center gap-2">
            <Link to="/reports">
              <Button variant="secondary" size="md">
                Export statement
              </Button>
            </Link>
            <Link to="/transactions">
              <Button size="md">
                <Plus size={14} />
                Record entry
              </Button>
            </Link>
          </div>
        }
      />

      {/* Unified Architectural Statement Strip — replaces 5 separate floating metric boxes */}
      <LedgerPositionSheet
        totals={totals}
        previous={previous}
        budget={budget}
        month={data.month}
        monthLabel={data.month_label}
        isCurrentMonth={isCurrentMonth}
        healthScore={data.health_score}
        healthBand={data.health_band}
        healthProvisional={data.health_provisional}
      />

      {/* Compact inline audit strip for atypical expenses */}
      <div className="mt-5">
        <AnomalyAlerts anomalies={data.anomalies} compact />
      </div>

      {/* Unified Primary Analytical Sheet: 12M Cash Flow + Category Allocation */}
      <section className="mt-6 card overflow-hidden grid lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-ink-200/90 dark:divide-[#242421]">
        <div className="lg:col-span-7 flex flex-col">
          <CardHeader
            title="Cash Flow History"
            subtitle="12-month inflows vs outflows"
            action={
              <span className="font-mono text-[11px] muted tnum">
                {series.length} months recorded
              </span>
            }
          />
          <div className="p-5 flex-1">
            <IncomeVsExpenseChart data={series} />
          </div>
        </div>

        <div className="lg:col-span-5 flex flex-col">
          <CardHeader
            title="Outflow Allocation"
            subtitle={`${data.month_label} breakdown by category`}
            action={
              data.category_breakdown[0] && (
                <span className="font-mono text-[11px] muted tnum">
                  Top: {data.category_breakdown[0].category} ({pct(data.category_breakdown[0].share)})
                </span>
              )
            }
          />
          <div className="p-5 flex-1">
            {data.category_breakdown.length ? (
              <CategoryBars data={data.category_breakdown} />
            ) : (
              <EmptyState icon={Receipt} title="No outflows recorded this month" />
            )}
          </div>
        </div>
      </section>

      {/* Unified Trajectory Sheet: Outflow Trend + Cumulative Retained Savings */}
      <section className="mt-6 card overflow-hidden grid lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-ink-200/90 dark:divide-[#242421]">
        <div className="lg:col-span-6">
          <CardHeader title="Outflow Trajectory" subtitle="Month-over-month spending velocity" />
          <div className="p-5">
            <ExpenseTrendChart data={series} />
          </div>
        </div>

        <div className="lg:col-span-6">
          <CardHeader title="Cumulative Retained" subtitle="Net capital retained across recorded history" />
          <div className="p-5">
            <SavingsGrowthChart data={series} />
          </div>
        </div>
      </section>

      {/* Budget Pace Sheet */}
      {data.budget_alerts.length > 0 && (
        <section className="mt-6 card overflow-hidden">
          <CardHeader
            title="Category Budget Pace"
            subtitle="Actual outflows against monthly category limits"
            action={
              <Link
                to="/budget"
                className="inline-flex items-center gap-1 font-mono text-[11px] font-medium text-ink-900 hover:underline dark:text-ink-100"
              >
                Configure limits
                <ArrowUpRight size={12} />
              </Link>
            }
          />
          <div className="p-5">
            <BudgetUtilisationChart alerts={data.budget_alerts} />
          </div>
        </section>
      )}

      {/* Bottom Split: Recent Ledger Entries + Calculated Movements */}
      <section className="mt-6 card overflow-hidden grid lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-ink-200/90 dark:divide-[#242421]">
        <div className="lg:col-span-7">
          <CardHeader
            title="Recent Ledger Entries"
            subtitle="Latest recorded inflows and outflows"
            action={
              <Link
                to="/transactions"
                className="inline-flex items-center gap-1 font-mono text-[11px] font-medium text-ink-900 hover:underline dark:text-ink-100"
              >
                Full ledger
                <ArrowUpRight size={12} />
              </Link>
            }
          />
          <div className="divide-y divide-ink-200/70 dark:divide-[#222220]">
            {data.recent_transactions.map((row) => (
              <div
                key={row.id}
                className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-ink-50/70 dark:hover:bg-[#181816] transition-colors"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="w-14 shrink-0 font-mono text-[11px] muted tnum">
                    {shortDate(row.date)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-ink-900 dark:text-ink-100">
                      {row.description}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1.5 font-mono text-[10px] muted">
                      <span
                        className="size-1.5 rounded-xs"
                        style={{ background: categoryColor(row.category) }}
                      />
                      {row.category}
                    </p>
                  </div>
                </div>
                <span
                  className={`shrink-0 font-mono text-xs font-medium tnum ${
                    row.txn_type === 'income'
                      ? 'text-pos dark:text-emerald-400'
                      : 'text-ink-900 dark:text-ink-100'
                  }`}
                >
                  {row.txn_type === 'income' ? '+' : '−'}
                  {moneyExact(row.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-5">
          <CardHeader
            title="Calculated Movements"
            subtitle="Notable variance from prior periods"
            action={
              <Link
                to="/insights"
                className="inline-flex items-center gap-1 font-mono text-[11px] font-medium text-ink-900 hover:underline dark:text-ink-100"
              >
                Full analysis
                <ArrowUpRight size={12} />
              </Link>
            }
          />
          <div className="divide-y divide-ink-200/70 dark:divide-[#222220]">
            {data.insights.length ? (
              data.insights.map((insight, index) => <InsightRow key={index} insight={insight} />)
            ) : (
              <EmptyState
                title="No significant variance"
                body="Category movements are within historical norms for this period."
              />
            )}
          </div>
        </div>
      </section>
    </>
  )
}

function LedgerPositionSheet({
  totals,
  previous,
  budget,
  month,
  monthLabel,
  isCurrentMonth,
  healthScore,
  healthBand,
  healthProvisional,
}) {
  const positive = totals.savings >= 0
  const change =
    previous && previous.savings
      ? ((totals.savings - previous.savings) / Math.abs(previous.savings)) * 100
      : null

  const [year, monthNumber] = month.split('-').map(Number)
  const daysInMonth = new Date(year, monthNumber, 0).getDate()
  const elapsed = isCurrentMonth ? new Date().getDate() : daysInMonth

  return (
    <section className="card overflow-hidden grid lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-ink-200/90 dark:divide-[#242421]">
      {/* Primary Net Position Cell */}
      <div className="lg:col-span-5 p-5 sm:p-6 flex flex-col justify-between bg-[#FCFBF9] dark:bg-[#141413]">
        <div>
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xs font-medium text-ink-600 dark:text-ink-400">
              {positive ? 'Net Retained Savings' : 'Net Period Deficit'} ({monthLabel})
            </h2>
            {change !== null && Math.abs(change) >= 0.1 && (
              <span className="inline-flex items-center gap-1 rounded border border-ink-200 bg-white px-2 py-0.5 font-mono text-[11px] font-medium text-ink-800 dark:border-[#2C2C28] dark:bg-[#1C1C1A] dark:text-ink-200 tnum">
                {change > 0 ? (
                  <TrendingUp size={11} className="text-pos" />
                ) : (
                  <TrendingDown size={11} className="text-neg" />
                )}
                {change > 0 ? '+' : '−'}
                {pct(Math.abs(change))} vs prior
              </span>
            )}
          </div>

          <p className="mt-2 font-serif text-4xl sm:text-[42px] leading-none text-ink-900 dark:text-ink-100 tnum">
            {positive ? '' : '−'}
            {money(Math.abs(totals.savings))}
          </p>
        </div>

        <div className="mt-4 pt-3 border-t border-ink-200/70 dark:border-[#222220] text-xs muted flex flex-wrap items-center justify-between gap-2">
          <span>
            {totals.income > 0 ? (
              <>
                Retained{' '}
                <strong className="font-mono font-medium text-ink-900 dark:text-ink-100 tnum">
                  {pct(totals.savings_rate)}
                </strong>{' '}
                of inflows
              </>
            ) : (
              'No inflows recorded this period'
            )}
          </span>
          {isCurrentMonth && (
            <span className="font-mono text-[11px] tnum">
              Day {elapsed} of {daysInMonth}
            </span>
          )}
        </div>
      </div>

      {/* 4 Secondary Ledger Cells in a Unified Hairline Grid */}
      <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 divide-x divide-ink-200/90 dark:divide-[#242421]">
        <div className="p-4 sm:p-5 flex flex-col justify-between">
          <div>
            <p className="text-xs text-ink-500 dark:text-ink-400">Inflows</p>
            <p className="mt-2 font-mono text-lg font-semibold text-ink-900 dark:text-ink-100 tnum">
              {money(totals.income)}
            </p>
          </div>
          <p className="mt-4 flex items-center gap-1.5 text-[11px] muted">
            <span className="size-1.5 rounded-full bg-pos" />
            Credited
          </p>
        </div>

        <div className="p-4 sm:p-5 flex flex-col justify-between">
          <div>
            <p className="text-xs text-ink-500 dark:text-ink-400">Outflows</p>
            <p className="mt-2 font-mono text-lg font-semibold text-ink-900 dark:text-ink-100 tnum">
              {money(totals.expense)}
            </p>
          </div>
          <p className="mt-4 font-mono text-[11px] muted tnum">
            {totals.transactions} {totals.transactions === 1 ? 'entry' : 'entries'}
          </p>
        </div>

        <div className="p-4 sm:p-5 flex flex-col justify-between">
          <div>
            <p className="text-xs text-ink-500 dark:text-ink-400">Budget Pace</p>
            <p className="mt-2 font-mono text-lg font-semibold text-ink-900 dark:text-ink-100 tnum">
              {budget.used_pct !== null && budget.used_pct !== undefined
                ? pct(budget.used_pct)
                : '—'}
            </p>
          </div>
          <div className="mt-3">
            {budget.used_pct !== null && budget.used_pct !== undefined ? (
              <>
                <ProgressBar
                  value={budget.used_pct}
                  tone={
                    budget.used_pct > 100
                      ? 'negative'
                      : budget.used_pct >= 80
                        ? 'warning'
                        : 'brand'
                  }
                />
                <p className="mt-1.5 font-mono text-[10px] muted tnum truncate">
                  {money(budget.spent)} / {money(budget.limit)}
                </p>
              </>
            ) : (
              <p className="text-[11px] muted">No cap set</p>
            )}
          </div>
        </div>

        <Link
          to="/health"
          className="p-4 sm:p-5 flex flex-col justify-between hover:bg-ink-50/80 dark:hover:bg-[#181816] transition-colors group"
        >
          <div>
            <div className="flex items-center justify-between">
              <p className="text-xs text-ink-500 dark:text-ink-400">Health Index</p>
              <ArrowUpRight
                size={13}
                className="text-ink-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform"
              />
            </div>
            <p className="mt-2 font-mono text-lg font-semibold text-ink-900 dark:text-ink-100 tnum">
              {healthScore}
              <span className="ml-0.5 text-xs font-normal muted">/100</span>
            </p>
          </div>
          <div className="mt-4 flex items-center justify-between gap-1">
            <span className="font-mono text-[11px] font-medium text-ink-800 dark:text-ink-200">
              {healthBand}
            </span>
            {healthProvisional && <Badge tone="warning">Prov.</Badge>}
          </div>
        </Link>
      </div>
    </section>
  )
}

export function InsightRow({ insight }) {
  const tones = {
    critical: { icon: AlertTriangle, cls: 'text-neg', badge: 'negative' },
    warning: { icon: AlertTriangle, cls: 'text-warn', badge: 'warning' },
    info: { icon: Info, cls: 'text-ink-500', badge: 'neutral' },
  }
  const { icon: Icon, cls, badge } = tones[insight.severity] || tones.info

  return (
    <div className="flex gap-3 px-5 py-3.5 hover:bg-ink-50/50 dark:hover:bg-[#181816] transition-colors">
      <Icon size={14} className={`mt-0.5 shrink-0 ${cls}`} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-ink-900 dark:text-ink-100">{insight.title}</p>
          <Badge tone={badge}>{insight.severity}</Badge>
        </div>
        <p className="mt-1 text-xs leading-relaxed muted">{insight.body}</p>
      </div>
    </div>
  )
}
