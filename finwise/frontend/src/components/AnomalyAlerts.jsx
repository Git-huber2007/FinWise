import { AlertTriangle, ShieldQuestion } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Badge, Card, CardHeader } from '../components/ui'
import { longDate, money, moneyExact } from '../format'

/**
 * Unusual spending for the user to confirm.
 *
 * The wording here is the whole point of the component. These are transactions
 * that are large compared with the user's own history, and the overwhelmingly
 * likely explanation is that they made the purchase and remember it. So:
 *
 * * never the word "fraud", and never "suspicious"
 * * phrased as a question, not an accusation
 * * each one states the figure it was compared against, so the user can judge
 *   the claim rather than take it on trust
 *
 * Shared by the Dashboard and the Transactions page so that wording cannot
 * drift between the two places it appears.
 */
export default function AnomalyAlerts({ anomalies = [], note, compact = false }) {
  if (anomalies.length === 0) return null

  if (compact) {
    return (
      <div className="mb-4 rounded-xl border border-warn/30 bg-warn/[0.07] p-4">
        <p className="flex items-center gap-2 text-sm font-medium">
          <AlertTriangle size={15} className="shrink-0 text-warn" />
          {anomalies.length} unusually large{' '}
          {anomalies.length === 1 ? 'expense' : 'expenses'} to check
        </p>
        {/* The full reasoning lives on the Transactions page and in the PDF.
            Repeating it here made a banner taller than the figure it sits
            above, which inverted the page's hierarchy. */}
        <ul className="mt-2 space-y-1.5">
          {anomalies.map((item) => (
            <li key={item.id} className="flex flex-wrap items-baseline gap-x-2 text-xs">
              <span className="font-medium tnum">{money(item.amount)}</span>
              <span>{item.description}</span>
              <span className="muted">
                {item.category} · {longDate(item.date)}
              </span>
              <Badge tone="warning">{item.times_typical}× typical</Badge>
            </li>
          ))}
        </ul>
        <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-relaxed muted">
          <ShieldQuestion size={12} className="mt-0.5 shrink-0" />
          Not fraud alerts — unusual for you, so worth a look.{' '}
          <Link to="/transactions" className="text-brand-400 hover:underline">
            Review
          </Link>
        </p>
      </div>
    )
  }

  return (
    <Card>
      <CardHeader
        title="Spending to confirm"
        subtitle="Unusually large compared with your own history"
        action={<Badge tone="warning">{anomalies.length}</Badge>}
      />
      <ul className="divide-y divide-ink-200 dark:divide-ink-800">
        {anomalies.map((item) => (
          <li key={item.id} className="flex items-start gap-3 p-4">
            <AlertTriangle
              size={16}
              className={`mt-0.5 shrink-0 ${
                item.severity === 'high' ? 'text-warn' : 'text-ink-400'
              }`}
            />
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                <span className="truncate">{item.description}</span>
                <span className="tnum">{moneyExact(item.amount)}</span>
                <Badge tone={item.severity === 'high' ? 'warning' : 'neutral'}>
                  {item.times_typical}× typical
                </Badge>
              </p>
              <p className="mt-0.5 text-xs muted">
                {item.category} · {longDate(item.date)}
                {item.payment_method && <> · {item.payment_method}</>}
              </p>
              <p className="mt-1.5 text-xs leading-relaxed muted">{item.reason}</p>
              <p className="mt-1 text-[11px] muted">
                Detected by {item.method}
                {item.forest_agrees && ', confirmed by an IsolationForest model'}. Was this
                you?
              </p>
            </div>
          </li>
        ))}
      </ul>
      {note && (
        <p className="flex items-start gap-1.5 border-t border-ink-200 p-4 text-[11px] leading-relaxed muted dark:border-ink-800">
          <ShieldQuestion size={12} className="mt-0.5 shrink-0" />
          {note}
        </p>
      )}
    </Card>
  )
}
