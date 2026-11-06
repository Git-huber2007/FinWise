import { ArrowRight, Check, Eye, EyeOff, Lock, Shield, Sparkles, Terminal } from 'lucide-react'
import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import { useAuth } from '../auth'
import { Field, Input } from '../components/ui'

/**
 * Bespoke "Vault Dossier" Authentication Shell.
 * Uniquely architected to break away from generic split-screen templates:
 * - Machined Double-Bezel hardware enclosure (Doppelrand nested curvature).
 * - Interactive Obsidian Vault Keycard with live telemetry and tactile tilt tension.
 * - Button-in-button nested kinetic interactions.
 * - Architectural blueprint registration marks and strict monochromatic restraint.
 */
export function AuthShell({ title, subtitle, children, footer, isRegister = false }) {
  return (
    <div className="min-h-dvh flex flex-col justify-between bg-[#06080F] text-slate-100 p-4 sm:p-8 lg:p-12 relative overflow-hidden selection:bg-blue-500/20">
      {/* Precision Blueprint Corner Registration Marks */}
      <div className="pointer-events-none absolute top-6 left-6 font-mono text-[10px] text-slate-700 select-none">
        + FW//01
      </div>
      <div className="pointer-events-none absolute top-6 right-6 font-mono text-[10px] text-slate-700 select-none">
        FW//02 +
      </div>
      <div className="pointer-events-none absolute bottom-6 left-6 font-mono text-[10px] text-slate-700 select-none">
        + FW//03
      </div>
      <div className="pointer-events-none absolute bottom-6 right-6 font-mono text-[10px] text-slate-700 select-none">
        FW//04 +
      </div>

      {/* Subtle architectural grid lines */}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#ffffff04_1px,transparent_1px),linear-gradient(to_bottom,#ffffff04_1px,transparent_1px)] bg-[size:48px_48px]" />

      {/* Floating Header Capsule */}
      <header className="relative z-10 w-full max-w-5xl mx-auto flex items-center justify-between py-2 px-4 rounded-full border border-slate-800/80 bg-slate-950/60 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="size-6 rounded-md bg-white text-slate-950 font-bold text-xs grid place-items-center tracking-tighter">
            F
          </div>
          <span className="font-display text-xs font-semibold tracking-wider uppercase text-white">
            FinWise <span className="text-slate-500 font-mono text-[10px] ml-1">/ OS 2.5</span>
          </span>
        </div>

        <div className="flex items-center gap-3 font-mono text-[11px] text-slate-400">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-950/50 border border-emerald-800/40 text-emerald-400 text-[10px]">
            <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
            AIR-GAPPED LOCAL
          </span>
          <span className="hidden sm:inline text-slate-600">|</span>
          <span className="hidden sm:inline text-slate-400">ZERO-TELEMETRY</span>
        </div>
      </header>

      {/* Central Double-Bezel Master Dossier */}
      <main className="relative z-10 my-auto py-8 w-full max-w-5xl mx-auto">
        <div className="p-2 sm:p-2.5 rounded-[2.5rem] bg-gradient-to-b from-slate-800/60 via-slate-900/40 to-slate-950/80 border border-slate-700/40 shadow-2xl backdrop-blur-xl ring-1 ring-white/5">
          <div className="rounded-[calc(2.5rem-0.625rem)] bg-[#090D17] border border-slate-800/80 p-6 sm:p-10 xl:p-12 overflow-hidden relative">
            
            <div className="grid lg:grid-cols-12 gap-8 xl:gap-12 items-center">
              {/* Left Column: Tactile Hardware Ledger Key & Narrative */}
              <div className="lg:col-span-7 space-y-6">
                <div className="space-y-3">
                  <div className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.25em] text-slate-400 border border-slate-800 rounded-md px-2.5 py-1 bg-slate-900/50">
                    <Shield size={11} className="text-slate-300" />
                    <span>Private Financial Enclave</span>
                  </div>
                  
                  <h1 className="font-display text-2xl sm:text-3xl xl:text-4xl font-extrabold tracking-tight text-white leading-tight">
                    Personal wealth,<br />
                    engineered as an offline ledger.
                  </h1>
                  
                  <p className="text-xs sm:text-sm text-slate-400 leading-relaxed font-sans max-w-lg">
                    Deterministic cash flow accounting with sub-second ML categorization and automated tax regime intelligence. No cloud profiling, no third-party data broker leaks.
                  </p>
                </div>

                {/* Tactile Obsidian Metal Ledger Card */}
                <div className="group relative rounded-2xl border border-slate-700/60 bg-gradient-to-br from-slate-900 via-[#0E1424] to-[#0A0F1D] p-5 shadow-xl transition-all duration-500 hover:border-slate-500/80">
                  <div className="flex items-center justify-between pb-4 border-b border-slate-800/80">
                    <div className="flex items-center gap-2">
                      <div className="size-4 rounded-sm border border-amber-500/60 bg-amber-500/20 grid place-items-center">
                        <div className="size-1.5 rounded-full bg-amber-400" />
                      </div>
                      <span className="font-mono text-[10px] uppercase tracking-wider text-slate-300">
                        Secure Enclave Token
                      </span>
                    </div>
                    <span className="font-mono text-[10px] text-slate-500">
                      AES-GCM // DETERMINISTIC
                    </span>
                  </div>

                  <div className="py-4 space-y-1">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500">
                      Authenticated Balance Sheet
                    </p>
                    <div className="flex items-baseline justify-between">
                      <p className="font-display font-bold text-xl sm:text-2xl text-white tracking-tight">
                        ₹ 18,45,200.00
                      </p>
                      <span className="font-mono text-[11px] text-emerald-400 bg-emerald-950/60 border border-emerald-800/40 px-2 py-0.5 rounded">
                        +12.4% ARR
                      </span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono text-slate-400">
                    <div className="flex items-center gap-4">
                      <span>9.4 Mo Runway</span>
                      <span>·</span>
                      <span>Sec 115BAC Ready</span>
                    </div>
                    <span className="text-slate-500 text-[10px]">FW-LEDGER-01</span>
                  </div>
                </div>

                {/* Precision Architectural Nodes */}
                <div className="grid grid-cols-2 gap-3 pt-1 font-mono text-[11px] text-slate-400">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-600 font-bold">[+]</span>
                    <span>Local Scikit-Learn Model</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-600 font-bold">[+]</span>
                    <span>Double-Entry Balance Math</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-600 font-bold">[+]</span>
                    <span>Zero Network Telemetry</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-600 font-bold">[+]</span>
                    <span>Instant PDF &amp; CSV Export</span>
                  </div>
                </div>
              </div>

              {/* Right Column: High-Craft Authentication Terminal */}
              <div className="lg:col-span-5">
                <div className="rounded-2xl border border-slate-800/90 bg-[#0C111E]/95 p-6 sm:p-8 shadow-inner relative">
                  <div className="space-y-1.5 mb-6">
                    <h2 className="font-display font-bold text-xl tracking-tight text-white">
                      {title}
                    </h2>
                    <p className="text-xs text-slate-400">
                      {subtitle}
                    </p>
                  </div>

                  <div>{children}</div>

                  <div className="mt-6 pt-5 border-t border-slate-800 text-center text-xs text-slate-400">
                    {footer}
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </main>

      {/* Bottom Architectural Bar */}
      <footer className="relative z-10 w-full max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] font-mono text-slate-500 py-2">
        <div className="flex items-center gap-2">
          <Lock size={12} className="text-slate-400" />
          <span>Local Sovereign Accounting Engine</span>
        </div>
        <div>
          <span>FinWise Analytical System · Educational Financial Tool</span>
        </div>
      </footer>
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
      title="Access Ledger Vault"
      subtitle="Enter your verified credentials to open your private books."
      footer={
        <>
          Need a fresh ledger?{' '}
          <Link
            to="/register"
            className="font-medium text-white hover:text-blue-400 underline underline-offset-4 transition"
          >
            Initialize Account
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
            className="bg-[#080B13] border-slate-700/80 text-white placeholder:text-slate-600 focus:border-slate-400"
          />
        </Field>

        <Field label="Vault Password" required error={error?.field === 'password' ? error.message : null}>
          <Input
            type="password"
            name="password"
            autoComplete="current-password"
            required
            value={form.password}
            onChange={set('password')}
            placeholder="••••••••"
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

        {/* Button-in-Button Nested Kinetic Action */}
        <button
          type="submit"
          disabled={busy}
          className="group relative w-full rounded-full bg-white text-slate-950 px-5 py-3 text-xs font-semibold tracking-wide flex items-center justify-between transition-all duration-300 hover:bg-slate-100 active:scale-[0.99] disabled:opacity-50"
        >
          <span>{busy ? 'Decrypting Ledger…' : 'Unlock Private Ledger'}</span>
          <div className="size-6 rounded-full bg-slate-950/10 flex items-center justify-center transition-transform group-hover:translate-x-0.5">
            <ArrowRight size={13} className="text-slate-950" />
          </div>
        </button>
      </form>

      {/* Understated Demo Access */}
      <div className="relative my-5">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-slate-800" />
        </div>
        <div className="relative flex justify-center text-[10px] uppercase font-mono tracking-wider">
          <span className="bg-[#0C111E] px-2 text-slate-500">Quick Preview</span>
        </div>
      </div>

      <button
        type="button"
        onClick={loginDemo}
        disabled={busy}
        className="w-full flex items-center justify-between rounded-xl border border-slate-800/80 bg-slate-900/40 p-3 text-left transition-all hover:border-slate-700 hover:bg-slate-900/80"
      >
        <div className="leading-tight">
          <div className="flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-emerald-400" />
            <span className="text-xs font-medium text-slate-200">
              Launch Preloaded Demo Vault
            </span>
          </div>
          <p className="mt-0.5 font-mono text-[10px] text-slate-500">
            demo@finwise.ai · 8-month historical books
          </p>
        </div>
        <ArrowRight size={12} className="text-slate-400" />
      </button>
    </AuthShell>
  )
}
