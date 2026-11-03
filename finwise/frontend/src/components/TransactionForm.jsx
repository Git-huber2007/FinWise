import { useEffect, useState } from 'react'

import { api } from '../api'
import { todayISO } from '../format'
import { Button, Field, Input, Select } from './ui'

const BLANK = {
  description: '',
  amount: '',
  category: '',
  txn_type: 'expense',
  date: todayISO(),
  payment_method: 'UPI',
  notes: '',
}

/**
 * Add/edit form. Phase 5 adds the AI category suggestion to the description
 * field; the `ai_category` / `ai_confidence` fields are already carried through
 * so that change touches only this file.
 */
export default function TransactionForm({ meta, initial, onSaved, onCancel }) {
  const editing = Boolean(initial?.id)
  const [form, setForm] = useState(BLANK)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setForm(
      initial
        ? {
            description: initial.description ?? '',
            amount: initial.amount ?? '',
            category: initial.category ?? '',
            txn_type: initial.txn_type ?? 'expense',
            date: initial.date ?? todayISO(),
            payment_method: initial.payment_method ?? 'UPI',
            notes: initial.notes ?? '',
          }
        : BLANK,
    )
    setError(null)
  }, [initial])

  const set = (key) => (event) => setForm((f) => ({ ...f, [key]: event.target.value }))
  const fieldError = (key) => (error?.field === key ? error.message : null)

  async function onSubmit(event) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    const payload = { ...form, amount: Number(form.amount) }
    try {
      const saved = editing
        ? await api.put(`/api/transactions/${initial.id}`, payload)
        : await api.post('/api/transactions', payload)
      onSaved(saved)
      if (!editing) setForm({ ...BLANK, date: form.date })
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <Field label="Description" required error={fieldError('description')}>
        <Input
          autoFocus
          required
          value={form.description}
          onChange={set('description')}
          placeholder="Swiggy food order"
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Amount (₹)" required error={fieldError('amount')}>
          <Input
            type="number"
            min="0.01"
            step="0.01"
            required
            value={form.amount}
            onChange={set('amount')}
            placeholder="350"
          />
        </Field>

        <Field label="Type" required error={fieldError('txn_type')}>
          <Select value={form.txn_type} onChange={set('txn_type')}>
            {(meta?.txn_types ?? ['expense', 'income']).map((t) => (
              <option key={t} value={t}>
                {t === 'income' ? 'Income' : 'Expense'}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Category" required error={fieldError('category')}>
          <Select required value={form.category} onChange={set('category')}>
            <option value="">Select…</option>
            {(meta?.categories ?? []).map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Date" required error={fieldError('date')}>
          <Input type="date" required value={form.date} onChange={set('date')} />
        </Field>
      </div>

      <Field label="Payment method" error={fieldError('payment_method')}>
        <Select value={form.payment_method} onChange={set('payment_method')}>
          {(meta?.payment_methods ?? []).map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Notes" error={fieldError('notes')}>
        <textarea
          rows={2}
          value={form.notes}
          onChange={set('notes')}
          placeholder="Optional"
          className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm
            placeholder:text-ink-400 focus:border-brand-500 dark:border-ink-800 dark:bg-ink-950"
        />
      </Field>

      {error && !error.field && (
        <p role="alert" className="rounded-lg bg-neg/10 px-3 py-2 text-xs text-neg">
          {error.message}
        </p>
      )}

      <div className="flex justify-end gap-2 pt-1">
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" loading={busy}>
          {editing ? 'Save changes' : 'Add transaction'}
        </Button>
      </div>
    </form>
  )
}
