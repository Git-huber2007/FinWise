import {
  AlertTriangle,
  ArrowRight,
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
  CategoryPie,
  ExpenseTrendChart,
  IncomeVsExpenseChart,
  SavingsGrowthChart,
  colorFor,
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

  if (loading && !data) return <Spinner label="Building your dashboard" />
  if (error) return <ErrorState error={error} onRetry={load} />

  if (!data?.has_data) {
    return (
      <>
        <PageHeader title="Dashboard" subtitle="Your financial position at a glance" />
        <Card>
          <EmptyState
            icon={Receipt}
            title="Nothing to show yet"
            body="Add your income and a few expenses, and every figure on this page will be computed from them."
            action={
              <Link to="/transactions">
                <Button size="sm">
                  Add transactions
                  <ArrowRight size={15} />
                </Button>
              </Link>
            }
          />
        </Card>
      </>
    )
  }

  const { totals, previous, budget, monthly_series: series } = data

  // The current month is only partly elapsed, so its totals are month-to-date.
  // Saying so stops "96% savings rate on the 4th" from looking like a bug.
  const isCurrentMonth = data.month === new Date().toISOString().slice(0, 7)

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle={
          isCurrentMonth
            ? `${data.month_label} so far — month-to-date figures from your transactions`
            : `Figures for ${data.month_label}, computed from your transactions`
        }
      />

      {/* Above the tiles on purpose: something that needs the user's
          confirmation should not be below four screens of charts. */}
      <AnomalyAlerts anomalies={data.anomalies} compact />

      {/* The answer first.
          This page used to open with eight equal-weight tiles and a decorative
          icon on each, which left the user to work out for themselves whether
          the month was going well. Hierarchy is the fix: one hero figure that
          answers the question, a dense supporting strip, then the detail. */}
      <Hero
        totals={totals}
        previous={previous}
        month={data.month}
        monthLabel={data.month_label}
        isCurrentMonth={isCurrentMonth}
      />

      <MetricStrip>
        <Metric label="Income" value={money(totals.income)} tone="text-pos" />
        <Metric label="Expenses" value={money(totals.expense)} tone="text-neg" />
        <Metric
          label="Budget used"
          value={budget.used_pct !== null && budget.used_pct !== undefined
            ? pct(budget.used_pct) : '—'}
          note={budget.limit ? `${money(budget.spent)} of ${money(budget.limit)}`
                             : 'No overall budget set'}
          progress={budget.used_pct}
        />
        <Metric
          label="Financial health"
          value={`${data.health_score}`}
          unit="/ 100"
          note={data.health_band}
          badge={data.health_provisional ? 'provisional' : null}
          to="/health"
          tone={data.health_score >= 65 ? 'text-pos'
               : data.health_score >= 50 ? 'text-warn' : 'text-neg'}
        />
      </MetricStrip>

      <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-xs muted">
        <span>
          <span className="tnum text-ink-600 dark:text-ink-100">{totals.transactions}</span>{' '}
          transactions recorded
        </span>
        {data.category_breakdown[0] && (
          <span>
            Biggest category{' '}
            <span className="text-ink-600 dark:text-ink-100">
              {data.category_breakdown[0].category}
            </span>{' '}
            <span className="tnum">
              {money(data.category_breakdown[0].amount)} ({pct(data.category_breakdown[0].share)})
            </span>
          </span>
        )}
      </div>

      {/* --- charts --- */}
      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Income vs expenses" subtitle="Last 12 recorded months" />
          <div className="p-3">
            <IncomeVsExpenseChart data={series} />
          </div>
        </Card>

        <Card>
          <CardHeader title="Spending breakdown" subtitle={data.month_label} />
          <div className="p-3">
            {data.category_breakdown.length ? (
              <CategoryPie data={data.category_breakdown} />
            ) : (
              <EmptyState icon={Receipt} title="No expenses this month" />
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Monthly expense trend" subtitle="How spending is moving" />
          <div className="p-3">
            <ExpenseTrendChart data={series} />
          </div>
        </Card>

        <Card>
          <CardHeader title="Savings growth" subtitle="Cumulative across recorded months" />
          <div className="p-3">
            <SavingsGrowthChart data={series} />
          </div>
        </Card>

        {data.budget_alerts.length > 0 && (
          <Card className="lg:col-span-2">
            <CardHeader
              title="Budget utilisation"
              subtitle="Spent against planned, this month"
              action={
                <Link to="/budget" className="text-xs text-brand-400 hover:underline">
                  Manage budgets
                </Link>
              }
            />
            <div className="p-3">
              <BudgetUtilisationChart alerts={data.budget_alerts} />
            </div>
          </Card>
        )}
      </div>

      {/* --- feed --- */}
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="AI insights"
            subtitle="Derived from your own transactions"
            action={
              <Link to="/insights" className="text-xs text-brand-400 hover:underline">
                See all
              </Link>
            }
          />
          <div className="divide-y divide-ink-100 dark:divide-ink-800/60">
            {data.insights.length ? (
              data.insights.map((insight, index) => <InsightRow key={index} insight={insight} />)
            ) : (
              <EmptyState icon={Lightbulb} title="No notable patterns yet"
                body="Insights appear once there is enough history to compare against." />
            )}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Recent transactions"
            action={
              <Link to="/transactions" className="text-xs text-brand-400 hover:underline">
                View all
              </Link>
            }
          />
          <div className="divide-y divide-ink-100 dark:divide-ink-800/60">
            {data.recent_transactions.map((row) => (
              <div key={row.id} className="flex items-center gap-3 px-5 py-3">
                <span
                  className="h-7 w-1 shrink-0 rounded-full"
                  style={{ background: colorFor(row.category) }}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{row.description}</p>
                  <p className="text-[11px] muted">
                    {shortDate(row.date)} · {row.category}
                  </p>
                </div>
                <span
                  className={`shrink-0 text-sm font-semibold tnum ${
                    row.txn_type === 'income' ? 'text-pos' : ''
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

/**
 * The one figure the page exists to deliver, stated in words as well as digits.
 *
 * Borderless on a tinted ground rather than in a card: the hero should not
 * compete with the detail below it for the same visual treatment. The sentence
 * matters as much as the number — "₹49,972" alone does not tell anyone whether
 * their month is going well.
 */
function Hero({ totals, previous, month, monthLabel, isCurrentMonth }) {
  const positive = totals.savings >= 0
  const change =
    previous && previous.savings
      ? ((totals.savings - previous.savings) / Math.abs(previous.savings)) * 100
      : null

  // Day X of Y, computed rather than assumed, so a part month says so plainly.
  const [year, monthNumber] = month.split('-').map(Number)
  const daysInMonth = new Date(year, monthNumber, 0).getDate()
  const elapsed = isCurrentMonth ? new Date().getDate() : daysInMonth

  return (
    <section className="rounded-card bg-ink-100/70 p-5 sm:p-6 dark:bg-ink-900/60">
      <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-4">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wider muted">
            {positive ? 'Kept' : 'Overspent'} in {monthLabel}
          </p>
          <p
            className={`mt-1 text-4xl font-semibold leading-none tnum sm:text-5xl ${
              positive ? 'text-pos' : 'text-neg'
            }`}
          >
            {money(Math.abs(totals.savings))}
          </p>

          <p className="mt-3 max-w-prose text-sm leading-relaxed text-ink-600 dark:text-ink-100">
            {totals.income > 0 ? (
              <>
                You kept{' '}
                <span className="font-medium tnum">{pct(totals.savings_rate)}</span> of{' '}
                <span className="tnum">{money(totals.income)}</span> income, spending{' '}
                <span className="tnum">{money(totals.expense)}</span>.
              </>
            ) : (
              <>
                No income recorded in {monthLabel}, against{' '}
                <span className="tnum">{money(totals.expense)}</span> of spending.
              </>
            )}{' '}
            {isCurrentMonth && (
              <span className="muted">
                Day {elapsed} of {daysInMonth} — bills due later in the month are not in
                this figure yet.
              </span>
            )}
          </p>

          {change !== null && Math.abs(change) >= 0.1 && (
            <p className="mt-3 inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs dark:bg-ink-950">
              {change > 0 ? (
                <TrendingUp size={13} className="text-pos" />
              ) : (
                <TrendingDown size={13} className="text-neg" />
              )}
              <span className={`tnum ${change > 0 ? 'text-pos' : 'text-neg'}`}>
                {pct(Math.abs(change))}
              </span>
              <span className="muted">vs last month</span>
            </p>
          )}
        </div>
      </div>
    </section>
  )
}

/** Four supporting figures as one bordered band divided by hairlines. */
function MetricStrip({ children }) {
  return (
    <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-card border border-ink-200 bg-ink-200 lg:grid-cols-4 dark:border-ink-800 dark:bg-ink-800">
      {children}
    </div>
  )
}

function Metric({ label, value, unit, note, tone, progress, badge, to }) {
  const body = (
    <>
      <p className="text-[11px] font-medium uppercase tracking-wider muted">{label}</p>
      <p className={`mt-1.5 text-lg font-semibold tnum ${tone || ''}`}>
        {value}
        {unit && <span className="ml-1 text-xs font-normal muted">{unit}</span>}
      </p>
      {/* mt-auto so cells with a note and a bar do not leave the plainer ones
          looking half-empty beside them. */}
      <div className="mt-auto pt-2">
        <div className="flex flex-wrap items-center gap-1.5">
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
    </>
  )

  const className =
    'flex flex-col bg-white p-4 transition-colors dark:bg-ink-900' +
    (to ? ' hover:bg-ink-50 dark:hover:bg-ink-800/60' : '')

  return to ? (
    <Link to={to} className={`block ${className}`}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  )
}

export function InsightRow({ insight }) {
  const tones = {
    critical: { icon: AlertTriangle, cls: 'text-neg', badge: 'negative' },
    warning: { icon: AlertTriangle, cls: 'text-warn', badge: 'warning' },
    info: { icon: Info, cls: 'text-brand-400', badge: 'brand' },
  }
  const { icon: Icon, cls } = tones[insight.severity] || tones.info

  return (
    <div className="flex gap-3 px-5 py-3.5">
      <Icon size={15} className={`mt-0.5 shrink-0 ${cls}`} />
      <div className="min-w-0">
        <p className="text-sm font-medium">{insight.title}</p>
        <p className="mt-0.5 text-xs leading-relaxed muted">{insight.body}</p>
      </div>
    </div>
  )
}
