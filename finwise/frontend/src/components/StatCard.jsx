import { ArrowDownRight, ArrowUpRight } from 'lucide-react'

import { money, pct, signedPct } from '../format'
import { Card, ProgressBar } from './ui'

/**
 * One dashboard tile.
 *
 * `goodDirection` exists because a rising number is not inherently good: more
 * income is good, more expenses is not. Colouring both green would be
 * actively misleading.
 */
export default function StatCard({
  label,
  value,
  previous,
  format = 'money',
  goodDirection = 'up',
  hint,
  tone,
  progress,
  icon: Icon,
}) {
  const formatted =
    format === 'money' ? money(value) : format === 'pct' ? pct(value) : value ?? '—'

  const change =
    previous !== null && previous !== undefined && previous > 0 && typeof value === 'number'
      ? ((value - previous) / previous) * 100
      : null

  const improved = change === null ? null : goodDirection === 'up' ? change > 0 : change < 0
  const Arrow = change !== null && change > 0 ? ArrowUpRight : ArrowDownRight

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-wide muted">{label}</p>
        {Icon && <Icon size={15} className="shrink-0 muted" />}
      </div>

      <p className={`mt-1.5 text-xl font-semibold tnum ${tone || ''}`}>{formatted}</p>

      {change !== null && Math.abs(change) >= 0.1 && (
        <p
          className={`mt-1 flex items-center gap-0.5 text-[11px] tnum ${
            improved ? 'text-pos' : 'text-neg'
          }`}
        >
          <Arrow size={12} />
          {signedPct(change)} vs last month
        </p>
      )}

      {hint && <p className="mt-1 text-[11px] muted">{hint}</p>}

      {progress !== null && progress !== undefined && (
        <ProgressBar
          className="mt-2.5"
          value={progress}
          tone={progress > 100 ? 'negative' : progress >= 80 ? 'warning' : 'positive'}
        />
      )}
    </Card>
  )
}
