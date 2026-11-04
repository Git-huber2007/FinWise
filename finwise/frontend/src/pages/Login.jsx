import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import { useAuth } from '../auth'
import { Button, Field, Input } from '../components/ui'

/** Clean, trustworthy authentication shell */
export function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="min-h-screen grid place-items-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-2.5">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-ink-900 text-sm font-bold text-white dark:bg-white dark:text-ink-900">
            F
          </div>
          <div className="leading-none">
            <p className="text-sm font-semibold tracking-tight text-ink-900 dark:text-white">FINWISE</p>
            <p className="mt-0.5 text-[10px] font-medium tracking-[0.1em] text-ink-500 dark:text-ink-400">
              Personal Finance
            </p>
          </div>
        </div>

        <div className="card p-7 sm:p-8">
          <h1 className="display text-xl text-ink-900 dark:text-white">{title}</h1>
          <p className="mt-1 text-xs muted">{subtitle}</p>

          <div className="mt-6">{children}</div>
          <div className="mt-5 text-center text-xs muted">{footer}</div>
        </div>

        <p className="mt-6 text-center text-[11px] leading-relaxed muted">
          Educational project. FINWISE AI does not provide financial advice.
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

  const fillDemo = () => {
    setForm({ email: 'demo@finwise.ai', password: 'demo1234' })
  }

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

  return (
    <AuthShell
      title="Sign in to your account"
      subtitle="View your personal finances, spending insights, and budgets."
      footer={
        <>
          New to FinWise?{' '}
          <Link to="/register" className="font-medium text-brand-500 hover:underline">
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
          <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
            {error.message}
          </p>
        )}

        <Button type="submit" loading={busy} className="w-full" size="lg">
          Sign In
        </Button>
      </form>

      <div className="mt-5 rounded-lg border border-ink-200 bg-ink-50/70 p-3 text-xs dark:border-ink-700 dark:bg-ink-850">
        <div className="flex items-center justify-between mb-1">
          <span className="font-medium text-ink-700 dark:text-ink-300">Demo Account</span>
          <button
            type="button"
            onClick={fillDemo}
            className="text-[11px] font-medium text-brand-500 hover:underline cursor-pointer"
          >
            Auto-fill
          </button>
        </div>
        <p className="text-[11px] muted">
          <code className="font-mono text-ink-800 dark:text-ink-200">demo@finwise.ai</code> /{' '}
          <code className="font-mono text-ink-800 dark:text-ink-200">demo1234</code>
        </p>
      </div>
    </AuthShell>
  )
}
