import { AlertCircle, Loader2, X } from 'lucide-react'
import { useEffect } from 'react'

/**
 * The shared primitives. Every page composes these rather than restyling,
 * which is what keeps nine pages looking like one product.
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
    <div className="flex items-start justify-between gap-4 border-b border-ink-200 px-5 py-4 dark:border-ink-800">
      <div className="min-w-0">
        <h3 className="truncate text-sm font-semibold text-ink-800 dark:text-ink-100">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

/**
 * Primary is near-black in light mode and near-white in dark, not the brand
 * blue.
 *
 * Two reasons, neither cosmetic. The products that do not read as generic
 * fintech (Revolut, Mercury) do the structural work in near-neutral ink and
 * spend saturated colour sparingly as an accent; a blue-filled button on every
 * screen is what makes an interface look like every other dashboard. And the
 * charts now use blue as *data* — slot 1 is Food — so a blue button made the
 * same hue mean both "press me" and "this is your food spending".
 *
 * Chroma now belongs to the data. The chrome is ink.
 */
const BUTTON_VARIANTS = {
  primary:
    'bg-ink-900 text-white hover:bg-ink-800 disabled:bg-ink-900/50 ' +
    'dark:bg-ink-100 dark:text-ink-900 dark:hover:bg-white',
  secondary:
    'border border-ink-200 bg-white text-ink-800 hover:bg-ink-50 dark:border-ink-800 dark:bg-ink-900 dark:text-ink-100 dark:hover:bg-ink-800',
  ghost: 'text-ink-600 hover:bg-ink-100 dark:text-ink-400 dark:hover:bg-ink-800',
  danger: 'bg-neg text-white hover:brightness-110',
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  className = '',
  ...rest
}) {
  const sizes = { sm: 'h-8 px-3 text-xs', md: 'h-10 px-4 text-sm', lg: 'h-11 px-5 text-sm' }
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-medium transition
        disabled:cursor-not-allowed disabled:opacity-60 ${sizes[size]} ${BUTTON_VARIANTS[variant]} ${className}`}
      disabled={loading || rest.disabled}
      {...rest}
    >
      {loading && <Loader2 size={15} className="animate-spin" />}
      {children}
    </button>
  )
}

const BADGE_TONES = {
  neutral: 'bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-400',
  positive: 'bg-pos/10 text-pos',
  negative: 'bg-neg/10 text-neg',
  warning: 'bg-warn/10 text-warn',
  brand: 'bg-brand-500/10 text-brand-400',
}

export function Badge({ children, tone = 'neutral', className = '' }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${BADGE_TONES[tone]} ${className}`}
    >
      {children}
    </span>
  )
}

/**
 * A labelled progress bar. `tone` is computed from utilisation by the caller,
 * because "80% of budget used" is good or bad depending on the day of the month.
 */
export function ProgressBar({
  value,
  tone = 'brand',
  showLabel = false,
  className = '',
  // An explicit colour, for bars that represent a named entity rather than a
  // status. Without it a category's dot and its bar ended up different
  // colours in the same row, which reads as two different things.
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
        className="h-2 w-full overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800"
        role="progressbar"
        aria-valuenow={Math.round(clamped)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={`h-full rounded-full transition-[width] duration-500 ${
            color ? '' : fills[tone]
          }`}
          style={{ width: `${clamped}%`, ...(color ? { background: color } : null) }}
        />
      </div>
      {showLabel && <p className="mt-1 text-right text-[11px] muted tnum">{clamped.toFixed(0)}%</p>}
    </div>
  )
}

export function Modal({ open, onClose, title, children, footer, wide = false }) {
  // Escape to dismiss, and no background scroll while open.
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
        className="absolute inset-0 bg-ink-950/60 backdrop-blur-sm"
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
        <div className="flex items-center justify-between border-b border-ink-200 px-5 py-4 dark:border-ink-800">
          <h2 className="text-sm font-semibold">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="rounded p-1 muted hover:text-ink-800 dark:hover:text-ink-100">
            <X size={18} />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 border-t border-ink-200 px-5 py-4 dark:border-ink-800">
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
      <span className="mb-1.5 block text-xs font-medium text-ink-600 dark:text-ink-400">
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
  placeholder:text-ink-400 focus:border-brand-500 dark:border-ink-800 dark:bg-ink-950
  dark:text-ink-100 disabled:opacity-60`

// className is APPENDED, never replaced -- spreading {...props} after a
// className prop would silently drop every base style, which is invisible in
// code review and obvious only on screen.
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
    <div className="flex items-center justify-center gap-2 py-12 muted">
      <Loader2 size={18} className="animate-spin" />
      <span className="text-sm">{label}…</span>
    </div>
  )
}

export function ErrorState({ error, onRetry }) {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center">
      <AlertCircle size={22} className="text-neg" />
      <p className="max-w-sm text-sm text-ink-600 dark:text-ink-400">
        {error?.message || 'Something went wrong.'}
      </p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  )
}

export function EmptyState({ icon: Icon, title, body, action }) {
  return (
    <div className="flex flex-col items-center gap-3 py-14 text-center">
      {Icon && <Icon size={26} className="muted" />}
      <div>
        <p className="text-sm font-medium">{title}</p>
        {body && <p className="mx-auto mt-1 max-w-sm text-xs muted">{body}</p>}
      </div>
      {action}
    </div>
  )
}

/**
 * Used wherever a figure is modelled rather than measured. Every estimate in
 * this product is labelled as one -- a health score or a forecast presented as
 * fact would be the dishonest part of a finance app.
 */
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
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}
