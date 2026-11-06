import {
  AlertTriangle,
  ArrowRight,
  Calculator,
  Calendar,
  CheckCircle2,
  CreditCard,
  Pencil,
  Percent,
  Plus,
  ShieldAlert,
  Sparkles,
  Trash2,
  TrendingDown,
  Zap,
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
  ProgressBar,
  Select,
  Spinner,
} from '../components/ui'
import { money, moneyExact } from '../format'

const DEBT_TYPES = [
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'personal_loan', label: 'Personal Loan' },
  { value: 'education_loan', label: 'Education Loan' },
  { value: 'home_loan', label: 'Home Loan' },
  { value: 'auto_loan', label: 'Vehicle Loan' },
  { value: 'other', label: 'Other Debt' },
]

export default function DebtPlanner() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [extraMonthly, setExtraMonthly] = useState(3000)

  const [editingDebt, setEditingDebt] = useState(null)
  const [deletingDebt, setDeletingDebt] = useState(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async (extra) => {
    try {
      const res = await api.get(`/api/debt?extra_monthly=${extra}`)
      setData(res)
      setError(null)
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(extraMonthly)
  }, [load, extraMonthly])

  async function handleSaveDebt(e) {
    e.preventDefault()
    setSaving(true)
    const form = new FormData(e.currentTarget)
    const payload = {
      name: form.get('name')?.toString().trim(),
      debt_type: form.get('debt_type'),
      current_balance: form.get('current_balance'),
      principal_amount: form.get('principal_amount') || form.get('current_balance'),
      interest_rate: form.get('interest_rate'),
      minimum_payment: form.get('minimum_payment'),
      due_day: form.get('due_day') || undefined,
      institution: form.get('institution')?.toString().trim() || undefined,
      notes: form.get('notes')?.toString().trim() || undefined,
    }

    try {
      if (editingDebt && editingDebt.id) {
        await api.put(`/api/debt/${editingDebt.id}`, payload)
      } else {
        await api.post('/api/debt', payload)
      }
      setEditingDebt(null)
      await load(extraMonthly)
    } catch (err) {
      alert(err.message || 'Failed to save debt record.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteDebt() {
    if (!deletingDebt) return
    setSaving(true)
    try {
      await api.del(`/api/debt/${deletingDebt.id}`)
      setDeletingDebt(null)
      await load(extraMonthly)
    } catch (err) {
      alert(err.message || 'Failed to delete debt record.')
    } finally {
      setSaving(false)
    }
  }

  if (loading && !data) return <Spinner label="Calculating debt repayment schedules" />
  if (error) return <ErrorState error={error} onRetry={() => load(extraMonthly)} />

  const { summary = {}, simulation = {}, debts = [] } = data || {}
  const { avalanche = {}, snowball = {}, baseline = {}, interest_saved = 0, months_saved = 0 } = simulation

  return (
    <div className="space-y-6">
      <PageHeader
        title="Debt Payoff & EMI Acceleration"
        subtitle="Mathematically optimized repayment schedules comparing Debt Avalanche and Debt Snowball strategies."
        action={
          <Button onClick={() => setEditingDebt('new')} className="gap-2">
            <Plus size={15} />
            <span>Add Debt</span>
          </Button>
        }
      />

      {/* Metric Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card className="p-4 border-l-2 border-l-neg">
          <p className="font-mono text-[11px] uppercase tracking-wider muted">Total Debt</p>
          <p className="mt-1 font-display text-2xl font-bold tracking-tight text-neg tnum">
            {money(summary.total_debt || 0)}
          </p>
          <p className="mt-1 text-[11px] muted">Across {summary.debt_count ?? 0} active loans</p>
        </Card>

        <Card className="p-4">
          <p className="font-mono text-[11px] uppercase tracking-wider muted">Monthly EMI</p>
          <p className="mt-1 font-display text-2xl font-bold tracking-tight text-ink-900 dark:text-white tnum">
            {money(summary.total_monthly_emi || 0)}
          </p>
          <p className="mt-1 text-[11px] muted">Required minimum commitment</p>
        </Card>

        <Card className="p-4">
          <p className="font-mono text-[11px] uppercase tracking-wider muted">Average APR</p>
          <p className="mt-1 font-display text-2xl font-bold tracking-tight text-ink-900 dark:text-white tnum">
            {summary.average_interest_rate ?? 0}%
          </p>
          <p className="mt-1 text-[11px] muted">Weighted by balance size</p>
        </Card>

        <Card className="p-4 bg-emerald-50/50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800/40">
          <p className="font-mono text-[11px] uppercase tracking-wider muted">Interest Saved</p>
          <p className="mt-1 font-display text-2xl font-bold tracking-tight text-pos tnum">
            {money(interest_saved)}
          </p>
          <p className="mt-1 text-[11px] muted">With +{money(extraMonthly)}/mo prepayment</p>
        </Card>
      </div>

      {/* Interactive Repayment Acceleration Simulator */}
      {debts.length > 0 && (
        <Card className="p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-ink-200/90 pb-4 dark:border-[#242421]">
            <div>
              <h3 className="text-sm font-semibold text-ink-900 dark:text-ink-100">
                Acceleration Prepayment Simulator
              </h3>
              <p className="text-xs muted mt-0.5">
                Adjust how much extra you can contribute each month beyond your minimum EMIs:
              </p>
            </div>
            <div className="font-mono text-base font-semibold text-pos">
              +{money(extraMonthly)}/mo
            </div>
          </div>

          <div className="mt-4">
            <input
              type="range"
              min="0"
              max="25000"
              step="500"
              value={extraMonthly}
              onChange={(e) => setExtraMonthly(Number(e.target.value))}
              className="w-full accent-ink-900 dark:accent-ink-100 cursor-pointer"
            />
            <div className="flex justify-between font-mono text-[10px] muted mt-1">
              <span>+₹0 (Minimums Only)</span>
              <span>+₹10,000/mo</span>
              <span>+₹25,000/mo</span>
            </div>
          </div>

          {/* Strategy Comparison Grid */}
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {/* Avalanche Card */}
            <div className="rounded-lg border-2 border-pos/50 bg-pos/5 p-4">
              <div className="flex items-center justify-between">
                <span className="font-medium text-ink-900 dark:text-ink-100 text-xs">
                  Debt Avalanche (Highest APR First)
                </span>
                <Badge tone="positive">Maximum Savings</Badge>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="font-display text-2xl font-bold tracking-tight text-ink-900 dark:text-white tnum">
                  {avalanche.months} months
                </span>
                <span className="text-xs muted">({avalanche.years} years)</span>
              </div>
              <p className="mt-1 text-xs text-ink-700 dark:text-ink-300">
                Total interest: <span className="font-mono font-medium">{money(avalanche.total_interest || 0)}</span>
              </p>
              {months_saved > 0 && (
                <p className="mt-2 text-[11px] font-medium text-pos">
                  ✓ Eliminates debt {months_saved} months faster and saves {money(interest_saved)} in interest.
                </p>
              )}
            </div>

            {/* Snowball Card */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/60 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium text-ink-900 dark:text-white text-xs">
                  Debt Snowball (Smallest Balance First)
                </span>
                <Badge tone="neutral">Behavioral Momentum</Badge>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="font-display text-2xl font-bold tracking-tight text-ink-900 dark:text-white tnum">
                  {snowball.months} months
                </span>
                <span className="text-xs muted">({snowball.years} years)</span>
              </div>
              <p className="mt-1 text-xs text-ink-700 dark:text-ink-300">
                Total interest: <span className="font-mono font-medium">{money(snowball.total_interest || 0)}</span>
              </p>
              <p className="mt-2 text-[11px] muted">
                Knocks out individual accounts rapidly to simplify your monthly obligations.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Debts Table */}
      <Card>
        <CardHeader
          title="Active Debts & Credit Accounts"
          subtitle={`${debts.length} outstanding accounts`}
        />

        {debts.length === 0 ? (
          <EmptyState
            icon={CreditCard}
            title="No debts recorded"
            body="You are currently completely debt-free. You can track credit cards and personal or educational loans here."
            action={
              <Button size="sm" onClick={() => setEditingDebt('new')}>
                Add a loan or credit card
              </Button>
            }
          />
        ) : (
          <div className="divide-y divide-ink-200/80 overflow-x-auto dark:divide-[#242421]">
            <table className="w-full text-left text-xs">
              <thead className="bg-ink-50/50 font-mono text-[10px] uppercase text-ink-500 dark:bg-[#121211] dark:text-ink-400">
                <tr>
                  <th className="px-5 py-3">Debt / Account</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Interest (APR)</th>
                  <th className="px-4 py-3">Current Balance</th>
                  <th className="px-4 py-3">Monthly EMI</th>
                  <th className="px-4 py-3">Due Day</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-200/60 font-sans dark:divide-[#1C1C1A]">
                {debts.map((debt) => (
                  <tr key={debt.id} className="hover:bg-ink-50/40 dark:hover:bg-[#161614] transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="font-medium text-ink-900 dark:text-ink-100">{debt.name}</div>
                      {debt.institution && (
                        <div className="mt-0.5 text-[11px] muted">{debt.institution}</div>
                      )}
                    </td>
                    <td className="px-4 py-3.5 capitalize text-ink-700 dark:text-ink-300">
                      {debt.debt_type.replace('_', ' ')}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-ink-900 dark:text-ink-100">
                      {debt.interest_rate}%
                    </td>
                    <td className="px-4 py-3.5 font-mono font-medium text-neg">
                      {money(debt.current_balance)}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-ink-900 dark:text-ink-100">
                      {money(debt.minimum_payment)}
                    </td>
                    <td className="px-4 py-3.5 text-ink-600 dark:text-ink-400">
                      {debt.due_day ? `${debt.due_day}th of month` : '—'}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setEditingDebt(debt)}
                          className="rounded p-1.5 text-ink-600 hover:bg-ink-100 hover:text-ink-900 dark:text-ink-400 dark:hover:bg-[#20201D]"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingDebt(debt)}
                          className="rounded p-1.5 text-ink-600 hover:bg-neg/15 hover:text-neg dark:text-ink-400"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Add / Edit Debt Modal */}
      <Modal
        open={Boolean(editingDebt)}
        onClose={() => setEditingDebt(null)}
        title={editingDebt?.id ? `Edit ${editingDebt.name}` : 'Add Debt / Loan'}
      >
        <form onSubmit={handleSaveDebt} className="space-y-4 p-5">
          <Field label="Debt / Account Name" required>
            <Input
              name="name"
              defaultValue={editingDebt?.name || ''}
              placeholder="e.g. HDFC Regalia Credit Card, SBI Education Loan"
              required
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Debt Type" required>
              <Select name="debt_type" defaultValue={editingDebt?.debt_type || 'credit_card'}>
                {DEBT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Annual Interest (APR %)" required>
              <Input
                name="interest_rate"
                type="number"
                step="0.1"
                min="0"
                max="100"
                defaultValue={editingDebt?.interest_rate ?? '12'}
                placeholder="12.0"
                required
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Current Outstanding Balance" required>
              <Input
                name="current_balance"
                type="number"
                step="0.01"
                min="0.01"
                defaultValue={editingDebt?.current_balance || ''}
                placeholder="0.00"
                required
              />
            </Field>

            <Field label="Monthly Minimum Payment (EMI)" required>
              <Input
                name="minimum_payment"
                type="number"
                step="0.01"
                min="0.01"
                defaultValue={editingDebt?.minimum_payment || ''}
                placeholder="0.00"
                required
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Lender / Bank">
              <Input
                name="institution"
                defaultValue={editingDebt?.institution || ''}
                placeholder="e.g. HDFC Bank, SBI, ICICI"
              />
            </Field>

            <Field label="Due Day (1-31)">
              <Input
                name="due_day"
                type="number"
                min="1"
                max="31"
                defaultValue={editingDebt?.due_day || ''}
                placeholder="e.g. 5"
              />
            </Field>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-ink-200/90 dark:border-[#242421]">
            <Button type="button" variant="ghost" onClick={() => setEditingDebt(null)}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              {editingDebt?.id ? 'Save Changes' : 'Record Debt'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        open={Boolean(deletingDebt)}
        onClose={() => setDeletingDebt(null)}
        title="Delete Debt Record"
      >
        <div className="space-y-4 p-5">
          <p className="text-sm text-ink-800 dark:text-ink-200">
            Are you sure you want to delete <strong className="text-ink-900 dark:text-white">{deletingDebt?.name}</strong>?
          </p>
          <div className="flex justify-end gap-2 pt-3 border-t border-ink-200/90 dark:border-[#242421]">
            <Button variant="ghost" onClick={() => setDeletingDebt(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDeleteDebt} loading={saving}>
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

