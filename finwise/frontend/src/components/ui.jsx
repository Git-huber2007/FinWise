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
    <div className="flex items-center justify-between gap-4 border-b border-ink-200/90 px-5 py-3.5 dark:border-[#242421]">
      <div className="min-w-0">
        <h3 className="truncate text-[13px] font-semibold text-ink-900 dark:text-ink-100">
          {title}
        </h3>
        {subtitle && <p className="mt-0.5 text-xs muted">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

const BUTTON_VARIANTS = {
  primary:
    'bg-ink-900 text-[#F8F7F4] hover:bg-ink-800 dark:bg-ink-100 dark:text-ink-900 dark:hover:bg-white font-medium shadow-subtle active:scale-[0.98] disabled:opacity-50',
  secondary:
    'border border-ink-300 bg-white text-ink-800 hover:bg-ink-50 dark:border-[#2E2E2A] dark:bg-[#161615] dark:text-ink-100 dark:hover:bg-[#1E1E1C] active:scale-[0.98]',
  ghost:
    'text-ink-600 hover:bg-ink-100 hover:text-ink-900 dark:text-ink-400 dark:hover:bg-[#1A1A18] dark:hover:text-ink-100 active:scale-[0.98]',
  danger:
    'bg-neg text-white hover:opacity-90 active:scale-[0.98]',
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
    'bg-ink-100 text-ink-700 dark:bg-[#1C1C1A] dark:text-ink-300 border border-ink-200 dark:border-[#2C2C28]',
  positive:
    'bg-emerald-50/80 text-pos dark:bg-emerald-950/30 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-900/50',
  negative:
    'bg-rose-50/80 text-neg dark:bg-rose-950/30 dark:text-rose-400 border border-rose-200/80 dark:border-rose-900/50',
  warning:
    'bg-amber-50/80 text-warn dark:bg-amber-950/30 dark:text-amber-400 border border-amber-200/80 dark:border-amber-900/50',
  brand:
    'bg-ink-100 text-ink-900 dark:bg-[#1E1E1C] dark:text-ink-200 border border-ink-300 dark:border-[#33332F]',
}

export function Badge({ children, tone = 'neutral', className = '' }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[11px] font-medium ${BADGE_TONES[tone]} ${className}`}
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
        className="absolute inset-0 bg-ink-950/50 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`relative z-10 max-h-[92dvh] w-full overflow-y-auto rounded-t-xl border border-ink-200
          bg-white shadow-pop dark:border-[#282825] dark:bg-[#141413] sm:rounded-card
          ${wide ? 'sm:max-w-2xl' : 'sm:max-w-md'}`}
      >
        <div className="flex items-center justify-between border-b border-ink-200 px-5 py-3.5 dark:border-[#242421]">
          <h2 className="text-sm font-semibold text-ink-900 dark:text-white">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-800 dark:hover:bg-[#222220] dark:hover:text-white"
          >
            <X size={15} />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 border-t border-ink-200 px-5 py-3 dark:border-[#242421]">
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

export const inputClass = `w-full rounded-md border border-ink-300 bg-white px-3 py-1.5 text-sm
  placeholder:text-ink-400 transition-colors
  focus:border-ink-900 focus:outline-none focus:ring-1 focus:ring-ink-900
  dark:border-[#2E2E2A] dark:bg-[#0E0E0D] dark:text-ink-100 dark:focus:border-ink-200 dark:focus:ring-ink-200
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
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-ink-200/90 pb-4 dark:border-[#242421]">
      <div>
        <h1 className="display-serif text-2xl sm:text-3xl text-ink-900 dark:text-ink-100">{title}</h1>
        {subtitle && <p className="mt-0.5 text-xs sm:text-sm muted">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}
