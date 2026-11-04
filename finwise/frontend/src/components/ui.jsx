import { AlertCircle, Loader2, X } from 'lucide-react'
import { useEffect } from 'react'

/**
 * Shared primitives. High-craft, authentic fintech UI library:
 * clean borders, honest typography, purposeful contrast, zero AI gimmicks.
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
    <div className="flex items-start justify-between gap-4 border-b border-ink-200 px-5 py-4 dark:border-[#222634]">
      <div className="min-w-0">
        <h3 className="display truncate text-sm font-semibold text-ink-900 dark:text-white">
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
    'bg-ink-900 text-white hover:bg-black dark:bg-ink-100 dark:text-ink-900 dark:hover:bg-white font-medium shadow-sm active:scale-[0.99] disabled:opacity-50',
  secondary:
    'border border-ink-200 bg-white text-ink-800 hover:bg-ink-50 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-100 dark:hover:bg-ink-700 shadow-subtle active:scale-[0.99]',
  ghost:
    'text-ink-600 hover:bg-ink-100 hover:text-ink-900 dark:text-ink-400 dark:hover:bg-ink-800 dark:hover:text-ink-100 active:scale-[0.99]',
  danger:
    'bg-neg text-white hover:opacity-90 shadow-sm active:scale-[0.99]',
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
    sm: 'h-8 px-3 text-xs rounded-md',
    md: 'h-9 px-3.5 text-sm rounded-lg',
    lg: 'h-10 px-4 text-sm rounded-lg',
  }
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 font-medium transition-colors
        disabled:cursor-not-allowed ${sizes[size]} ${BUTTON_VARIANTS[variant]} ${className}`}
      disabled={loading || rest.disabled}
      {...rest}
    >
      {loading && <Loader2 size={14} className="animate-spin" />}
      {children}
    </button>
  )
}

const BADGE_TONES = {
  neutral:
    'bg-ink-100 text-ink-700 dark:bg-ink-800 dark:text-ink-300 border border-ink-200 dark:border-ink-700',
  positive:
    'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-800/60',
  negative:
    'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200/80 dark:border-rose-800/60',
  warning:
    'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200/80 dark:border-amber-800/60',
  brand:
    'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-200/80 dark:border-blue-800/60',
}

export function Badge({ children, tone = 'neutral', className = '' }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium ${BADGE_TONES[tone]} ${className}`}
    >
      {children}
    </span>
  )
}

/**
 * Clean progress bar without gimmicky rainbow animations.
 */
export function ProgressBar({
  value,
  tone = 'brand',
  showLabel = false,
  className = '',
  color = null,
}) {
  const clamped = Math.max(0, Math.min(100, Number(value) || 0))
  const fills = {
    brand: 'bg-brand-500',
    positive: 'bg-pos',
    warning: 'bg-warn',
    negative: 'bg-neg',
  }
  return (
    <div className={className}>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800"
        role="progressbar"
        aria-valuenow={Math.round(clamped)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={`h-full rounded-full transition-all duration-300 ${color ? '' : fills[tone]}`}
          style={{ width: `${clamped}%`, ...(color ? { background: color } : null) }}
        />
      </div>
      {showLabel && <p className="mt-1 text-right text-[11px] muted tnum">{clamped.toFixed(0)}%</p>}
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
        className="absolute inset-0 bg-ink-950/60 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`relative z-10 max-h-[92vh] w-full overflow-y-auto rounded-t-2xl border border-ink-200
          bg-white shadow-pop dark:border-ink-800 dark:bg-ink-900 sm:rounded-card
          ${wide ? 'sm:max-w-2xl' : 'sm:max-w-md'}`}
      >
        <div className="flex items-center justify-between border-b border-ink-200 px-5 py-3.5 dark:border-ink-800">
          <h2 className="text-sm font-semibold text-ink-900 dark:text-white">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-800 dark:hover:bg-ink-800 dark:hover:text-white"
          >
            <X size={16} />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 border-t border-ink-200 px-5 py-3.5 dark:border-ink-800">
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
      <span className="mb-1 block text-xs font-medium text-ink-700 dark:text-ink-300">
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

export const inputClass = `w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm
  placeholder:text-ink-400 shadow-subtle transition-colors
  focus:border-brand-500 focus:ring-1 focus:ring-brand-500
  dark:border-ink-700 dark:bg-[#0D0E12] dark:text-ink-100 dark:focus:border-brand-400
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
    <div className="flex items-center justify-center gap-2 py-16 muted">
      <Loader2 size={16} className="animate-spin text-ink-500" />
      <span className="text-xs font-medium">{label}…</span>
    </div>
  )
}

export function ErrorState({ error, onRetry }) {
  return (
    <div className="card flex flex-col items-center gap-3 py-10 px-6 text-center my-4">
      <AlertCircle size={20} className="text-neg" />
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
    <div className="flex flex-col items-center gap-3 py-12 px-6 text-center">
      {Icon && <Icon size={22} className="text-ink-400" />}
      <div>
        <p className="text-sm font-semibold text-ink-900 dark:text-white">{title}</p>
        {body && <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed muted">{body}</p>}
      </div>
      {action && <div className="mt-1">{action}</div>}
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
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="display text-xl sm:text-2xl text-ink-900 dark:text-white">{title}</h1>
        {subtitle && <p className="mt-0.5 text-xs sm:text-sm muted">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}
