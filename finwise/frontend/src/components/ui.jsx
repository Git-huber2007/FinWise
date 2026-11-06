import { AlertCircle, Loader2, X } from 'lucide-react'
import { useEffect } from 'react'

/**
 * Shared primitives — Architectural Swiss Ledger system.
 * Warm stone paper, carbon ink, 1px structural hairlines, tabular numerals.
 */

export function Card({ children, className = '', ...rest }) {
  return (
    <div className={`card ${className}`} {...rest}>
      {children}
    </div>
  )
}

export function CardHeader({ title, subtitle, action }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-200/80 px-5 py-3.5 dark:border-slate-800/80">
      <div className="min-w-0">
        <h3 className="truncate text-[13px] font-semibold text-ink-900 dark:text-white tracking-tight">
          {title}
        </h3>
        {subtitle && <p className="mt-0.5 text-xs text-ink-500 dark:text-ink-400">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

const BUTTON_VARIANTS = {
  primary:
    'rounded-lg bg-slate-900 text-white hover:bg-slate-800 shadow-[0_1px_2px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.15)] dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 font-medium active:scale-[0.98] disabled:opacity-50 transition-all',
  secondary:
    'rounded-lg border border-slate-200 bg-white text-slate-800 hover:bg-slate-50 shadow-sm dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-200 dark:hover:bg-slate-800 active:scale-[0.98] transition-all',
  ghost:
    'rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-white active:scale-[0.98] transition-all',
  danger:
    'rounded-lg bg-rose-600 text-white hover:bg-rose-500 shadow-sm active:scale-[0.98] transition-all',
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  className = '',
  ...rest
}) {
  const sizes = {
    sm: 'h-7 px-2.5 text-xs rounded',
    md: 'h-8 px-3 text-xs rounded-md',
    lg: 'h-9 px-4 text-sm rounded-md',
  }
  return (
    <button
      className={`inline-flex items-center justify-center gap-1.5 font-medium transition-[background-color,border-color,color,transform] duration-150
        disabled:cursor-not-allowed ${sizes[size]} ${BUTTON_VARIANTS[variant]} ${className}`}
      disabled={loading || rest.disabled}
      {...rest}
    >
      {loading && <Loader2 size={13} className="animate-spin" />}
      {children}
    </button>
  )
}

const BADGE_TONES = {
  neutral:
    'bg-slate-100 text-slate-700 dark:bg-slate-800/80 dark:text-slate-300 border border-slate-200/90 dark:border-slate-700/60',
  positive:
    'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-800/50',
  negative:
    'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200/80 dark:border-rose-800/50',
  warning:
    'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200/80 dark:border-amber-800/50',
  brand:
    'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-200/80 dark:border-blue-800/50',
}

export function Badge({ children, tone = 'neutral', className = '' }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-[11px] font-medium tracking-tight ${BADGE_TONES[tone]} ${className}`}
    >
      {children}
    </span>
  )
}

export function ProgressBar({
  value,
  tone = 'brand',
  showLabel = false,
  className = '',
  color = null,
}) {
  const clamped = Math.max(0, Math.min(100, Number(value) || 0))
  const fills = {
    brand: 'bg-ink-900 dark:bg-ink-100',
    positive: 'bg-pos',
    warning: 'bg-warn',
    negative: 'bg-neg',
  }
  return (
    <div className={className}>
      <div
        className="h-1 w-full overflow-hidden rounded-sm bg-ink-100 dark:bg-[#222220]"
        role="progressbar"
        aria-valuenow={Math.round(clamped)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={`h-full transition-[width] duration-300 ${color ? '' : fills[tone]}`}
          style={{ width: `${clamped}%`, ...(color ? { background: color } : null) }}
        />
      </div>
      {showLabel && <p className="mt-1 text-right font-mono text-[11px] muted tnum">{clamped.toFixed(0)}%</p>}
    </div>
  )
}

export function Modal({ open, onClose, title, children, footer, wide = false }) {
  useEffect(() => {
    if (!open) return undefined
    const onKey = (event) => event.key === 'Escape' && onClose?.()
    document.addEventListener('keydown', onKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`relative z-10 max-h-[92dvh] w-full overflow-y-auto rounded-t-2xl border border-slate-200/90
          bg-white shadow-pop dark:border-slate-800 dark:bg-[#0D121F] sm:rounded-2xl
          ${wide ? 'sm:max-w-2xl' : 'sm:max-w-md'}`}
      >
        <div className="flex items-center justify-between border-b border-slate-200/80 px-6 py-4 dark:border-slate-800/80">
          <h2 className="text-sm font-semibold tracking-tight text-ink-900 dark:text-white">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-800/60 dark:hover:text-white transition-colors"
          >
            <X size={15} />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2.5 border-t border-slate-200/80 px-6 py-3.5 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/30">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

export function Field({ label, error, hint, children, required }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-ink-700 dark:text-ink-300">
        {label}
        {required && <span className="ml-0.5 text-neg">*</span>}
      </span>
      {children}
      {error ? (
        <span className="mt-1 block text-xs text-neg">{error}</span>
      ) : (
        hint && <span className="mt-1 block text-xs muted">{hint}</span>
      )}
    </label>
  )
}

export const inputClass = `w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm
  placeholder:text-slate-400 transition-all
  focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20
  dark:border-slate-800 dark:bg-slate-950/80 dark:text-white dark:focus:border-blue-400 dark:focus:ring-blue-400/20
  disabled:opacity-60`

export function Input({ className = '', ...props }) {
  return <input {...props} className={`${inputClass} ${className}`} />
}

export function Select({ children, className = '', ...props }) {
  return (
    <select {...props} className={`${inputClass} ${className}`}>
      {children}
    </select>
  )
}

export function Spinner({ label = 'Loading' }) {
  return (
    <div className="flex items-center justify-center gap-2 py-20 muted">
      <Loader2 size={15} className="animate-spin text-ink-500" />
      <span className="font-mono text-xs">{label}…</span>
    </div>
  )
}

export function ErrorState({ error, onRetry }) {
  return (
    <div className="card flex flex-col items-center gap-3 py-10 px-6 text-center my-4">
      <AlertCircle size={18} className="text-neg" />
      <p className="max-w-sm text-sm text-ink-700 dark:text-ink-300">
        {error?.message || 'Something went wrong.'}
      </p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry} className="mt-1">
          Try again
        </Button>
      )}
    </div>
  )
}

export function EmptyState({ icon: Icon, title, body, action }) {
  return (
    <div className="flex flex-col items-center gap-2.5 py-12 px-6 text-center">
      {Icon && <Icon size={20} className="text-ink-400" strokeWidth={1.5} />}
      <div>
        <p className="text-sm font-medium text-ink-900 dark:text-white">{title}</p>
        {body && <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed muted">{body}</p>}
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

export function EstimateNote({ children }) {
  return (
    <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed muted">
      <AlertCircle size={12} className="mt-0.5 shrink-0" />
      <span>{children}</span>
    </p>
  )
}

export function PageHeader({ title, subtitle, action }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-slate-200/80 pb-4 dark:border-slate-800/80">
      <div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-ink-900 dark:text-white">{title}</h1>
        {subtitle && <p className="mt-1 text-xs sm:text-sm text-ink-500 dark:text-ink-400">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}
