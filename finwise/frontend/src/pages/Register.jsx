import { ArrowRight } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { useAuth } from '../auth'
import { Field, Input } from '../components/ui'
import { AuthShell } from './Login'

export default function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState({ name: '', email: '', password: '', monthly_income: '' })
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value })

  async function onSubmit(event) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await register({
        name: form.name,
        email: form.email,
        password: form.password,
        monthly_income: form.monthly_income === '' ? null : Number(form.monthly_income),
      })
      navigate('/', { replace: true })
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  const fieldError = (key) => (error?.field === key ? error.message : null)

  return (
    <AuthShell
      title="Initialize New Ledger"
      subtitle="Establish a private, zero-telemetry personal balance sheet."
      isRegister={true}
      footer={
        <>
          Already hold a private ledger?{' '}
          <Link
            to="/login"
            className="font-medium text-white hover:text-blue-400 underline underline-offset-4 transition"
          >
            Access Vault
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field label="Full name" required error={fieldError('name')}>
          <Input
            name="name"
            autoComplete="name"
            autoFocus
            required
            value={form.name}
            onChange={set('name')}
            placeholder="Asha Rao"
            className="bg-[#080B13] border-slate-700/80 text-white placeholder:text-slate-600 focus:border-slate-400"
          />
        </Field>

        <Field label="Email address" required error={fieldError('email')}>
          <Input
            type="email"
            name="email"
            autoComplete="username"
            required
            value={form.email}
            onChange={set('email')}
            placeholder="you@example.com"
            className="bg-[#080B13] border-slate-700/80 text-white placeholder:text-slate-600 focus:border-slate-400"
          />
        </Field>

        <Field
          label="Vault Password"
          required
          error={fieldError('password')}
          hint="At least 8 characters."
        >
          <Input
            type="password"
            name="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={form.password}
            onChange={set('password')}
            placeholder="••••••••"
            className="bg-[#080B13] border-slate-700/80 text-white placeholder:text-slate-600 focus:border-slate-400"
          />
        </Field>

        <Field
          label="Monthly income (₹)"
          error={fieldError('monthly_income')}
          hint="Optional. Used for savings rate and runway baseline."
        >
          <Input
            type="number"
            min="0"
            step="1"
            value={form.monthly_income}
            onChange={set('monthly_income')}
            placeholder="45000"
            className="bg-[#080B13] border-slate-700/80 text-white placeholder:text-slate-600 focus:border-slate-400"
          />
        </Field>

        {error && !error.field && (
          <div
            role="alert"
            className="rounded-lg border border-rose-500/40 bg-rose-950/30 p-2.5 text-xs text-rose-300 font-mono"
          >
            {error.message}
          </div>
        )}

        <button
          type="submit"
          disabled={busy}
          className="group relative w-full rounded-full bg-white text-slate-950 px-5 py-3 text-xs font-semibold tracking-wide flex items-center justify-between transition-all duration-300 hover:bg-slate-100 active:scale-[0.99] disabled:opacity-50"
        >
          <span>{busy ? 'Establishing Ledger…' : 'Initialize Personal Ledger'}</span>
          <div className="size-6 rounded-full bg-slate-950/10 flex items-center justify-center transition-transform group-hover:translate-x-0.5">
            <ArrowRight size={13} className="text-slate-950" />
          </div>
        </button>
      </form>
    </AuthShell>
  )
}
