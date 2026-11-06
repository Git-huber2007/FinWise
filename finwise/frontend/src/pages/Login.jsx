import { ArrowRight, Lock, Sparkles, TrendingUp } from 'lucide-react'
import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import { useAuth } from '../auth'
import { Button, Field, Input } from '../components/ui'

/**
 * Editorial Fintech Authentication Shell.
 * Calm, confident design language:
 * - Left: Editorial wealth narrative and an authentic balance sheet preview.
 * - Right: Clean, distraction-free authentication card with instant demo ledger access.
 * - Free of artificial badges, mock terminal logs, or dev-stack buzzwords.
 */
export function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="min-h-dvh grid lg:grid-cols-12 bg-slate-50 dark:bg-[#07090E] text-slate-900 dark:text-slate-100 selection:bg-blue-500/20">
      {/* Left Editorial Product Showcase Panel */}
      <div className="hidden lg:flex lg:col-span-6 xl:col-span-7 flex-col justify-between bg-gradient-to-b from-[#090D16] via-[#080B12] to-[#05070B] p-12 xl:p-16 border-r border-slate-800/60 relative overflow-hidden text-white">
        {/* Subtle radial atmosphere */}
        <div className="pointer-events-none absolute -top-40 -left-40 size-96 rounded-full bg-blue-600/10 blur-[100px]" />
        <div className="pointer-events-none absolute -bottom-40 right-0 size-96 rounded-full bg-indigo-600/10 blur-[100px]" />

        {/* Brand Header */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-sans font-bold text-base shadow-sm shadow-blue-500/30">
            F
          </div>
          <div>
            <span className="font-display text-base font-semibold tracking-tight text-white">FinWise</span>
            <span className="ml-2 font-mono text-[10px] uppercase tracking-wider text-slate-400">Ledger Intelligence</span>
          </div>
        </div>

        {/* Narrative & Authentic Product Preview */}
        <div className="relative z-10 my-auto py-10 max-w-xl space-y-8">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-700/60 bg-slate-800/40 px-3 py-1 text-xs text-slate-300">
              <span className="size-1.5 rounded-full bg-emerald-400" />
              <span>Deterministic Personal Wealth Operating System</span>
            </div>
            
            <h1 className="font-display text-3xl xl:text-4xl font-bold tracking-tight text-white leading-[1.15]">
              Personal finance,<br />engineered with precision.
            </h1>
            
            <p className="text-sm text-slate-400 leading-relaxed max-w-lg">
              Track your net worth, forecast cash runway, accelerate debt payoff, and optimize taxes with complete mathematical certainty — entirely offline and private.
            </p>
          </div>

          {/* Authentic Mini-Product Balance Sheet Card */}
          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/50 backdrop-blur-md p-5 shadow-2xl shadow-black/40">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800/70">
              <div className="flex items-center gap-2">
                <div className="size-2 rounded-full bg-emerald-400" />
                <span className="font-mono text-xs text-slate-300 font-medium">Verified Household Ledger</span>
              </div>
              <span className="font-mono text-[11px] text-slate-500">Live Engine</span>
            </div>

            <div className="grid grid-cols-2 gap-4 py-4">
              <div>
                <p className="text-[11px] uppercase tracking-wider font-mono text-slate-400">Total Net Worth</p>
                <p className="text-2xl font-bold font-display text-white tracking-tight mt-0.5">₹18,45,200</p>
                <div className="flex items-center gap-1.5 mt-1 text-emerald-400 text-xs font-mono">
                  <TrendingUp size={13} />
                  <span>+12.4% year-over-year</span>
                </div>
              </div>

              <div>
                <p className="text-[11px] uppercase tracking-wider font-mono text-slate-400">Liquid Runway</p>
                <p className="text-2xl font-bold font-display text-white tracking-tight mt-0.5">9.4 Months</p>
                <p className="text-xs text-slate-400 font-mono mt-1">₹48,200 monthly burn</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-800/70 text-xs font-mono">
              <div className="rounded-lg bg-slate-800/40 px-3 py-2">
                <p className="text-[10px] text-slate-500 uppercase">Savings Rate</p>
                <p className="font-semibold text-slate-200 mt-0.5">41.8%</p>
              </div>
              <div className="rounded-lg bg-slate-800/40 px-3 py-2">
                <p className="text-[10px] text-slate-500 uppercase">Debt Strategy</p>
                <p className="font-semibold text-slate-200 mt-0.5">Avalanche</p>
              </div>
              <div className="rounded-lg bg-slate-800/40 px-3 py-2">
                <p className="text-[10px] text-slate-500 uppercase">Tax Regime</p>
                <p className="font-semibold text-slate-200 mt-0.5">Sec 115BAC</p>
              </div>
            </div>
          </div>

          {/* Understated Value Pillars */}
          <div className="grid grid-cols-3 gap-6 pt-2">
            <div>
              <p className="text-xs font-semibold text-white">Double-Entry Math</p>
              <p className="text-[11px] text-slate-400 mt-1 leading-snug">Every rupee accounted for across all balance sheets.</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-white">Zero Telemetry</p>
              <p className="text-[11px] text-slate-400 mt-1 leading-snug">No external tracking, cloud profiling, or ads.</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-white">Tax Intelligence</p>
              <p className="text-[11px] text-slate-400 mt-1 leading-snug">Automated FY 2024-25 &amp; 2025-26 regime comparisons.</p>
            </div>
          </div>
        </div>

        {/* Footer Guarantee */}
        <div className="relative z-10 flex items-center justify-between text-xs text-slate-500 font-mono">
          <span className="flex items-center gap-1.5">
            <Lock size={13} className="text-slate-400" />
            End-to-end local data sovereignty
          </span>
          <span>v1.0.0</span>
        </div>
      </div>

      {/* Right Authentication Panel */}
      <div className="lg:col-span-6 xl:col-span-5 flex flex-col justify-between px-6 py-10 sm:px-12 xl:px-16">
        {/* Mobile Header */}
        <div className="flex items-center gap-2.5 lg:invisible">
          <div className="grid size-8 place-items-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 font-sans font-bold text-sm text-white">
            F
          </div>
          <span className="font-display text-base font-bold tracking-tight text-slate-900 dark:text-white">FinWise</span>
        </div>

        {/* Centered Auth Box */}
        <div className="mx-auto w-full max-w-md my-auto py-8">
          <div className="space-y-2">
            <h2 className="font-display font-bold text-2xl sm:text-3xl tracking-tight text-slate-900 dark:text-white">
              {title}
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              {subtitle}
            </p>
          </div>

          <div className="mt-8">{children}</div>

          <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800 text-center text-xs text-slate-600 dark:text-slate-400">
            {footer}
          </div>
        </div>

        {/* Subtle Disclaimer */}
        <p className="text-[11px] text-slate-400 dark:text-slate-500 text-center">
          FinWise is an analytical ledger system. It does not provide certified financial advice.
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
      subtitle="Access your financial balance sheet, cash runway, and spending analytics."
      footer={
        <>
          Don&apos;t have a ledger yet?{' '}
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
            className="rounded-xl border border-rose-200 bg-rose-50/90 p-3 text-xs text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-400"
          >
            {error.message}
          </div>
        )}

        <Button type="submit" loading={busy} size="lg" className="w-full">
          Sign In
        </Button>
      </form>

      {/* Elegant Demo Access */}
      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-slate-200 dark:border-slate-800" />
        </div>
        <div className="relative flex justify-center text-[11px] uppercase tracking-wider font-mono">
          <span className="bg-slate-50 dark:bg-[#07090E] px-3 text-slate-400">Or preview with sample data</span>
        </div>
      </div>

      <button
        type="button"
        onClick={loginDemo}
        disabled={busy}
        className="group w-full flex items-center justify-between rounded-xl border border-slate-200/90 bg-white p-3.5 text-left transition hover:border-slate-300 hover:bg-slate-50/80 dark:border-slate-800 dark:bg-slate-900/40 dark:hover:border-slate-700 dark:hover:bg-slate-900"
      >
        <div className="flex items-center gap-3">
          <div className="grid size-8 place-items-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
            <Sparkles size={16} />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-900 dark:text-white">
              Launch Sample Ledger
            </p>
            <p className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
              demo@finwise.ai · 8-month historical dataset
            </p>
          </div>
        </div>
        <ArrowRight size={14} className="text-slate-400 group-hover:translate-x-0.5 transition-transform" />
      </button>
    </AuthShell>
  )
}
