import {
  AlertTriangle,
  ArrowRight,
  Info,
  Lightbulb,
  PiggyBank,
  Receipt,
  Stethoscope,
  TrendingDown,
  TrendingUp,
  Wallet,
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
import StatCard from '../components/StatCard'
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

      {/* --- the ten headline figures --- */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <StatCard
          label="Monthly income"
          value={totals.income}
          previous={previous?.income}
          goodDirection="up"
          tone="text-pos"
          icon={TrendingUp}
        />
        <StatCard
          label="Monthly expenses"
          value={totals.expense}
          previous={previous?.expense}
          goodDirection="down"
          tone="text-neg"
          icon={TrendingDown}
        />
        <StatCard
          label="Current savings"
          value={totals.savings}
          previous={previous?.savings}
          goodDirection="up"
          tone={totals.savings >= 0 ? 'text-pos' : 'text-neg'}
          icon={PiggyBank}
        />
        <StatCard
          label="Savings rate"
          value={totals.savings_rate}
          format="pct"
          hint={totals.savings_rate === null ? 'No income recorded this month' : 'Share of income kept'}
          icon={PiggyBank}
        />
        <StatCard
          label="Budget utilisation"
          value={budget.used_pct}
          format="pct"
          progress={budget.used_pct}
          hint={
            budget.limit
              ? `${money(budget.spent)} of ${money(budget.limit)}`
              : 'No overall budget set'
          }
          icon={Wallet}
        />
        <HealthTile
          score={data.health_score}
          band={data.health_band}
          provisional={data.health_provisional}
        />
        <StatCard
          label="Transactions"
          value={totals.transactions}
          format="raw"
          hint={`Recorded in ${data.month_label}`}
          icon={Receipt}
        />
        <StatCard
          label="Top category"
          value={data.category_breakdown[0]?.category ?? '—'}
          format="raw"
          hint={
            data.category_breakdown[0]
              ? `${money(data.category_breakdown[0].amount)} · ${pct(data.category_breakdown[0].share)} of spending`
              : 'No expenses yet'
          }
          icon={Lightbulb}
        />
      </div>

      {/* --- charts --- */}
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
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

function HealthTile({ score, band, provisional }) {
  const tone = score >= 65 ? 'text-pos' : score >= 50 ? 'text-warn' : 'text-neg'
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-wide muted">
          Financial health
        </p>
        <Stethoscope size={15} className="shrink-0 muted" />
      </div>
      <p className={`mt-1.5 text-xl font-semibold tnum ${tone}`}>
        {score}
        <span className="text-sm font-normal muted"> / 100</span>
      </p>
      <div className="mt-1 flex items-center gap-1.5">
        <span className="text-[11px] muted">{band}</span>
        {provisional && <Badge tone="warning">provisional</Badge>}
      </div>
      <ProgressBar
        className="mt-2.5"
        value={score}
        tone={score >= 65 ? 'positive' : score >= 50 ? 'warning' : 'negative'}
      />
      <Link to="/health" className="mt-2 inline-block text-[11px] text-brand-400 hover:underline">
        See the breakdown
      </Link>
    </Card>
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
