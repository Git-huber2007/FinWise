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
  ProgressBar,
  Spinner,
} from '../components/ui'
import { longDate, money, moneyExact, todayISO } from '../format'

/**
 * Savings Goals.
 *
 * Every date on this page is a projection from the user's own savings history,
 * and is labelled as such. The forecast card shows which method produced the
 * number -- a two-month average and a fitted trend are not the same claim, and
 * showing one figure for both would hide that.
 */
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
      // Both calls, then one state update: a half-rendered page where the
      // goals have loaded but the rate they are projected from has not shows
      // ETAs that change under the user a moment later.
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
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display text-2xl">Savings Goals</h1>
          <p className="mt-1 text-sm muted">
            What you are saving for, and when your own savings rate would get you there
          </p>
        </div>
        <Button onClick={() => setEditing({})}>
          <Plus size={15} /> New goal
        </Button>
      </div>

      <Forecast forecast={forecast} />

      {active.length === 0 ? (
        <Card className="mt-5">
          <EmptyState
            icon={Target}
            title="No savings goals yet"
            body="Add a goal and FINWISE will estimate when you would reach it, based on what you actually save each month."
            action={
              <Button onClick={() => setEditing({})}>
                <Plus size={15} /> New goal
              </Button>
            }
          />
        </Card>
      ) : (
        <>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
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
  if (!forecast) return null

  if (forecast.method === 'insufficient_data') {
    return (
      <Card>
        <CardHeader title="Savings forecast" subtitle={forecast.method_label} />
        <div className="p-5 pt-0">
          <p className="text-sm muted">{forecast.explanation}</p>
        </div>
      </Card>
    )
  }

  // History and forecast on one axis, with the join marked. Two separate
  // charts would let the user read the forecast as more of the same kind of
  // data as the history, which is exactly the confusion to avoid.
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
    // Give the last real month an `estimate` value too, so the dashed line
    // starts where the solid one ends instead of floating in space.
    series[history.length - 1] = { ...lastActual, estimate: lastActual.actual }
  }

  return (
    <Card>
      <CardHeader
        title="Savings forecast"
        subtitle={forecast.method_label}
        action={
          <Badge tone={CONFIDENCE_TONE[forecast.confidence] ?? 'neutral'}>
            {forecast.confidence} confidence
          </Badge>
        }
      />
      <div className="grid gap-5 p-5 pt-0 lg:grid-cols-[minmax(0,1fr)_260px]">
        {/* h-full so the chart grows to match the taller text column beside
            it rather than leaving dead space under itself. min-h keeps it
            readable once the two stack on a narrow screen. */}
        <div className="h-full min-h-[14rem] min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-ink-200 dark:stroke-ink-800" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => money(v)} width={70} />
              <Tooltip
                formatter={(value, name) => [
                  moneyExact(value),
                  name === 'actual' ? 'Saved' : 'Estimate',
                ]}
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
              />
              <ReferenceLine y={0} className="stroke-ink-300 dark:stroke-ink-700" />
              <Line
                type="monotone"
                dataKey="actual"
                stroke="#6366f1"
                strokeWidth={2}
                dot={{ r: 2 }}
                name="actual"
              />
              <Line
                type="monotone"
                dataKey="estimate"
                stroke="#6366f1"
                strokeWidth={2}
                strokeDasharray="5 4"
                dot={{ r: 2 }}
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
          <p className="border-t border-ink-200 pt-3 text-xs leading-relaxed muted dark:border-ink-800">
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
      <p className="mt-0.5 font-semibold tnum">{value}</p>
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
          <h3 className="flex items-center gap-2 truncate font-medium">
            {done && <Check size={15} className="shrink-0 text-pos" />}
            {goal.name}
          </h3>
          <p className="mt-0.5 text-xs muted">
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
        <p className="mt-1.5 flex justify-between text-[11px] muted tnum">
          <span>{goal.progress_pct}% saved</span>
          <span>{moneyExact(goal.remaining)} to go</span>
        </p>
      </div>

      {!done && (
        <div className="mx-5 mt-4 rounded-lg bg-ink-100/70 p-3 dark:bg-ink-800/40">
          <p className="flex items-center gap-1.5 text-xs font-medium">
            <CalendarClock size={13} className="shrink-0 text-brand-400" />
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
