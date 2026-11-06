import { AlertTriangle, ArrowUpRight, ShieldQuestion } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Badge, Card, CardHeader } from '../components/ui'
import { longDate, money, moneyExact } from '../format'

/**
 * Unusual spending for the user to confirm.
 * Rendered as a restrained ledger audit strip in compact mode, or a structured
 * audit table on the Transactions page.
 */
export default function AnomalyAlerts({ anomalies = [], note, compact = false }) {
  if (anomalies.length === 0) return null

  if (compact) {
    return (
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-card border border-amber-200/80 bg-amber-50/50 px-4 py-2.5 text-xs dark:border-amber-900/40 dark:bg-amber-950/20">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          <span className="inline-flex items-center gap-1.5 font-medium text-slate-900 dark:text-white">
            <span className="size-1.5 rounded-full bg-warn" />
            {anomalies.length} atypical {anomalies.length === 1 ? 'outflow' : 'outflows'} flagged for review:
          </span>
          {anomalies.map((item) => (
            <span key={item.id} className="inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
              <span className="font-mono font-medium text-slate-900 dark:text-white tnum">
                {money(item.amount)}
              </span>
              <span className="truncate max-w-[180px]">{item.description}</span>
              <span className="font-mono text-[10px] text-warn">({item.times_typical}× avg)</span>
            </span>
          ))}
        </div>
        <Link
          to="/transactions"
          className="inline-flex items-center gap-1 font-mono text-[11px] font-medium text-slate-900 hover:underline dark:text-white shrink-0"
        >
          Inspect ledger
          <ArrowUpRight size={12} />
        </Link>
      </div>
    )
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Outliers for confirmation"
        subtitle="Entries significantly larger than your historical category baseline"
        action={<Badge tone="warning">{anomalies.length} flagged</Badge>}
      />
      <ul className="divide-y divide-slate-200/80 dark:divide-slate-800/80">
        {anomalies.map((item) => (
          <li key={item.id} className="flex items-start gap-3 px-5 py-3.5">
            <AlertTriangle
              size={15}
              className={`mt-0.5 shrink-0 ${
                item.severity === 'high' ? 'text-warn' : 'text-slate-400'
              }`}
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="font-medium text-slate-900 dark:text-white truncate">
                  {item.description}
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge tone={item.severity === 'high' ? 'warning' : 'neutral'}>
                    {item.times_typical}× typical
                  </Badge>
                  <span className="font-mono font-semibold text-slate-900 dark:text-white tnum">
                    {moneyExact(item.amount)}
                  </span>
                </div>
              </div>
              <p className="mt-0.5 font-mono text-[11px] muted">
                {item.category} · {longDate(item.date)}
                {item.payment_method && <> · {item.payment_method}</>}
              </p>
              <p className="mt-1 text-xs leading-relaxed muted">{item.reason}</p>
            </div>
          </li>
        ))}
      </ul>
      {note && (
        <p className="flex items-start gap-1.5 border-t border-slate-200/80 px-5 py-3 text-[11px] leading-relaxed muted dark:border-slate-800/80">
          <ShieldQuestion size={12} className="mt-0.5 shrink-0" />
          {note}
        </p>
      )}
    </Card>
  )
}
