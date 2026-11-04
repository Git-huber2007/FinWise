import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  Info,
  Lightbulb,
  Receipt,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { api } from '../api'
import {
  BudgetUtilisationChart,
  CategoryBars,
  ExpenseTrendChart,
  IncomeVsExpenseChart,
  SavingsGrowthChart,
  useCategoryColor,
} from '../components/charts'
import AnomalyAlerts from '../components/AnomalyAlerts'
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

  if (loading && !data) return <Spinner label="Loading overview" />
  if (error) return <ErrorState error={error} onRetry={load} />

  if (!data?.has_data) {
    return (
      <>
        <PageHeader title="Overview" subtitle="Your financial summary at a glance" />
        <Card>
          <EmptyState
            icon={Receipt}
            title="No transactions recorded"
            body="Record income or expenses to see your cash flow, budget utilisation, and savings rate computed from them."
            action={
              <Link to="/transactions">
                <Button size="sm">
                  Add transactions
                  <ArrowRight size={14} />
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
        title="Overview"
        subtitle={
          isCurrentMonth
            ? `${data.month_label} to date — figures computed from your transactions`
            : `Monthly figures for ${data.month_label}`
        }
      />

      {/* Critical Anomaly Alerts */}
      <AnomalyAlerts anomalies={data.anomalies} compact />

      {/* Hero Financial Summary */}
      <Hero
        totals={totals}
        previous={previous}
        month={data.month}
        monthLabel={data.month_label}
        isCurrentMonth={isCurrentMonth}
      />

      {/* 4 Clean Metric Cards */}
      <MetricStrip>
        <Metric
          label="Total Income"
          value={money(totals.income)}
          tone="text-pos"
          note="Received this month"
        />
        <Metric
          label="Total Expenses"
          value={money(totals.expense)}
          tone="text-neg"
          note={`${totals.transactions} transactions`}
        />
        <Metric
          label="Budget Used"
          value={
            budget.used_pct !== null && budget.used_pct !== undefined
              ? pct(budget.used_pct)
              : '—'
          }
          note={
            budget.limit
              ? `${money(budget.spent)} of ${money(budget.limit)}`
              : 'No overall limit set'
          }
          progress={budget.used_pct}
        />
        <Metric
          label="Financial Health"
          value={`${data.health_score}`}
          unit="/ 100"
          note={data.health_band}
          badge={data.health_provisional ? 'Provisional' : null}
          to="/health"
          tone={
            data.health_score >= 65
              ? 'text-pos'
              : data.health_score >= 50
              ? 'text-warn'
              : 'text-neg'
          }
        />
      </MetricStrip>

      {/* Summary metadata line */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 px-1 text-xs muted">
        <span>
          <strong className="text-ink-800 dark:text-ink-200 font-medium tnum">
            {totals.transactions}
          </strong>{' '}
          transactions recorded
        </span>
        {data.category_breakdown[0] && (
          <span>
            Largest expense:{' '}
            <strong className="text-ink-800 dark:text-ink-200 font-medium">
              {data.category_breakdown[0].category}
            </strong>{' '}
            <span className="tnum">
              ({money(data.category_breakdown[0].amount)} · {pct(data.category_breakdown[0].share)})
            </span>
          </span>
        )}
      </div>

      {/* Charts Grid */}
      <div className="mt-7 grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Income vs Expenses" subtitle="12-month historical cash flow" />
          <div className="p-4 sm:p-5">
            <IncomeVsExpenseChart data={series} />
          </div>
        </Card>

        <Card className="self-start">
          <CardHeader title="Spending by Category" subtitle={data.month_label} />
          <div className="p-5">
            {data.category_breakdown.length ? (
              <CategoryBars data={data.category_breakdown} />
            ) : (
              <EmptyState icon={Receipt} title="No expenses recorded this month" />
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Expense Trajectory" subtitle="Month-over-month spending trend" />
          <div className="p-4 sm:p-5">
            <ExpenseTrendChart data={series} />
          </div>
        </Card>

        <Card>
          <CardHeader title="Cumulative Savings" subtitle="Net retained across recorded months" />
          <div className="p-4 sm:p-5">
            <SavingsGrowthChart data={series} />
          </div>
        </Card>

        {data.budget_alerts.length > 0 && (
          <Card className="lg:col-span-2">
            <CardHeader
              title="Budget Utilisation"
              subtitle="Spent vs limit for active categories this month"
              action={
                <Link
                  to="/budget"
                  className="text-xs font-medium text-brand-500 hover:underline"
                >
                  Manage budgets →
                </Link>
              }
            />
            <div className="p-5">
              <BudgetUtilisationChart alerts={data.budget_alerts} />
            </div>
          </Card>
        )}
      </div>

      {/* Insights & Recent Ledger Entries */}
      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Spending Insights"
            subtitle="Derived mathematically from your transactions"
            action={
              <Link
                to="/insights"
                className="text-xs font-medium text-brand-500 hover:underline"
              >
                See all →
              </Link>
            }
          />
          <div className="divide-y divide-ink-100 dark:divide-[#222634]">
            {data.insights.length ? (
              data.insights.map((insight, index) => <InsightRow key={index} insight={insight} />)
            ) : (
              <EmptyState
                icon={Lightbulb}
                title="No notable patterns"
                body="Patterns appear once enough history is established to compare against."
              />
            )}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Recent Transactions"
            action={
              <Link
                to="/transactions"
                className="text-xs font-medium text-brand-500 hover:underline"
              >
                View all →
              </Link>
            }
          />
          <div className="divide-y divide-ink-100 dark:divide-[#222634]">
            {data.recent_transactions.map((row) => (
              <div
                key={row.id}
                className="flex items-center gap-3 px-5 py-3 hover:bg-ink-50/60 dark:hover:bg-white/[0.02] transition-colors"
              >
                <span
                  className="h-6 w-1 shrink-0 rounded-full"
                  style={{ background: categoryColor(row.category) }}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink-900 dark:text-ink-100">
                    {row.description}
                  </p>
                  <p className="text-[11px] muted">
                    {shortDate(row.date)} · {row.category}
                  </p>
                </div>
                <span
                  className={`shrink-0 text-sm font-semibold tnum ${
                    row.txn_type === 'income' ? 'text-pos' : 'text-ink-800 dark:text-ink-200'
                  }`}
                >
                  {row.txn_type === 'income' ? '+' : '−'}
                  {moneyExact(row.amount)}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  )
}

function Hero({ totals, previous, month, monthLabel, isCurrentMonth }) {
  const positive = totals.savings >= 0
  const change =
    previous && previous.savings
      ? ((totals.savings - previous.savings) / Math.abs(previous.savings)) * 100
      : null

  const [year, monthNumber] = month.split('-').map(Number)
  const daysInMonth = new Date(year, monthNumber, 0).getDate()
  const elapsed = isCurrentMonth ? new Date().getDate() : daysInMonth

  return (
    <section className="card-hero p-6 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="min-w-0 max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-wider muted">
            {positive ? 'Net Savings' : 'Net Overspend'} · {monthLabel}
          </p>

          <p
            className={`display-xl mt-2 text-4xl sm:text-5xl tnum ${
              positive ? 'text-pos' : 'text-neg'
            }`}
          >
            {money(Math.abs(totals.savings))}
          </p>

          <p className="mt-3 text-sm leading-relaxed text-ink-700 dark:text-ink-200">
            {totals.income > 0 ? (
              <>
                You saved{' '}
                <span className="font-semibold text-ink-900 dark:text-white tnum">
                  {pct(totals.savings_rate)}
                </span>{' '}
                of your{' '}
                <span className="font-medium text-ink-900 dark:text-white tnum">
                  {money(totals.income)}
                </span>{' '}
                income, spending{' '}
                <span className="font-medium text-ink-900 dark:text-white tnum">
                  {money(totals.expense)}
                </span>
                .
              </>
            ) : (
              <>
                No income recorded in {monthLabel}, against{' '}
                <span className="font-medium text-ink-900 dark:text-white tnum">
                  {money(totals.expense)}
                </span>{' '}
                expenses.
              </>
            )}{' '}
            {isCurrentMonth && (
              <span className="block mt-1 text-xs muted font-normal">
                Day {elapsed} of {daysInMonth} — upcoming month-end expenses are not included yet.
              </span>
            )}
          </p>

          {change !== null && Math.abs(change) >= 0.1 && (
            <div className="mt-3.5 inline-flex items-center gap-1.5 rounded-md border border-ink-200 bg-ink-50 px-2.5 py-1 text-xs font-medium dark:border-ink-700 dark:bg-ink-800">
              {change > 0 ? (
                <TrendingUp size={13} className="text-pos" />
              ) : (
                <TrendingDown size={13} className="text-neg" />
              )}
              <span className={`tnum font-semibold ${change > 0 ? 'text-pos' : 'text-neg'}`}>
                {pct(Math.abs(change))}
              </span>
              <span className="muted font-normal">vs last month</span>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

function MetricStrip({ children }) {
  return (
    <div className="mt-4 grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
      {children}
    </div>
  )
}

function Metric({ label, value, unit, note, tone, progress, badge, to }) {
  const content = (
    <div className="flex h-full flex-col justify-between">
      <div>
        <p className="text-xs font-medium muted">{label}</p>
        <p className={`mt-1.5 text-xl font-bold tnum ${tone || 'text-ink-900 dark:text-white'}`}>
          {value}
          {unit && <span className="ml-1 text-xs font-normal muted">{unit}</span>}
        </p>
      </div>

      <div className="mt-3 pt-2">
        <div className="flex flex-wrap items-center justify-between gap-1">
          {note && <span className="text-[11px] muted">{note}</span>}
          {badge && <Badge tone="warning">{badge}</Badge>}
        </div>
        {progress !== null && progress !== undefined && (
          <ProgressBar
            className="mt-2"
            value={progress}
            tone={progress > 100 ? 'negative' : progress >= 80 ? 'warning' : 'positive'}
          />
        )}
      </div>
    </div>
  )

  return to ? (
    <Link
      to={to}
      className="card p-4 hover:border-ink-300 dark:hover:border-ink-600 transition-colors block"
    >
      {content}
    </Link>
  ) : (
    <div className="card p-4">{content}</div>
  )
}

export function InsightRow({ insight }) {
  const tones = {
    critical: { icon: AlertTriangle, cls: 'text-neg', badge: 'negative' },
    warning: { icon: AlertTriangle, cls: 'text-warn', badge: 'warning' },
    info: { icon: Info, cls: 'text-brand-500', badge: 'brand' },
  }
  const { icon: Icon, cls, badge } = tones[insight.severity] || tones.info

  return (
    <div className="flex gap-3 px-5 py-3.5 hover:bg-ink-50/50 dark:hover:bg-white/[0.02] transition-colors">
      <Icon size={15} className={`mt-0.5 shrink-0 ${cls}`} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-ink-900 dark:text-white">{insight.title}</p>
          <Badge tone={badge} className="text-[10px] py-0 px-1.5">
            {insight.severity}
          </Badge>
        </div>
        <p className="mt-0.5 text-xs leading-relaxed muted">{insight.body}</p>
      </div>
    </div>
  )
}
