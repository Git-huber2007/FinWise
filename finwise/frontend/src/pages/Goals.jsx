import {
  CalendarClock,
  Check,
  Pencil,
  Plus,
  Target,
  Trash2,
  TrendingUp,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { api } from '../api'
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  EstimateNote,
  Field,
  Input,
  Modal,
  PageHeader,
  ProgressBar,
  Spinner,
} from '../components/ui'
import { longDate, money, moneyExact, todayISO } from '../format'
import { useTheme } from '../theme'

export default function Goals() {
  const [data, setData] = useState(null)
  const [forecast, setForecast] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [contributing, setContributing] = useState(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const [goals, prediction] = await Promise.all([
        api.get('/api/goals'),
        api.post('/api/ai/predict-savings', { horizon: 6 }),
      ])
      setData(goals)
      setForecast(prediction)
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (loading) return <Spinner label="Loading your goals" />
  if (error) return <ErrorState error={error} onRetry={load} />

  const goals = data?.goals ?? []
  const active = goals.filter((g) => g.status !== 'archived')

  return (
    <>
      <PageHeader
        title="Savings Goals"
        subtitle="Capital targets and completion dates projected from your historical net savings rate"
        action={
          <Button onClick={() => setEditing({})}>
            <Plus size={14} /> New goal
          </Button>
        }
      />

      <Forecast forecast={forecast} />

      {active.length === 0 ? (
        <Card className="mt-6">
          <EmptyState
            icon={Target}
            title="No savings goals yet"
            body="Add a target and the ledger will estimate completion based on your recorded monthly net savings."
            action={
              <Button onClick={() => setEditing({})}>
                <Plus size={14} /> New goal
              </Button>
            }
          />
        </Card>
      ) : (
        <>
          <div className="mt-6 grid gap-5 md:grid-cols-2">
            {active.map((goal) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                onEdit={() => setEditing(goal)}
                onDelete={() => setDeleting(goal)}
                onContribute={() => setContributing(goal)}
              />
            ))}
          </div>

          {data.shared_rate_note && <EstimateNote>{data.shared_rate_note}</EstimateNote>}
        </>
      )}

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing?.id ? 'Edit goal' : 'New savings goal'}
      >
        {editing && (
          <GoalForm
            goal={editing}
            onCancel={() => setEditing(null)}
            onSaved={() => {
              setEditing(null)
              load()
            }}
          />
        )}
      </Modal>

      <Modal
        open={Boolean(contributing)}
        onClose={() => setContributing(null)}
        title={`Add to ${contributing?.name ?? 'goal'}`}
      >
        {contributing && (
          <ContributeForm
            goal={contributing}
            onCancel={() => setContributing(null)}
            onSaved={() => {
              setContributing(null)
              load()
            }}
          />
        )}
      </Modal>

      <Modal
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title="Delete this goal?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                await api.del(`/api/goals/${deleting.id}`)
                setDeleting(null)
                load()
              }}
            >
              Delete goal
            </Button>
          </>
        }
      >
        <p className="text-sm">
          <strong>{deleting?.name}</strong> will be removed. Your transactions are not
          affected.
        </p>
      </Modal>
    </>
  )
}

const CONFIDENCE_TONE = { moderate: 'brand', low: 'warning', none: 'neutral' }

function Forecast({ forecast }) {
  const { dark } = useTheme()
  if (!forecast) return null

  if (forecast.method === 'insufficient_data') {
    return (
      <Card>
        <CardHeader title="Savings trajectory" subtitle={forecast.method_label} />
        <div className="p-5 pt-0">
          <p className="text-sm muted">{forecast.explanation}</p>
        </div>
      </Card>
    )
  }

  const history = (forecast.history ?? []).map((m) => ({
    label: m.label,
    actual: m.savings,
  }))
  const projected = (forecast.predictions ?? []).map((p) => ({
    label: p.label,
    estimate: p.predicted_savings,
  }))
  const series = [...history, ...projected]
  const lastActual = history[history.length - 1]
  if (lastActual) {
    series[history.length - 1] = { ...lastActual, estimate: lastActual.actual }
  }

  const lineInk = dark ? '#F1EFEA' : '#181816'

  return (
    <Card>
      <CardHeader
        title="Savings trajectory"
        subtitle={forecast.method_label}
        action={
          <Badge tone={CONFIDENCE_TONE[forecast.confidence] ?? 'neutral'}>
            {forecast.confidence} confidence
          </Badge>
        }
      />
      <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="h-full min-h-[14rem] min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid
                strokeDasharray="2 4"
                vertical={false}
                stroke={dark ? '#222220' : '#E6E4DD'}
              />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: dark ? '#8C8980' : '#6E6B63', fontFamily: 'Geist Mono' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: dark ? '#8C8980' : '#6E6B63', fontFamily: 'Geist Mono' }}
                tickFormatter={(v) => money(v)}
                width={70}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                formatter={(value, name) => [
                  moneyExact(value),
                  name === 'actual' ? 'Saved' : 'Estimate',
                ]}
                contentStyle={{
                  fontSize: 12,
                  borderRadius: 6,
                  border: dark ? '1px solid #2A2A27' : '1px solid #E4E2DC',
                  backgroundColor: dark ? '#181816' : '#FFFFFF',
                }}
              />
              <ReferenceLine y={0} stroke={dark ? '#2E2E2B' : '#D5D2C8'} />
              <Line
                type="monotone"
                dataKey="actual"
                stroke={lineInk}
                strokeWidth={1.75}
                dot={{ r: 2.5, fill: lineInk }}
                name="actual"
              />
              <Line
                type="monotone"
                dataKey="estimate"
                stroke="#15803D"
                strokeWidth={1.75}
                strokeDasharray="4 4"
                dot={{ r: 2.5, fill: '#15803D' }}
                name="estimate"
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="space-y-3 text-sm">
          <Figure
            icon={TrendingUp}
            label="Estimated next month"
            value={moneyExact(forecast.predicted_next)}
          />
          <Figure label="Your monthly average" value={moneyExact(forecast.average_savings)} />
          <Figure
            label="Month-to-month swing"
            value={`± ${moneyExact(forecast.volatility)}`}
            hint="Standard deviation of your complete months"
          />
          <Figure
            label="Complete months used"
            value={String(forecast.months_of_history)}
            hint="The in-progress month is excluded"
          />
          <p className="border-t border-ink-200 pt-3 text-xs leading-relaxed muted dark:border-[#222220]">
            {forecast.explanation}
          </p>
        </div>
      </div>
      <div className="px-5 pb-5">
        <EstimateNote>{forecast.disclaimer}</EstimateNote>
      </div>
    </Card>
  )
}

function Figure({ icon: Icon, label, value, hint }) {
  return (
    <div>
      <p className="flex items-center gap-1.5 text-xs muted">
        {Icon && <Icon size={12} />} {label}
      </p>
      <p className="mt-0.5 font-mono text-sm font-medium text-ink-900 dark:text-ink-100 tnum">{value}</p>
      {hint && <p className="text-[11px] muted">{hint}</p>}
    </div>
  )
}

const STATUS_BADGE = {
  achieved: { tone: 'positive', text: 'Achieved' },
  on_track: { tone: 'brand', text: 'On track' },
  behind: { tone: 'warning', text: 'Behind target date' },
  stalled: { tone: 'neutral', text: 'No estimate' },
}

function GoalCard({ goal, onEdit, onDelete, onContribute }) {
  const projection = goal.projection ?? {}
  const badge = STATUS_BADGE[projection.status] ?? STATUS_BADGE.stalled
  const done = goal.status === 'achieved'

  return (
    <Card className="flex flex-col">
      <div className="flex items-start justify-between gap-3 p-5 pb-3">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 truncate text-sm font-medium text-ink-900 dark:text-ink-100">
            {done && <Check size={14} className="shrink-0 text-pos" />}
            {goal.name}
          </h3>
          <p className="mt-0.5 font-mono text-xs muted">
            {moneyExact(goal.saved_amount)} of {moneyExact(goal.target_amount)}
            {goal.target_date && <> · target {longDate(goal.target_date)}</>}
          </p>
        </div>
        <Badge tone={done ? 'positive' : badge.tone}>{done ? 'Achieved' : badge.text}</Badge>
      </div>

      <div className="px-5">
        <ProgressBar
          value={goal.progress_pct}
          tone={done ? 'positive' : projection.status === 'behind' ? 'warning' : 'brand'}
        />
        <p className="mt-1.5 flex justify-between font-mono text-[11px] muted tnum">
          <span>{goal.progress_pct}% saved</span>
          <span>{moneyExact(goal.remaining)} remaining</span>
        </p>
      </div>

      {!done && (
        <div className="mx-5 mt-4 rounded-md border border-ink-200 bg-ink-50/70 p-3 dark:border-[#222220] dark:bg-[#181816]">
          <p className="flex items-center gap-1.5 text-xs font-medium text-ink-900 dark:text-ink-100">
            <CalendarClock size={13} className="shrink-0 text-ink-500" />
            {projection.eta_label ? (
              <>Estimated completion: {projection.eta_label}</>
            ) : (
              <>No completion estimate</>
            )}
          </p>
          <p className="mt-1 text-[11px] leading-relaxed muted">{projection.note}</p>
        </div>
      )}

      <div className="mt-auto flex gap-2 p-5 pt-4">
        {!done && (
          <Button variant="secondary" onClick={onContribute}>
            <Plus size={14} /> Add savings
          </Button>
        )}
        <Button variant="ghost" onClick={onEdit} aria-label={`Edit ${goal.name}`}>
          <Pencil size={14} />
        </Button>
        <Button variant="ghost" onClick={onDelete} aria-label={`Delete ${goal.name}`}>
          <Trash2 size={14} />
        </Button>
      </div>
    </Card>
  )
}

function GoalForm({ goal, onCancel, onSaved }) {
  const [form, setForm] = useState({
    name: goal.name ?? '',
    target_amount: goal.target_amount ?? '',
    saved_amount: goal.saved_amount ?? '',
    target_date: goal.target_date ?? '',
  })
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  const set = (key) => (event) => setForm((f) => ({ ...f, [key]: event.target.value }))

  async function submit(event) {
    event.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const body = {
        name: form.name,
        target_amount: form.target_amount,
        saved_amount: form.saved_amount === '' ? 0 : form.saved_amount,
        target_date: form.target_date || null,
      }
      if (goal.id) await api.put(`/api/goals/${goal.id}`, body)
      else await api.post('/api/goals', body)
      onSaved()
    } catch (err) {
      setError(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="What are you saving for?" required error={error?.field === 'name' && error.message}>
        <Input
          value={form.name}
          onChange={set('name')}
          placeholder="New laptop for college"
          required
          autoFocus
          maxLength={120}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Target amount (₹)" required
          error={error?.field === 'target_amount' && error.message}>
          <Input
            type="number"
            min="1"
            step="0.01"
            value={form.target_amount}
            onChange={set('target_amount')}
            placeholder="60000"
            required
          />
        </Field>
        <Field label="Already saved (₹)"
          error={error?.field === 'saved_amount' && error.message}>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={form.saved_amount}
            onChange={set('saved_amount')}
            placeholder="0"
          />
        </Field>
      </div>

      <Field label="Target date" hint="Optional. Used only to tell you if you are behind.">
        <Input type="date" min={todayISO()} value={form.target_date} onChange={set('target_date')} />
      </Field>

      {error && !error.field && <p className="text-xs text-neg">{error.message}</p>}

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={saving}>
          {goal.id ? 'Save changes' : 'Create goal'}
        </Button>
      </div>
    </form>
  )
}

function ContributeForm({ goal, onCancel, onSaved }) {
  const [amount, setAmount] = useState('')
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  async function submit(event) {
    event.preventDefault()
    setError(null)
    setSaving(true)
    try {
      await api.post(`/api/goals/${goal.id}/contribute`, { amount })
      onSaved()
    } catch (err) {
      setError(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-sm muted">
        {moneyExact(goal.remaining)} left of {moneyExact(goal.target_amount)}.
      </p>
      <Field label="Amount to add (₹)" required error={error?.field === 'amount' && error.message}>
        <Input
          type="number"
          min="0.01"
          step="0.01"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          placeholder="2000"
          required
          autoFocus
        />
      </Field>
      {error && !error.field && <p className="text-xs text-neg">{error.message}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={saving}>
          Add to goal
        </Button>
      </div>
    </form>
  )
}
