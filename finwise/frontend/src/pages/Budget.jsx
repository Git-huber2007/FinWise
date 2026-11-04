import { AlertTriangle, Pencil, Plus, Target, Trash2, Wallet } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import { api } from '../api'
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Modal,
  ProgressBar,
  Select,
  Spinner,
} from '../components/ui'
import { money, moneyExact } from '../format'

/**
 * Budget Planner.
 *
 * Utilisation comes from the server, computed by the same function that feeds
 * the dashboard alerts, the health score and the PDF. The page deliberately
 * does not divide spent by limit itself: a second implementation of the one
 * number this page exists to show is how two screens start disagreeing.
 */
export default function Budget() {
  const [month, setMonth] = useState(null)
  const [months, setMonths] = useState([])
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)

  const load = useCallback(async (requested) => {
    setError(null)
    try {
      const budgets = await api.get(
        `/api/budgets${requested ? `?month=${requested}` : ''}`,
      )
      setData(budgets)
      setMonth(budgets.month)
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(null)
  }, [load])

  // The month list lives on the reports endpoint, which already derives it
  // from the transaction history. Fetched once; budgets can be set for a month
  // with no transactions yet, so the current month is merged in below.
  useEffect(() => {
    api
      .get('/api/reports/monthly')
      .then((report) => setMonths(report.meta.available_months))
      .catch(() => {})
  }, [])

  if (loading) return <Spinner label="Loading your budgets" />
  if (error && !data) return <ErrorState error={error} onRetry={() => load(month)} />

  const options = [...months]
  if (month && !options.some((o) => o.month === month)) {
    options.unshift({ month, label: data.month_label })
  }

  const perCategory = data.budgets.filter((b) => !b.is_overall)
  const nothingSet = data.budgets.length === 0

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display text-2xl">Budget Planner</h1>
          <p className="mt-1 text-sm muted">
            What you planned to spend, against what you actually did
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={month ?? ''}
            onChange={(event) => load(event.target.value)}
            aria-label="Budget month"
            className="w-auto"
          >
            {options.map((option) => (
              <option key={option.month} value={option.month}>
                {option.label}
              </option>
            ))}
          </Select>
          <Button onClick={() => setEditing({})}>
            <Plus size={15} /> New budget
          </Button>
        </div>
      </div>

      {data.partial_month && (
        <p className="mb-5 text-xs muted">
          {data.month_label} is still in progress, so spending will keep rising against
          these limits.
        </p>
      )}

      {nothingSet ? (
        <Card>
          <EmptyState
            icon={Wallet}
            title={`No budgets set for ${data.month_label}`}
            body="Set a monthly limit overall or per category, and FINWISE will track your spending against it here, on the dashboard and in your reports."
            action={
              <Button onClick={() => setEditing({})}>
                <Plus size={15} /> Set your first budget
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="space-y-5">
          {data.overall && (
            <OverallCard
              budget={data.overall}
              warnAt={data.warn_at_pct}
              onEdit={() => setEditing(data.overall)}
              onDelete={() => setDeleting(data.overall)}
            />
          )}

          {perCategory.length > 0 && (
            <div className="grid gap-4 md:grid-cols-2">
              {perCategory.map((budget) => (
                <BudgetCard
                  key={budget.id}
                  budget={budget}
                  warnAt={data.warn_at_pct}
                  onEdit={() => setEditing(budget)}
                  onDelete={() => setDeleting(budget)}
                />
              ))}
            </div>
          )}

          {!data.has_overall && (
            <Card className="p-4">
              <p className="text-sm">
                No overall monthly budget set.{' '}
                <button
                  onClick={() => setEditing({ category: 'overall' })}
                  className="text-brand-400 hover:underline"
                >
                  Set one
                </button>{' '}
                <span className="muted">
                  to track total spending, not just the categories below.
                </span>
              </p>
            </Card>
          )}
        </div>
      )}

      {data.unbudgeted.length > 0 && (
        <Card className="mt-5">
          <CardHeader
            title="Spending with no budget"
            subtitle="These categories are not counted against any category limit"
          />
          <ul className="divide-y divide-ink-200 dark:divide-ink-800">
            {data.unbudgeted.map((item) => (
              <li
                key={item.category}
                className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm"
              >
                <span>
                  {item.category}{' '}
                  <span className="muted tnum">{moneyExact(item.spent)} this month</span>
                </span>
                <Button
                  variant="ghost"
                  onClick={() =>
                    setEditing({
                      category: item.category,
                      amount: data.typical[item.category] ?? '',
                    })
                  }
                >
                  <Plus size={14} /> Set a budget
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing?.id ? 'Edit budget' : 'New budget'}
      >
        {editing && (
          <BudgetForm
            budget={editing}
            data={data}
            month={month}
            onCancel={() => setEditing(null)}
            onSaved={() => {
              setEditing(null)
              load(month)
            }}
          />
        )}
      </Modal>

      <Modal
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title="Delete this budget?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                await api.del(`/api/budgets/${deleting.id}`)
                setDeleting(null)
                load(month)
              }}
            >
              Delete budget
            </Button>
          </>
        }
      >
        <p className="text-sm">
          The <strong>{deleting?.category ?? 'overall'}</strong> budget for{' '}
          {data.month_label} will be removed. Your transactions are not affected.
        </p>
      </Modal>
    </>
  )
}

function toneFor(status) {
  return status === 'over' ? 'negative' : status === 'warning' ? 'warning' : 'positive'
}

function statusLabel(budget, warnAt) {
  if (budget.status === 'over') return `Over by ${money(Math.abs(budget.remaining))}`
  if (budget.status === 'warning') return `${warnAt}%+ used`
  return `${money(budget.remaining)} left`
}

function OverallCard({ budget, warnAt, onEdit, onDelete }) {
  const tone = toneFor(budget.status)
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3 p-5 pb-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-medium">
            <Target size={15} className="text-brand-400" /> Overall monthly budget
          </p>
          <p className="mt-1 text-2xl font-semibold tnum">
            {moneyExact(budget.spent)}{' '}
            <span className="text-base font-normal muted">
              of {moneyExact(budget.amount)}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={tone}>{statusLabel(budget, warnAt)}</Badge>
          <Button variant="ghost" onClick={onEdit} aria-label="Edit overall budget">
            <Pencil size={14} />
          </Button>
          <Button variant="ghost" onClick={onDelete} aria-label="Delete overall budget">
            <Trash2 size={14} />
          </Button>
        </div>
      </div>
      <div className="px-5 pb-5">
        <ProgressBar value={budget.used_pct} tone={tone} />
        <p className="mt-1.5 text-[11px] muted tnum">{budget.used_pct}% used</p>
      </div>
    </Card>
  )
}

function BudgetCard({ budget, warnAt, onEdit, onDelete }) {
  const tone = toneFor(budget.status)
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-medium">{budget.category}</h3>
          <p className="mt-0.5 text-sm tnum">
            {moneyExact(budget.spent)}{' '}
            <span className="muted">of {moneyExact(budget.amount)}</span>
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button variant="ghost" onClick={onEdit} aria-label={`Edit ${budget.category} budget`}>
            <Pencil size={14} />
          </Button>
          <Button
            variant="ghost"
            onClick={onDelete}
            aria-label={`Delete ${budget.category} budget`}
          >
            <Trash2 size={14} />
          </Button>
        </div>
      </div>

      <ProgressBar className="mt-3" value={budget.used_pct} tone={tone} />
      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-[11px]">
        <span className="muted tnum">{budget.used_pct}% used</span>
        <span
          className={
            budget.status === 'over'
              ? 'text-neg'
              : budget.status === 'warning'
                ? 'text-warn'
                : 'muted'
          }
        >
          {budget.status === 'over' && <AlertTriangle size={11} className="mr-1 inline" />}
          {statusLabel(budget, warnAt)}
        </span>
      </div>
    </Card>
  )
}

function BudgetForm({ budget, data, month, onCancel, onSaved }) {
  const isEdit = Boolean(budget.id)
  const [category, setCategory] = useState(
    budget.is_overall ? 'overall' : (budget.category ?? 'overall'),
  )
  const [amount, setAmount] = useState(budget.amount ?? '')
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  const suggestion = category !== 'overall' ? data.typical[category] : null
  // The category being edited is not in available_categories (it is taken, by
  // this budget), so it has to be added back or the select shows the wrong one.
  const choices = [
    ...(isEdit && !budget.is_overall ? [budget.category] : []),
    ...data.available_categories,
  ]

  async function submit(event) {
    event.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const [year, monthNumber] = month.split('-').map(Number)
      const body = {
        category: category === 'overall' ? null : category,
        amount,
        month: monthNumber,
        year,
      }
      if (isEdit) await api.put(`/api/budgets/${budget.id}`, body)
      else await api.post('/api/budgets', body)
      onSaved()
    } catch (err) {
      setError(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Budget for" required error={error?.field === 'category' && error.message}>
        <Select
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          disabled={isEdit && budget.is_overall}
        >
          {(!data.has_overall || (isEdit && budget.is_overall)) && (
            <option value="overall">Overall monthly spending</option>
          )}
          {choices.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </Select>
      </Field>

      <Field
        label="Monthly limit (₹)"
        required
        hint={
          suggestion
            ? `You spent about ${moneyExact(suggestion)} a month on ${category} recently.`
            : 'Applies to this month only.'
        }
        error={error?.field === 'amount' && error.message}
      >
        <Input
          type="number"
          min="1"
          step="0.01"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          placeholder={suggestion ? String(Math.round(suggestion)) : '5000'}
          required
          autoFocus
        />
      </Field>

      {suggestion && !isEdit && (
        <button
          type="button"
          onClick={() => setAmount(String(Math.round(suggestion)))}
          className="text-xs text-brand-400 hover:underline"
        >
          Use my recent average ({moneyExact(suggestion)})
        </button>
      )}

      {error && !error.field && <p className="text-xs text-neg">{error.message}</p>}

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={saving}>
          {isEdit ? 'Save changes' : 'Create budget'}
        </Button>
      </div>
    </form>
  )
}
