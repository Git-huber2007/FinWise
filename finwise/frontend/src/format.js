/**
 * Every number the user sees is formatted here and nowhere else.
 *
 * Centralised because currency formatting that drifts between pages is one of
 * the fastest ways to make a finance app look untrustworthy.
 */

// en-IN groups by the lakh/crore system: 12,34,567 rather than 1,234,567.
const inr0 = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
})

const inr2 = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const plain = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 })

/** ₹45,250 — the default for dashboard tiles and tables. */
export function money(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—'
  return inr0.format(Number(value))
}

/** ₹45,250.75 — for anything where the paise matter, e.g. a single transaction. */
export function moneyExact(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—'
  return inr2.format(Number(value))
}

/**
 * ₹1.2L / ₹2.5Cr — for chart axes and tight spaces.
 * Uses Indian units, not K/M/B, because the audience reads lakh and crore.
 */
export function moneyCompact(value) {
  const n = Number(value)
  if (value === null || value === undefined || Number.isNaN(n)) return '—'
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  if (abs >= 1e7) return `${sign}₹${(abs / 1e7).toFixed(abs >= 1e8 ? 0 : 1)}Cr`
  if (abs >= 1e5) return `${sign}₹${(abs / 1e5).toFixed(abs >= 1e6 ? 0 : 1)}L`
  if (abs >= 1e3) return `${sign}₹${(abs / 1e3).toFixed(abs >= 1e4 ? 0 : 1)}K`
  return `${sign}₹${plain.format(abs)}`
}

/** 24.5% — one decimal, because a whole-number percentage hides small movement. */
export function pct(value, digits = 1) {
  const n = Number(value)
  if (value === null || value === undefined || Number.isNaN(n)) return '—'
  return `${n.toFixed(digits)}%`
}

/** +12.4% / -3.1% — signed, for month-over-month deltas. */
export function signedPct(value, digits = 1) {
  const n = Number(value)
  if (value === null || value === undefined || Number.isNaN(n)) return '—'
  return `${n > 0 ? '+' : ''}${n.toFixed(digits)}%`
}

/** 9 May 2026 */
export function longDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** 9 May — for dense tables where the year is implied by the filter. */
export function shortDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

/** May 2026 — from a {month, year} pair (month is 1-based, as the API sends it). */
export function monthLabel(month, year) {
  return new Date(year, month - 1, 1).toLocaleDateString('en-IN', {
    month: 'short',
    year: 'numeric',
  })
}

/** Today as YYYY-MM-DD in LOCAL time — `toISOString()` would shift the date in IST. */
export function todayISO() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Tailwind text colour for a signed figure. Expenses are not inherently bad. */
export function deltaClass(value, { invert = false } = {}) {
  const n = Number(value)
  if (!n) return 'text-ink-400'
  const good = invert ? n < 0 : n > 0
  return good ? 'text-pos' : 'text-neg'
}
