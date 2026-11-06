import { ArrowRight, CheckCircle2, Lock, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import { useAuth } from '../auth'
import { Button, Field, Input } from '../components/ui'

/**
 * Disciplined, Monochromatic Split-Screen Authentication Shell.
 * Eliminates all AI-slop color chaos (neon purples, cyans, and rainbow badge pills).
 * Follows an institutional, high-contrast fintech palette:
 * Deep obsidian (#080B14), restrained slate borders, and crisp silver/white typography.
 */
export function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="min-h-dvh grid lg:grid-cols-12 bg-white dark:bg-[#07090E] text-slate-900 dark:text-slate-100 selection:bg-slate-700/30">
      {/* Left Monochromatic Architectural Showcase */}
      <div className="hidden lg:flex lg:col-span-7 xl:col-span-7 flex-col justify-between bg-[#070A11] p-12 xl:p-16 border-r border-slate-800/80 relative overflow-hidden text-white">
        {/* Subtle engineering line grid */}
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:40px_40px]" />

        {/* Brand Header */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="grid size-8 place-items-center rounded-lg bg-white text-slate-950 font-sans font-bold text-sm shadow-sm">
            F
          </div>
          <span className="font-display text-sm font-semibold tracking-tight text-white">FinWise</span>
        </div>

        {/* Center Architectural Blueprint Box */}
        <div className="relative z-10 my-auto py-8 max-w-xl mx-auto w-full">
          <div className="rounded-2xl border border-slate-800/90 bg-[#0B0F19]/90 p-8 xl:p-10 text-center shadow-2xl space-y-6">
            {/* Disciplined Vault Emblem (Clean Monochromatic Outline, No Neon Slop) */}
            <div className="flex justify-center">
              <div className="grid size-12 place-items-center rounded-2xl border border-slate-700 bg-slate-900/90 text-slate-200 shadow-inner">
                <ShieldCheck size={24} className="text-slate-200" />
              </div>
            </div>

            {/* Typography: Razor Sharp Hierarchy */}
            <div className="space-y-2">
              <h1 className="font-display font-extrabold text-2xl xl:text-3xl tracking-widest text-white">
                FINWISE
              </h1>
              <p className="font-mono text-[11px] font-medium uppercase tracking-widest text-slate-400">
                PERSONAL WEALTH &amp; SPENDING INTELLIGENCE
              </p>
              <p className="text-xs text-slate-400 leading-relaxed font-sans max-w-md mx-auto">
                Deterministic Double-Entry Math · Local ML Classification · Section 115BAC Engine
              </p>
            </div>

            {/* Cohesive, Monochromatic Status Tags */}
            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-[#0E1322] px-3.5 py-1 font-mono text-xs text-slate-300">
                <span className="size-1.5 rounded-full bg-slate-400" />
                <span>Double-Entry Math</span>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-[#0E1322] px-3.5 py-1 font-mono text-xs text-slate-300">
                <span className="size-1.5 rounded-full bg-slate-400" />
                <span>Offline ML Categorizer</span>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-[#0E1322] px-3.5 py-1 font-mono text-xs text-slate-300">
                <span className="size-1.5 rounded-full bg-slate-400" />
                <span>Tax Optimization</span>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-[#0E1322] px-3.5 py-1 font-mono text-xs text-slate-300">
                <span className="size-1.5 rounded-full bg-slate-400" />
                <span>Zero Telemetry</span>
              </div>
            </div>

            {/* Disciplined Dual-Tone Badges (High Contrast Slate & Crisp Silver) */}
            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              <div className="inline-flex items-stretch overflow-hidden rounded-md border border-slate-700 text-[11px] font-mono">
                <span className="inline-flex items-center gap-1.5 bg-[#171D2D] px-2.5 py-1 font-semibold text-slate-300">
                  <CheckCircle2 size={12} className="text-slate-300" />
                  VERIFICATION
                </span>
                <span className="bg-slate-200 px-2.5 py-1 font-bold text-slate-950">
                  DETERMINISTIC
                </span>
              </div>

              <div className="inline-flex items-stretch overflow-hidden rounded-md border border-slate-700 text-[11px] font-mono">
                <span className="bg-[#171D2D] px-2.5 py-1 font-semibold text-slate-300">
                  TAX REGIME
                </span>
                <span className="bg-slate-800 px-2.5 py-1 font-bold text-slate-200">
                  FY 2024-25 &amp; 2025-26
                </span>
              </div>

              <div className="inline-flex items-stretch overflow-hidden rounded-md border border-slate-700 text-[11px] font-mono">
                <span className="bg-[#171D2D] px-2.5 py-1 font-semibold text-slate-300">
                  PRIVACY
                </span>
                <span className="bg-slate-200 px-2.5 py-1 font-bold text-slate-950">
                  LOCAL SOVEREIGN
                </span>
              </div>

              <div className="inline-flex items-stretch overflow-hidden rounded-md border border-slate-700 text-[11px] font-mono">
                <span className="bg-[#171D2D] px-2.5 py-1 font-semibold text-slate-300">
                  SECURITY
                </span>
                <span className="bg-slate-800 px-2.5 py-1 font-bold text-slate-200">
                  ENCRYPTED COOKIE
                </span>
              </div>
            </div>

            {/* Descriptive Lead Statement */}
            <p className="text-xs leading-relaxed text-slate-400 max-w-lg mx-auto pt-2">
              A private personal finance system engineered for mathematical precision.
              Records every transaction into an immutable ledger while orchestrating real-time debt acceleration,
              automated runway forecasting, and offline machine-learning categorization.
            </p>
          </div>
        </div>

        {/* Footer Guarantee */}
        <div className="relative z-10 flex items-center justify-between text-xs text-slate-400 font-mono">
          <span className="flex items-center gap-1.5">
            <Lock size={12} className="text-slate-400" />
            100% Local Accounting Ledger
          </span>
          <span>Zero External Telemetry</span>
        </div>
      </div>

      {/* Right Authentication Panel */}
      <div className="lg:col-span-5 xl:col-span-5 flex flex-col justify-between px-6 py-10 sm:px-12 xl:px-16">
        {/* Mobile Header (Hidden on Desktop) */}
        <div className="flex items-center gap-2.5 lg:invisible">
          <div className="grid size-8 place-items-center rounded-lg bg-slate-900 text-white dark:bg-white dark:text-slate-950 font-sans font-bold text-sm">
            F
          </div>
          <span className="font-display text-base font-bold tracking-tight text-slate-900 dark:text-white">FinWise</span>
        </div>

        {/* Centered Auth Card */}
        <div className="mx-auto w-full max-w-md my-auto py-6">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D111A] p-7 sm:p-8 shadow-sm">
            <div className="space-y-1 mb-6">
              <h2 className="font-display font-bold text-2xl tracking-tight text-slate-900 dark:text-white">
                {title}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {subtitle}
              </p>
            </div>

            <div>{children}</div>

            <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800 text-center text-xs text-slate-500 dark:text-slate-400">
              {footer}
            </div>
          </div>
        </div>

        {/* Subtle Disclaimer Footer */}
        <p className="text-[11px] text-slate-400 dark:text-slate-500 text-center">
          FinWise is an analytical ledger system and does not provide certified financial advice.
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
      title="Sign in to your ledger"
      subtitle="Enter your credentials to access your financial dashboard."
      footer={
        <>
          New to FinWise?{' '}
          <Link
            to="/register"
            className="font-medium text-slate-900 hover:text-slate-700 dark:text-white dark:hover:text-slate-300 underline underline-offset-4"
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

      {/* Clean Demo Option */}
      <div className="relative my-5">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-slate-100 dark:border-slate-800" />
        </div>
        <div className="relative flex justify-center text-[10px] uppercase font-mono tracking-wider">
          <span className="bg-white dark:bg-[#0D111A] px-2 text-slate-400">Instant Demo</span>
        </div>
      </div>

      <button
        type="button"
        onClick={loginDemo}
        disabled={busy}
        className="group w-full flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/50 p-3 text-left transition hover:border-slate-300 hover:bg-white dark:hover:border-slate-700 dark:hover:bg-slate-900"
      >
        <div className="leading-tight">
          <p className="text-xs font-semibold text-slate-900 dark:text-white">
            Launch Preloaded Demo Ledger
          </p>
          <p className="mt-0.5 font-mono text-[11px] text-slate-500 dark:text-slate-400">
            demo@finwise.ai · 8-month history
          </p>
        </div>
        <ArrowRight size={13} className="text-slate-400 group-hover:translate-x-0.5 transition-transform" />
      </button>
    </AuthShell>
  )
}
