import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import { useAuth } from '../auth'
import { Button, Field, Input } from '../components/ui'

/** Shared chrome for the two signed-out screens. */
export function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="grid min-h-screen place-items-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-7 flex items-center gap-2.5">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-brand-500 text-sm font-bold text-white">
            F
          </div>
          <div className="leading-none">
            <p className="text-sm font-semibold tracking-tight">FINWISE</p>
            <p className="mt-0.5 text-[10px] font-medium tracking-[0.14em] text-brand-400">AI</p>
          </div>
        </div>

        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm muted">{subtitle}</p>

        <div className="mt-6">{children}</div>
        <div className="mt-5 text-center text-xs muted">{footer}</div>

        <p className="mt-8 text-center text-[11px] leading-relaxed muted">
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
      title="Welcome back"
      subtitle="Sign in to see your financial picture."
      footer={
        <>
          New here?{' '}
          <Link to="/register" className="font-medium text-brand-400 hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field label="Email" required error={error?.field === 'email' ? error.message : null}>
          <Input
            type="email"
            name="email"
            autoComplete="username"
            autoFocus
            required
            value={form.email}
            onChange={set('email')}
            placeholder="you@example.com"
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

        {/* A credentials error has no field, so it is shown once here. */}
        {error && !error.field && (
          <p role="alert" className="rounded-lg bg-neg/10 px-3 py-2 text-xs text-neg">
            {error.message}
          </p>
        )}

        <Button type="submit" loading={busy} className="w-full" size="lg">
          Sign in
        </Button>
      </form>

      <div className="mt-5 rounded-lg border border-ink-200 bg-ink-100/50 px-3 py-2.5 text-[11px] leading-relaxed muted dark:border-ink-800 dark:bg-ink-900/60">
        <span className="font-medium text-ink-600 dark:text-ink-400">Demo account</span> —
        run <code className="font-mono">python seed.py</code>, then sign in with{' '}
        <code className="font-mono">demo@finwise.ai</code> /{' '}
        <code className="font-mono">demo1234</code>
      </div>
    </AuthShell>
  )
}
