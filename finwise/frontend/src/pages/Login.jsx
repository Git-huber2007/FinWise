import { ArrowRight, CheckCircle2, Lock, ShieldCheck, Terminal } from 'lucide-react'
import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import { useAuth } from '../auth'
import { Badge, Button, Field, Input } from '../components/ui'

/**
 * Enterprise Architectural Authentication Shell.
 * Grounded in the technical governance reference layout:
 * Left: Glowing brand emblem, feature pills with status dots, verification badges, lead copy.
 * Right: Crisp centered auth card with one-click demo ledger access.
 */
export function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="min-h-dvh grid lg:grid-cols-12 bg-[#F8FAFC] dark:bg-[#090C15] text-slate-900 dark:text-slate-100">
      {/* Left Reference-Inspired Architectural Showcase Panel */}
      <div className="hidden lg:flex lg:col-span-6 xl:col-span-7 flex-col justify-between bg-[#080B14] p-10 xl:p-14 border-r border-slate-800/80 relative overflow-hidden">
        {/* Subtle grid pattern background */}
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:28px_28px]" />

        {/* Top Header Identity */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="relative grid size-9 place-items-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 font-sans font-bold text-base text-white shadow-md shadow-blue-500/20">
            F
            <span className="absolute -bottom-0.5 -right-0.5 size-2 rounded-full bg-emerald-400 ring-2 ring-[#080B14]" />
          </div>
          <div className="leading-tight">
            <span className="font-display text-sm font-bold tracking-tight text-white">FinWise</span>
            <p className="font-mono text-[10px] text-slate-400">Autonomous Financial Intelligence</p>
          </div>
        </div>

        {/* Center Identity & Reference Box */}
        <div className="relative z-10 my-auto py-8 space-y-6 max-w-xl">
          {/* Reference Glowing Shield Vault Emblem */}
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-2xl border border-blue-500/30 bg-[#0E1528] text-blue-400 shadow-sm shadow-blue-500/10">
              <ShieldCheck size={22} className="text-blue-400" />
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-slate-400">Architecture Specification</p>
              <h2 className="font-display font-bold text-2xl xl:text-3xl tracking-tight text-white">
                FINWISE PLATFORM
              </h2>
            </div>
          </div>

          <p className="font-mono text-[11px] uppercase tracking-wider text-slate-400">
            Deterministic Double-Entry Math · Local Scikit-Learn ML · Section 115BAC Engine
          </p>

          {/* Reference Feature Pill Tags with Glowing Multi-Color Dots */}
          <div className="flex flex-wrap gap-2 pt-1">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-800 bg-[#0D1220] px-3 py-1 font-mono text-[11px] text-slate-300">
              <span className="size-1.5 rounded-full bg-indigo-500" />
              Scikit-Learn ML Engine
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-800 bg-[#0D1220] px-3 py-1 font-mono text-[11px] text-slate-300">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              Deterministic Ledger Math
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-800 bg-[#0D1220] px-3 py-1 font-mono text-[11px] text-slate-300">
              <span className="size-1.5 rounded-full bg-purple-500" />
              Section 115BAC Optimizer
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-800 bg-[#0D1220] px-3 py-1 font-mono text-[11px] text-slate-300">
              <span className="size-1.5 rounded-full bg-amber-500" />
              Zero-Trust Local Privacy
            </span>
          </div>

          {/* Reference Two-Row Technical Badge Matrix */}
          <div className="space-y-2 pt-2">
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-2 rounded-md border border-slate-800 bg-[#0B0F1C] px-2.5 py-1 font-mono text-[11px] text-slate-400">
                <span className="font-semibold text-slate-300">VERIFICATION SUITE</span>
                <span className="rounded bg-emerald-950/60 px-1.5 py-0.5 text-emerald-400 font-bold border border-emerald-800/40">
                  281 OF 281 PASSED
                </span>
              </span>
              <span className="inline-flex items-center gap-2 rounded-md border border-slate-800 bg-[#0B0F1C] px-2.5 py-1 font-mono text-[11px] text-slate-400">
                <span className="font-semibold text-slate-300">TAX REGIME</span>
                <span className="rounded bg-cyan-950/60 px-1.5 py-0.5 text-cyan-400 font-bold border border-cyan-800/40">
                  FY 2024-25 &amp; 2025-26
                </span>
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-2 rounded-md border border-slate-800 bg-[#0B0F1C] px-2.5 py-1 font-mono text-[11px] text-slate-400">
                <span className="font-semibold text-slate-300">ML INFERENCE</span>
                <span className="rounded bg-purple-950/60 px-1.5 py-0.5 text-purple-400 font-bold border border-purple-800/40">
                  &lt; 0.5MS LOCAL
                </span>
              </span>
              <span className="inline-flex items-center gap-2 rounded-md border border-slate-800 bg-[#0B0F1C] px-2.5 py-1 font-mono text-[11px] text-slate-400">
                <span className="font-semibold text-slate-300">STACK</span>
                <span className="text-slate-300 font-bold">FLASK · REACT 18 · TAILWIND</span>
              </span>
            </div>
          </div>

          {/* Reference Authoritative Lead Summary */}
          <p className="text-xs leading-relaxed text-slate-400 pt-2 border-t border-slate-800/80">
            A zero-telemetry personal finance operating system engineered for absolute privacy and mathematical precision.
            Records every transaction into an immutable ledger while orchestrating real-time debt acceleration and balance sheet intelligence.
          </p>

          {/* Telemetry Snapshot Preview */}
          <div className="rounded-xl border border-slate-800/80 bg-[#0C1120] p-4 text-xs font-mono">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800/80 text-[10px] text-slate-500 uppercase">
              <span>Telemetry Snapshot</span>
              <span className="text-emerald-400">● LIVE RUNTIME</span>
            </div>
            <div className="grid grid-cols-3 gap-3 pt-3">
              <div>
                <p className="text-[10px] text-slate-500">NET SAVINGS</p>
                <p className="text-sm font-bold text-white tnum mt-0.5">₹1,24,500</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500">HEALTH INDEX</p>
                <p className="text-sm font-bold text-emerald-400 tnum mt-0.5">84 / 100</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500">RUNWAY</p>
                <p className="text-sm font-bold text-blue-400 tnum mt-0.5">9.4 mos</p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Safety Guarantee */}
        <div className="relative z-10 flex items-center justify-between font-mono text-[11px] text-slate-500">
          <span className="flex items-center gap-1.5">
            <Lock size={12} className="text-emerald-400" />
            100% Local Accounting Ledger
          </span>
          <span>Zero Telemetry Leaks</span>
        </div>
      </div>

      {/* Right Modern Form Panel */}
      <div className="lg:col-span-6 xl:col-span-5 flex flex-col justify-between px-6 py-10 sm:px-12 lg:px-14">
        {/* Mobile Header */}
        <div className="flex items-center gap-2.5 lg:invisible">
          <div className="grid size-7 place-items-center rounded-lg bg-gradient-to-br from-blue-600 to-indigo-700 font-sans font-bold text-sm text-white">
            F
          </div>
          <span className="font-display text-base font-bold tracking-tight text-slate-900 dark:text-white">FinWise</span>
        </div>

        {/* Centered Auth Card */}
        <div className="mx-auto w-full max-w-md my-auto py-6">
          <div className="rounded-2xl border border-slate-200/90 bg-white p-7 sm:p-8 shadow-card dark:border-slate-800/80 dark:bg-[#0F1422]">
            <h1 className="font-display font-bold text-2xl tracking-tight text-slate-900 dark:text-white">
              {title}
            </h1>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>

            <div className="mt-6">{children}</div>
            <div className="mt-6 text-center text-xs text-slate-500 dark:text-slate-400">{footer}</div>
          </div>
        </div>

        {/* Compliance Footer */}
        <p className="text-[11px] text-slate-400 text-center">
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
      subtitle="Enter your credentials to access your financial dashboard."
      footer={
        <>
          New to FinWise?{' '}
          <Link to="/register" className="font-medium text-slate-900 underline underline-offset-4 hover:text-blue-600 dark:text-white dark:hover:text-blue-400">
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
          <p
            role="alert"
            className="rounded-lg border border-rose-300 bg-rose-50/80 px-3 py-2 text-xs text-neg dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-400"
          >
            {error.message}
          </p>
        )}

        <Button type="submit" loading={busy} className="w-full" size="lg">
          Sign in
        </Button>
      </form>

      <div className="my-5 flex items-center gap-3">
        <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
        <span className="font-mono text-[10px] uppercase text-slate-400">Instant Demo</span>
        <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
      </div>

      <button
        type="button"
        onClick={loginDemo}
        disabled={busy}
        className="group w-full rounded-xl border border-slate-200/90 bg-slate-50/70 p-3.5 text-left transition-all hover:border-blue-500/40 hover:bg-white dark:border-slate-800 dark:bg-slate-900/40 dark:hover:border-slate-700 dark:hover:bg-slate-900"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-emerald-500" />
            <span className="text-xs font-semibold text-slate-900 dark:text-white">
              Launch Preloaded Demo Ledger
            </span>
          </div>
          <ArrowRight size={13} className="text-slate-400 group-hover:translate-x-0.5 transition-transform" />
        </div>
        <p className="mt-1 font-mono text-[11px] text-slate-500 dark:text-slate-400">
          demo@finwise.ai · 8-month history, active budgets &amp; debt portfolio
        </p>
      </button>
    </AuthShell>
  )
}