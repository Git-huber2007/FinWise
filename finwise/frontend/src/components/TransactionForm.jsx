import { Check, Loader2, Tag } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { api } from '../api'
import { todayISO } from '../format'
import { Badge, Button, Field, Input, Select } from './ui'

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

  // --- AI category suggestion -------------------------------------------
  const [suggestion, setSuggestion] = useState(null)
  const [predicting, setPredicting] = useState(false)
  // The prediction the user accepted, so we can tell the backend whether the
  // saved category was the model's idea or a correction of it.
  const predictedRef = useRef(null)
  // Set once the user picks a category by hand; we then stop overwriting it.
  const touchedCategory = useRef(false)

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
    setSuggestion(null)
    predictedRef.current = null
    // When editing, the existing category is the user's own choice already.
    touchedCategory.current = Boolean(initial?.id)
  }, [initial])

  // Ask the model as the user types the description. Debounced so it is one
  // request per pause, not one per keystroke.
  useEffect(() => {
    const text = form.description.trim()
    if (text.length < 3) {
      setSuggestion(null)
      return undefined
    }
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setPredicting(true)
      try {
        const result = await api.post('/api/ai/categorize', { description: text },
          { signal: controller.signal })
        setSuggestion(result)
        predictedRef.current = result
        // Auto-fill ONLY while the user has not chosen a category themselves,
        // and only when the model is actually confident. Overwriting a
        // deliberate choice would be the single most annoying thing this
        // feature could do.
        if (!touchedCategory.current && result.confident) {
          setForm((f) => ({ ...f, category: result.category }))
        }
      } catch (err) {
        if (err.name !== 'AbortError') setSuggestion(null)
      } finally {
        setPredicting(false)
      }
    }, 450)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [form.description])

  const set = (key) => (event) => setForm((f) => ({ ...f, [key]: event.target.value }))

  const setCategory = (event) => {
    touchedCategory.current = true
    setForm((f) => ({ ...f, category: event.target.value }))
  }

  const acceptSuggestion = (category) => {
    touchedCategory.current = true
    setForm((f) => ({ ...f, category }))
  }

  const fieldError = (key) => (error?.field === key ? error.message : null)

  async function onSubmit(event) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    const predicted = predictedRef.current
    const payload = {
      ...form,
      amount: Number(form.amount),
      // Send what the model said alongside what the user chose. The backend
      // compares them to set was_corrected, which is the retraining signal.
      ai_category: predicted?.confident ? predicted.category : null,
      ai_confidence: predicted?.confident ? predicted.confidence : null,
    }
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
          <Select required value={form.category} onChange={setCategory}>
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

      <AiSuggestion
        suggestion={suggestion}
        predicting={predicting}
        chosen={form.category}
        onAccept={acceptSuggestion}
      />

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

/**
 * Shows what the model predicted and how sure it was.
 *
 * Deliberately never silently overrides a choice the user has made: when the
 * selected category already matches, it collapses to a quiet confirmation.
 * When it differs, it offers the alternative as a one-click chip rather than
 * swapping the value underneath the user.
 */
function AiSuggestion({ suggestion, predicting, chosen, onAccept }) {
  if (predicting) {
    return (
      <p className="flex items-center gap-1.5 text-xs muted">
        <Loader2 size={13} className="animate-spin text-ink-500" />
        Categorizing description…
      </p>
    )
  }
  if (!suggestion) return null

  const pct = Math.round(suggestion.confidence * 100)

  // Model declined: say so rather than showing a confident-looking wrong guess.
  if (!suggestion.confident) {
    return (
      <p className="flex items-start gap-1.5 text-xs muted">
        <Tag size={13} className="mt-0.5 shrink-0 text-ink-400" />
        <span>
          Unrecognized merchant ({pct}% confidence) — select category manually.
        </span>
      </p>
    )
  }

  if (chosen === suggestion.category) {
    return (
      <p className="flex items-center gap-1.5 text-xs text-pos">
        <Check size={13} />
        Auto-categorized as <span className="font-medium">{suggestion.category}</span>
        <Badge tone="positive">{pct}% match</Badge>
      </p>
    )
  }

  // Drop alternatives the model gives essentially no weight to -- a "0%"
  // chip is noise that makes the whole suggestion look unreliable.
  const others = (suggestion.alternatives || [])
    .filter((a) => a.category !== chosen && a.confidence >= 0.02)
    .slice(0, 3)

  if (others.length === 0) return null

  return (
    <div className="space-y-1.5">
      <p className="flex items-center gap-1.5 text-xs muted">
        <Tag size={13} className="text-ink-400" />
        Suggested categories:
      </p>
      <div className="flex flex-wrap gap-1.5">
        {others.map((alt) => (
          <button
            key={alt.category}
            type="button"
            onClick={() => onAccept(alt.category)}
            className="rounded-full border border-ink-200 px-2.5 py-1 text-[11px] transition
              hover:border-ink-900 hover:text-ink-900 dark:border-[#2E2E2A] dark:hover:border-ink-100 dark:hover:text-ink-100"
          >
            {alt.category}
            <span className="ml-1 muted">{Math.round(alt.confidence * 100)}%</span>
          </button>
        ))}
      </div>
    </div>
  )
}
