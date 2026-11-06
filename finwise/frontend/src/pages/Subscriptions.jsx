import {
  AlertTriangle,
  Calendar,
  CalendarClock,
  Check,
  CreditCard,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
} from 'lucide-react'
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
  PageHeader,
  Select,
  Spinner,
} from '../components/ui'
import { longDate, money, moneyExact, todayISO } from '../format'

const CYCLES = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'weekly', label: 'Weekly' },
]

const STATUS_OPTS = [
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'cancelled', label: 'Cancelled' },
]

export default function Subscriptions() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('all')

  // Modals state
  const [editing, setEditing] = useState(null) // null | 'new' | subscription object
  const [deleting, setDeleting] = useState(null)
  const [paying, setPaying] = useState(null)
  const [logTxnOnPay, setLogTxnOnPay] = useState(true)
  const [saving, setSaving] = useState(false)
  const [categories, setCategories] = useState([])
  const [paymentMethods, setPaymentMethods] = useState([])

  const load = useCallback(async () => {
    try {
      const [res, meta] = await Promise.all([
        api.get('/api/subscriptions'),
        api.get('/api/meta').catch(() => null),
      ])
      setData(res)
      if (meta?.categories) setCategories(meta.categories)
      if (meta?.payment_methods) setPaymentMethods(meta.payment_methods)
      setError(null)
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    const form = new FormData(e.currentTarget)
    const payload = {
      name: form.get('name')?.toString().trim(),
      amount: form.get('amount'),
      category: form.get('category'),
      billing_cycle: form.get('billing_cycle'),
      next_billing_date: form.get('next_billing_date'),
      payment_method: form.get('payment_method') || undefined,
      status: form.get('status') || 'active',
      notes: form.get('notes')?.toString().trim() || undefined,
    }

    try {
      if (editing && editing.id) {
        await api.put(`/api/subscriptions/${editing.id}`, payload)
      } else {
        await api.post('/api/subscriptions', payload)
      }
      setEditing(null)
      await load()
    } catch (err) {
      alert(err.message || 'Failed to save subscription.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleting) return
    setSaving(true)
    try {
      await api.del(`/api/subscriptions/${deleting.id}`)
      setDeleting(null)
      await load()
    } catch (err) {
      alert(err.message || 'Failed to delete subscription.')
    } finally {
      setSaving(false)
    }
  }

  async function handleMarkPaid() {
    if (!paying) return
    setSaving(true)
    try {
      await api.post(`/api/subscriptions/${paying.id}/mark-paid`, {
        log_transaction: logTxnOnPay,
      })
      setPaying(null)
      await load()
    } catch (err) {
      alert(err.message || 'Failed to advance subscription payment.')
    } finally {
      setSaving(false)
    }
  }

  async function handleAddSuggestion(suggestion) {
    const today = new Date()
    const nextDate = new Date(today.getFullYear(), today.getMonth() + 1, today.getDate())
      .toISOString()
      .slice(0, 10)

    try {
      await api.post('/api/subscriptions', {
        name: suggestion.name,
        amount: suggestion.amount,
        category: suggestion.category,
        billing_cycle: 'monthly',
        next_billing_date: nextDate,
        payment_method: suggestion.payment_method,
        status: 'active',
        notes: `Auto-detected from ${suggestion.occurrence_count} previous recurring transactions.`,
      })
      await load()
    } catch (err) {
      alert(err.message || 'Could not add detected subscription.')
    }
  }

  if (loading) return <Spinner label="Loading subscriptions & recurring bills" />
  if (error) return <ErrorState error={error} onRetry={load} />

  const { subscriptions = [], summary = {}, suggestions = [] } = data || {}

  const filteredSubs = subscriptions.filter((sub) => {
    if (filter === 'active') return sub.status === 'active'
    if (filter === 'paused') return sub.status === 'paused'
    return true
  })

  function getDaysUntil(dateString) {
    if (!dateString) return null
    const target = new Date(dateString)
    const today = new Date(todayISO())
    const diffTime = target - today
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Subscriptions & Bills"
        subtitle="Track recurring commitments, upcoming renewals, and detect hidden subscription spend."
        action={
          <Button onClick={() => setEditing('new')} className="gap-2">
            <Plus size={15} />
            <span>Add Subscription</span>
          </Button>
        }
      />

      {/* Metric Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card className="p-4">
          <p className="font-mono text-[11px] uppercase tracking-wider muted">Monthly Commitment</p>
          <p className="mt-1 font-serif text-2xl font-medium text-ink-900 dark:text-ink-100">
            {money(summary.total_monthly || 0)}
          </p>
          <p className="mt-1 text-[11px] muted">Normalized monthly run-rate</p>
        </Card>

        <Card className="p-4">
          <p className="font-mono text-[11px] uppercase tracking-wider muted">Annual Projected</p>
          <p className="mt-1 font-serif text-2xl font-medium text-ink-900 dark:text-ink-100">
            {money(summary.total_yearly || 0)}
          </p>
          <p className="mt-1 text-[11px] muted">Total 12-month projected spend</p>
        </Card>

        <Card className="p-4">
          <p className="font-mono text-[11px] uppercase tracking-wider muted">Active Services</p>
          <p className="mt-1 font-serif text-2xl font-medium text-ink-900 dark:text-ink-100">
            {summary.active_count ?? 0}
          </p>
          <p className="mt-1 text-[11px] muted">Across {summary.total_count ?? 0} total tracked</p>
        </Card>

        <Card className={`p-4 ${summary.due_soon_count > 0 ? 'border-warn/40 bg-warn/5' : ''}`}>
          <p className="font-mono text-[11px] uppercase tracking-wider muted">Due in 7 Days</p>
          <p className={`mt-1 font-serif text-2xl font-medium ${summary.due_soon_count > 0 ? 'text-warn' : 'text-ink-900 dark:text-ink-100'}`}>
            {summary.due_soon_count ?? 0}
          </p>
          <p className="mt-1 text-[11px] muted">Renewals requiring settlement</p>
        </Card>
      </div>

      {/* Smart Recurring Detection Banner */}
      {suggestions.length > 0 && (
        <Card className="p-4 bg-ink-50/60 dark:bg-[#141413]">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded border border-ink-200/80 bg-white p-1.5 text-ink-700 dark:border-[#2E2E2A] dark:bg-[#1A1A18] dark:text-ink-300">
                <RefreshCw size={14} />
              </div>
              <div>
                <h4 className="text-[13px] font-semibold text-ink-900 dark:text-ink-100">
                  Detected Recurring Charges
                </h4>
                <p className="mt-0.5 text-xs muted">
                  {suggestions.length} repeating payments found in your transactions. Add to your subscription schedule with one click:
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {suggestions.map((sug) => (
                    <div
                      key={sug.name}
                      className="flex items-center gap-2 rounded-md border border-ink-200/80 bg-white px-2.5 py-1.5 text-xs dark:border-[#2E2E2A] dark:bg-[#181816]"
                    >
                      <span className="font-medium text-ink-900 dark:text-ink-100">{sug.name}</span>
                      <span className="font-mono text-ink-600 dark:text-ink-400">
                        {moneyExact(sug.amount)}/mo
                      </span>
                      <Button
                        size="xs"
                        variant="secondary"
                        onClick={() => handleAddSuggestion(sug)}
                        className="ml-1 text-[10px]"
                      >
                        Track
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Subscriptions List Card */}
      <Card>
        <CardHeader
          title="Tracked Subscriptions"
          subtitle={`${filteredSubs.length} recurring obligation${filteredSubs.length === 1 ? '' : 's'}`}
          action={
            <div className="flex items-center gap-1">
              {['all', 'active', 'paused'].map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFilter(key)}
                  className={`rounded px-2.5 py-1 text-xs capitalize transition-colors ${
                    filter === key
                      ? 'bg-ink-900 text-[#F8F7F4] font-medium dark:bg-ink-100 dark:text-ink-900'
                      : 'text-ink-600 hover:bg-ink-100 dark:text-ink-400 dark:hover:bg-[#1C1C1A]'
                  }`}
                >
                  {key}
                </button>
              ))}
            </div>
          }
        />

        {filteredSubs.length === 0 ? (
          <EmptyState
            icon={CalendarClock}
            title="No subscriptions recorded"
            body="Keep track of recurring software, streaming services, utilities, and memberships so you never miss a renewal."
            action={
              <Button onClick={() => setEditing('new')} variant="secondary" size="sm">
                Add your first subscription
              </Button>
            }
          />
        ) : (
          <div className="divide-y divide-ink-200/90 overflow-x-auto dark:divide-[#242421]">
            <table className="w-full text-left text-xs">
              <thead className="bg-ink-50/50 font-mono text-[10px] uppercase text-ink-500 dark:bg-[#121211] dark:text-ink-400">
                <tr>
                  <th className="px-5 py-3">Subscription</th>
                  <th className="px-4 py-3">Cycle</th>
                  <th className="px-4 py-3">Cost</th>
                  <th className="px-4 py-3">Next Renewal</th>
                  <th className="px-4 py-3">Method</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-200/60 font-sans dark:divide-[#1C1C1A]">
                {filteredSubs.map((sub) => {
                  const days = getDaysUntil(sub.next_billing_date)
                  const isDueSoon = sub.status === 'active' && days !== null && days <= 7 && days >= 0
                  const isOverdue = sub.status === 'active' && days !== null && days < 0

                  return (
                    <tr key={sub.id} className="hover:bg-ink-50/40 dark:hover:bg-[#161614] transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="font-medium text-ink-900 dark:text-ink-100">{sub.name}</div>
                        <div className="mt-0.5 text-[11px] muted">{sub.category}</div>
                      </td>
                      <td className="px-4 py-3.5 capitalize text-ink-700 dark:text-ink-300">
                        {sub.billing_cycle}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="font-mono font-medium text-ink-900 dark:text-ink-100">
                          {money(sub.amount)}
                        </div>
                        {sub.billing_cycle !== 'monthly' && (
                          <div className="font-mono text-[10px] muted">
                            ~{money(sub.monthly_cost)}/mo
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="text-ink-900 dark:text-ink-100">
                          {longDate(sub.next_billing_date)}
                        </div>
                        {days !== null && (
                          <div className="mt-0.5">
                            {isOverdue ? (
                              <span className="inline-flex items-center gap-1 font-mono text-[10px] text-neg font-medium">
                                <AlertTriangle size={11} /> Overdue by {Math.abs(days)}d
                              </span>
                            ) : isDueSoon ? (
                              <span className="inline-flex items-center gap-1 font-mono text-[10px] text-warn font-medium">
                                <CalendarClock size={11} /> In {days === 0 ? 'today' : `${days}d`}
                              </span>
                            ) : (
                              <span className="font-mono text-[10px] muted">
                                In {days} days
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-ink-600 dark:text-ink-400">
                        {sub.payment_method || '—'}
                      </td>
                      <td className="px-4 py-3.5">
                        <Badge
                          variant={
                            sub.status === 'active'
                              ? 'positive'
                              : sub.status === 'paused'
                              ? 'warning'
                              : 'neutral'
                          }
                        >
                          {sub.status}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {sub.status === 'active' && (
                            <button
                              type="button"
                              onClick={() => setPaying(sub)}
                              title="Mark this cycle paid (advances date & records expense)"
                              className="rounded p-1.5 text-ink-600 hover:bg-pos/15 hover:text-pos dark:text-ink-400 transition-colors"
                            >
                              <Check size={14} />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setEditing(sub)}
                            title="Edit subscription"
                            className="rounded p-1.5 text-ink-600 hover:bg-ink-100 hover:text-ink-900 dark:text-ink-400 dark:hover:bg-[#20201D] transition-colors"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleting(sub)}
                            title="Delete subscription"
                            className="rounded p-1.5 text-ink-600 hover:bg-neg/15 hover:text-neg dark:text-ink-400 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Add / Edit Modal */}
      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing?.id ? `Edit ${editing.name}` : 'New Subscription'}
      >
        <form onSubmit={handleSave} className="space-y-4 p-5">
          <Field label="Service / Bill Name" required>
            <Input
              name="name"
              defaultValue={editing?.name || ''}
              placeholder="e.g. Netflix, Spotify, Broadband, Gym"
              required
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Amount" required>
              <Input
                name="amount"
                type="number"
                step="0.01"
                min="0.01"
                defaultValue={editing?.amount || ''}
                placeholder="0.00"
                required
              />
            </Field>

            <Field label="Billing Cycle" required>
              <Select name="billing_cycle" defaultValue={editing?.billing_cycle || 'monthly'}>
                {CYCLES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Category" required>
              <Select name="category" defaultValue={editing?.category || 'Entertainment'}>
                {categories.length > 0 ? (
                  categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))
                ) : (
                  <>
                    <option value="Entertainment">Entertainment</option>
                    <option value="Utilities">Utilities</option>
                    <option value="Healthcare">Healthcare</option>
                    <option value="Housing">Housing</option>
                    <option value="Shopping">Shopping</option>
                    <option value="Other">Other</option>
                  </>
                )}
              </Select>
            </Field>

            <Field label="Next Renewal Date" required>
              <Input
                name="next_billing_date"
                type="date"
                defaultValue={editing?.next_billing_date || todayISO()}
                required
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Payment Method">
              <Select name="payment_method" defaultValue={editing?.payment_method || ''}>
                <option value="">(None / Unknown)</option>
                {paymentMethods.length > 0 ? (
                  paymentMethods.map((pm) => (
                    <option key={pm} value={pm}>
                      {pm}
                    </option>
                  ))
                ) : (
                  <>
                    <option value="UPI">UPI</option>
                    <option value="Credit Card">Credit Card</option>
                    <option value="Debit Card">Debit Card</option>
                    <option value="Auto Debit">Auto Debit</option>
                    <option value="Net Banking">Net Banking</option>
                  </>
                )}
              </Select>
            </Field>

            <Field label="Status">
              <Select name="status" defaultValue={editing?.status || 'active'}>
                {STATUS_OPTS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field label="Notes (optional)">
            <Input
              name="notes"
              defaultValue={editing?.notes || ''}
              placeholder="e.g. Shared family plan, renewal reminders"
            />
          </Field>

          <div className="flex justify-end gap-2 pt-3 border-t border-ink-200/90 dark:border-[#242421]">
            <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              {editing?.id ? 'Save Changes' : 'Create Subscription'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Mark Paid Confirmation Modal */}
      <Modal
        open={Boolean(paying)}
        onClose={() => setPaying(null)}
        title="Mark Subscription Cycle as Paid"
      >
        <div className="space-y-4 p-5">
          <p className="text-sm text-ink-800 dark:text-ink-200">
            Advance next renewal date for <span className="font-semibold text-ink-900 dark:text-white">{paying?.name}</span> by one {paying?.billing_cycle} cycle?
          </p>

          <div className="rounded-md border border-ink-200/90 bg-ink-50/50 p-3.5 dark:border-[#2E2E2A] dark:bg-[#121211]">
            <label className="flex items-start gap-2.5 cursor-pointer text-xs">
              <input
                type="checkbox"
                checked={logTxnOnPay}
                onChange={(e) => setLogTxnOnPay(e.target.checked)}
                className="mt-0.5 rounded border-ink-300 text-ink-900 dark:border-[#383834]"
              />
              <div>
                <span className="font-medium text-ink-900 dark:text-ink-100">
                  Record expense transaction in ledger ({money(paying?.amount || 0)})
                </span>
                <p className="mt-0.5 text-[11px] muted">
                  Automatically adds an expense entry dated today under &quot;{paying?.category}&quot;.
                </p>
              </div>
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-ink-200/90 dark:border-[#242421]">
            <Button variant="ghost" onClick={() => setPaying(null)}>
              Cancel
            </Button>
            <Button onClick={handleMarkPaid} loading={saving} className="gap-1.5">
              <Check size={14} />
              <span>Confirm & Advance</span>
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title="Delete Subscription"
      >
        <div className="space-y-4 p-5">
          <p className="text-sm text-ink-800 dark:text-ink-200">
            Are you sure you want to stop tracking{' '}
            <strong className="text-ink-900 dark:text-white">{deleting?.name}</strong>?
            Existing transactions in your ledger will not be affected.
          </p>
          <div className="flex justify-end gap-2 pt-3 border-t border-ink-200/90 dark:border-[#242421]">
            <Button variant="ghost" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete} loading={saving}>
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

