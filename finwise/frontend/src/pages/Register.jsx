import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { useAuth } from '../auth'
import { Button, Field, Input } from '../components/ui'
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
        // Optional: omitted rather than sent as an empty string.
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
      title="Create your account"
      subtitle="Start tracking where your money actually goes."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-brand-400 hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field label="Full name" required error={fieldError('name')}>
          <Input autoFocus required value={form.name} onChange={set('name')} placeholder="Asha Rao" />
        </Field>

        <Field label="Email" required error={fieldError('email')}>
          <Input
            type="email"
            autoComplete="email"
            required
            value={form.email}
            onChange={set('email')}
            placeholder="you@example.com"
          />
        </Field>

        <Field
          label="Password"
          required
          error={fieldError('password')}
          hint="At least 8 characters."
        >
          <Input
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={form.password}
            onChange={set('password')}
            placeholder="••••••••"
          />
        </Field>

        <Field
          label="Monthly income (₹)"
          error={fieldError('monthly_income')}
          hint="Optional. Used by the Financial Health score; you can add it later."
        >
          <Input
            type="number"
            min="0"
            step="1"
            value={form.monthly_income}
            onChange={set('monthly_income')}
            placeholder="45000"
          />
        </Field>

        {error && !error.field && (
          <p role="alert" className="rounded-lg bg-neg/10 px-3 py-2 text-xs text-neg">
            {error.message}
          </p>
        )}

        <Button type="submit" loading={busy} className="w-full" size="lg">
          Create account
        </Button>
      </form>
    </AuthShell>
  )
}
