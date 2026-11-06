import { useState } from 'react'

import { api } from '../api'
import { useAuth } from '../auth'
import { Button, Card, CardHeader, Field, Input, PageHeader, Select } from '../components/ui'
import { useTheme } from '../theme'

export default function Settings() {
  const { user, updateProfile } = useAuth()
  const { theme, toggle } = useTheme()

  return (
    <>
      <PageHeader title="Settings" subtitle="Profile and preferences" />
      <div className="grid gap-5 lg:grid-cols-2">
        <ProfileCard user={user} onSave={updateProfile} />
        <div className="space-y-5">
          <AppearanceCard theme={theme} onToggle={toggle} />
          <PasswordCard />
        </div>
      </div>
    </>
  )
}

/** Small helper so each card gets its own independent save state. */
function useSaver(submit) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [saved, setSaved] = useState(false)

  async function run(event, payload) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    setSaved(false)
    try {
      await submit(payload)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }
  return { busy, error, saved, run }
}

function Feedback({ error, saved, savedLabel = 'Saved' }) {
  if (error && !error.field) {
    return (
      <p role="alert" className="text-xs text-neg">
        {error.message}
      </p>
    )
  }
  if (saved) {
    return <p className="text-xs text-pos">{savedLabel}</p>
  }
  return <span />
}

function ProfileCard({ user, onSave }) {
  const [form, setForm] = useState({
    name: user?.name ?? '',
    email: user?.email ?? '',
    monthly_income: user?.monthly_income ?? '',
    emergency_fund: user?.emergency_fund ?? '',
  })
  const { busy, error, saved, run } = useSaver(onSave)
  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value })
  const fieldError = (key) => (error?.field === key ? error.message : null)

  return (
    <Card className="overflow-hidden">
      <CardHeader title="Profile" subtitle="Used across your dashboard and reports" />
      <form
        className="space-y-4 p-5"
        onSubmit={(event) =>
          run(event, {
            name: form.name,
            email: form.email,
            monthly_income: form.monthly_income === '' ? null : Number(form.monthly_income),
            emergency_fund: form.emergency_fund === '' ? null : Number(form.emergency_fund),
          })
        }
        noValidate
      >
        <Field label="Full name" required error={fieldError('name')}>
          <Input required value={form.name} onChange={set('name')} />
        </Field>

        <Field label="Email" required error={fieldError('email')}>
          <Input type="email" required value={form.email} onChange={set('email')} />
        </Field>

        <Field
          label="Monthly income (₹)"
          error={fieldError('monthly_income')}
          hint="Self-reported. The Financial Health score prefers your actual recorded income and falls back to this."
        >
          <Input
            type="number"
            min="0"
            step="1"
            value={form.monthly_income ?? ''}
            onChange={set('monthly_income')}
            placeholder="45000"
          />
        </Field>

        <Field
          label="Emergency fund (₹)"
          error={fieldError('emergency_fund')}
          hint="Cash set aside for emergencies. Improves your health score when it covers 3+ months of expenses."
        >
          <Input
            type="number"
            min="0"
            step="1"
            value={form.emergency_fund ?? ''}
            onChange={set('emergency_fund')}
            placeholder="100000"
          />
        </Field>

        <div className="flex items-center justify-between pt-1">
          <Feedback error={error} saved={saved} savedLabel="Profile saved" />
          <Button type="submit" loading={busy}>
            Save profile
          </Button>
        </div>
      </form>
    </Card>
  )
}

function AppearanceCard({ theme, onToggle }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader title="Appearance" subtitle="Applies immediately on this device" />
      <div className="p-5">
        <Field label="Theme">
          <Select
            value={theme}
            onChange={(event) => {
              if (event.target.value !== theme) onToggle()
            }}
          >
            <option value="dark">Dark</option>
            <option value="light">Light</option>
          </Select>
        </Field>
      </div>
    </Card>
  )
}

function PasswordCard() {
  const [form, setForm] = useState({ current_password: '', new_password: '' })
  const { busy, error, saved, run } = useSaver(async (payload) => {
    await api.put('/api/me/password', payload)
    setForm({ current_password: '', new_password: '' })
  })
  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value })

  return (
    <Card className="overflow-hidden">
      <CardHeader title="Password" />
      <form className="space-y-4 p-5" onSubmit={(event) => run(event, form)} noValidate>
        <Field
          label="Current password"
          required
          error={error?.field === 'current_password' ? error.message : null}
        >
          <Input
            type="password"
            autoComplete="current-password"
            required
            value={form.current_password}
            onChange={set('current_password')}
          />
        </Field>

        <Field
          label="New password"
          required
          hint="At least 8 characters."
          error={error?.field === 'new_password' ? error.message : null}
        >
          <Input
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={form.new_password}
            onChange={set('new_password')}
          />
        </Field>

        <div className="flex items-center justify-between pt-1">
          <Feedback error={error} saved={saved} savedLabel="Password updated" />
          <Button type="submit" loading={busy}>
            Change password
          </Button>
        </div>
      </form>
    </Card>
  )
}
