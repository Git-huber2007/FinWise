import { ArrowRight, Lock } from 'lucide-react'
import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import { useAuth } from '../auth'
import { Button, Field, Input } from '../components/ui'

/**
 * Minimalist, high-craft authentication shell.
 * Modeled after Linear & Mercury:
 * - Centered, quiet card layout with obsessive whitespace.
 * - Deep, solid dark canvas (#07090E) or crisp off-white (#F8FAFC).
 * - Zero artificial gradient blobs, zero fake dashboard widgets, zero buzzword badges.
 */
export function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="min-h-dvh flex flex-col justify-between bg-[#F8FAFC] dark:bg-[#07090E] text-slate-900 dark:text-slate-100 p-6 sm:p-10 selection:bg-blue-500/20">
      {/* Top Brand Bar */}
      <div className="flex items-center justify-between w-full max-w-sm mx-auto">
        <div className="flex items-center gap-2.5">
          <div className="grid size-7 place-items-center rounded-lg bg-blue-600 text-white font-sans font-semibold text-xs tracking-tight shadow-sm">
            F
          </div>
          <span className="font-display text-sm font-semibold tracking-tight text-slate-900 dark:text-white">
            FinWise
          </span>
        </div>
        <span className="font-mono text-[11px] text-slate-400 dark:text-slate-500">
          Local Ledger
        </span>
      </div>

      {/* Main Authentication Card */}
      <div className="w-full max-w-sm mx-auto my-auto py-10">
        <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/80 bg-white dark:bg-[#0D111A] p-7 sm:p-8 shadow-sm">
          <div className="space-y-1.5 mb-6 text-center">
            <h1 className="font-display font-semibold text-xl tracking-tight text-slate-900 dark:text-white">
              {title}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {subtitle}
            </p>
          </div>

          <div>{children}</div>

          <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800/80 text-center text-xs text-slate-500 dark:text-slate-400">
            {footer}
          </div>
        </div>
      </div>

      {/* Understated Privacy & Local-First Footer */}
      <div className="w-full max-w-sm mx-auto flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500 font-mono">
        <span className="inline-flex items-center gap-1.5">
          <Lock size={11} className="text-slate-400 dark:text-slate-500" />
          Zero external tracking
        </span>
        <span>Deterministic math</span>
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

  async function performLogin(email, password) {
    setBusy(true)
    setError(null)
    try {
      await login(email, password)
      navigate(location.state?.from || '/', { replace: true })
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  function onSubmit(event) {
    event.preventDefault()
    performLogin(form.email, form.password)
  }

  function loginDemo() {
    performLogin('demo@finwise.ai', 'demo1234')
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to your private financial ledger"
      footer={
        <>
          Don&apos;t have a ledger?{' '}
          <Link
            to="/register"
            className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 underline underline-offset-4"
          >
            Create an account
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
          <div
            role="alert"
            className="rounded-lg border border-rose-200 bg-rose-50/80 p-2.5 text-xs text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-400"
          >
            {error.message}
          </div>
        )}

        <Button type="submit" loading={busy} size="lg" className="w-full">
          Sign In
        </Button>
      </form>

      {/* Clean, Understated Demo Option */}
      <div className="relative my-5">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-slate-100 dark:border-slate-800" />
        </div>
        <div className="relative flex justify-center text-[10px] uppercase font-mono tracking-wider">
          <span className="bg-white dark:bg-[#0D111A] px-2 text-slate-400">or</span>
        </div>
      </div>

      <button
        type="button"
        onClick={loginDemo}
        disabled={busy}
        className="w-full flex items-center justify-between rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 px-3.5 py-2.5 text-left text-xs transition hover:bg-slate-100/70 dark:hover:bg-slate-800/60"
      >
        <div className="leading-tight">
          <p className="font-medium text-slate-900 dark:text-white">Explore with demo ledger</p>
          <p className="font-mono text-[10px] text-slate-400">demo@finwise.ai · 8-month history</p>
        </div>
        <ArrowRight size={13} className="text-slate-400" />
      </button>
    </AuthShell>
  )
}
