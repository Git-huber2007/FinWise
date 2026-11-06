import { ArrowRight } from 'lucide-react'
import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import { useAuth } from '../auth'
import { Button, Field, Input } from '../components/ui'

/**
 * Editorial 2-column authentication layout.
 * No floating cards in a void, no nested demo boxes.
 */
export function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="min-h-dvh grid lg:grid-cols-12 bg-[#F8F7F4] dark:bg-[#0A0A09]">
      {/* Left Modern Financial Intelligence Panel */}
      <div className="hidden lg:flex lg:col-span-5 flex-col justify-between bg-gradient-to-br from-[#0A0D15] via-[#0F1424] to-[#07090E] text-white p-10 xl:p-14 border-r border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="grid size-8 place-items-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 font-sans font-bold text-base text-white shadow-lg shadow-blue-500/25">
            F
          </div>
          <div className="leading-tight">
            <p className="font-display text-sm font-bold tracking-tight text-white">FinWise</p>
            <p className="font-mono text-[10px] text-slate-400">Personal Wealth &amp; Spending Intelligence</p>
          </div>
        </div>

        <div className="my-auto py-12">
          <h2 className="font-display font-bold text-3xl xl:text-4xl tracking-tight leading-[1.15] text-white">
            Personal finance engineered for absolute clarity.
          </h2>
          <p className="mt-4 text-xs leading-relaxed text-slate-400 max-w-md">
            Every cash flow statement, budget pace alert, and runway projection is computed
            deterministically from your recorded ledger entries with zero external data leaks.
          </p>

          <dl className="mt-8 divide-y divide-white/10 border-y border-white/10 text-xs">
            <div className="py-3.5 flex items-baseline justify-between gap-4">
              <dt className="font-medium text-white">Double-Entry Ledger</dt>
              <dd className="font-mono text-[11px] text-slate-400">Inflows, outflows &amp; net retention</dd>
            </div>
            <div className="py-3.5 flex items-baseline justify-between gap-4">
              <dt className="font-medium text-white">Debt Freedom Engine</dt>
              <dd className="font-mono text-[11px] text-slate-400">Avalanche vs Snowball acceleration</dd>
            </div>
            <div className="py-3.5 flex items-baseline justify-between gap-4">
              <dt className="font-medium text-white">Offline Machine Learning</dt>
              <dd className="font-mono text-[11px] text-slate-400">&lt; 0.5ms local merchant classifier</dd>
            </div>
          </dl>
        </div>

        <div className="flex items-center justify-between font-mono text-[11px] text-slate-500">
          <span>INR (₹) Standard</span>
          <span>Zero-Trust Privacy</span>
        </div>
      </div>

      {/* Right Form Surface */}
      <div className="lg:col-span-7 flex flex-col justify-between px-6 py-10 sm:px-12 lg:px-16">
        <div className="flex items-center gap-2.5 lg:invisible">
          <div className="grid size-7 place-items-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 font-sans font-bold text-sm text-white">
            F
          </div>
          <span className="font-display text-base font-bold tracking-tight text-ink-900 dark:text-white">FinWise</span>
        </div>

        <div className="mx-auto w-full max-w-sm my-auto py-8">
          <h1 className="font-display font-bold text-3xl tracking-tight text-ink-900 dark:text-white">{title}</h1>
          <p className="mt-1.5 text-xs muted">{subtitle}</p>

          <div className="mt-7">{children}</div>
          <div className="mt-6 text-xs muted">{footer}</div>
        </div>

        <p className="text-[11px] muted text-center lg:text-left">
          FinWise is an educational accounting system and does not provide certified financial advice.
        </p>
      </div>
    </div>
  )
}

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value })

  async function onSubmit(event) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await login(form.email, form.password)
      navigate(location.state?.from || '/', { replace: true })
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  async function loginDemo() {
    setForm({ email: 'demo@finwise.ai', password: 'demo1234' })
    setBusy(true)
    setError(null)
    try {
      await login('demo@finwise.ai', 'demo1234')
      navigate(location.state?.from || '/', { replace: true })
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell
      title="Sign in to your ledger"
      subtitle="Enter your credentials to inspect your statements and budgets."
      footer={
        <>
          New to FinWise?{' '}
          <Link to="/register" className="font-medium text-ink-900 underline underline-offset-4 dark:text-ink-100">
            Create a ledger account
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field label="Email address" required error={error?.field === 'email' ? error.message : null}>
          <Input
            type="email"
            name="email"
            autoComplete="username"
            autoFocus
            required
            value={form.email}
            onChange={set('email')}
            placeholder="name@example.com"
          />
        </Field>

        <Field label="Password" required error={error?.field === 'password' ? error.message : null}>
          <Input
            type="password"
            name="password"
            autoComplete="current-password"
            required
            value={form.password}
            onChange={set('password')}
            placeholder="••••••••"
          />
        </Field>

        {error && !error.field && (
          <p
            role="alert"
            className="rounded border border-rose-300 bg-rose-50/80 px-3 py-2 text-xs text-neg dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-400"
          >
            {error.message}
          </p>
        )}

        <Button type="submit" loading={busy} className="w-full" size="lg">
          Sign in
        </Button>
      </form>

      <div className="my-5 flex items-center gap-3">
        <div className="h-px flex-1 bg-ink-200 dark:bg-[#242421]" />
        <span className="font-mono text-[10px] uppercase muted">Sample Ledger</span>
        <div className="h-px flex-1 bg-ink-200 dark:bg-[#242421]" />
      </div>

      <Button
        type="button"
        variant="secondary"
        size="lg"
        onClick={loginDemo}
        disabled={busy}
        className="w-full justify-between"
      >
        <span>Explore 8-month sample ledger</span>
        <span className="inline-flex items-center gap-1 font-mono text-[11px] muted">
          demo@finwise.ai
          <ArrowRight size={12} />
        </span>
      </Button>
    </AuthShell>
  )
}
