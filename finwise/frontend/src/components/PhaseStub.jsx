import { Hammer } from 'lucide-react'

import { Card, PageHeader } from './ui'

/**
 * Placeholder for a page whose feature lands in a later phase.
 *
 * It states plainly which phase builds it rather than showing fake charts or
 * dead buttons -- a control that looks real but does nothing is worse than an
 * honest gap, because it cannot be told apart from a bug.
 */
export default function PhaseStub({ title, subtitle, phase, building }) {
  return (
    <>
      <PageHeader title={title} subtitle={subtitle} />
      <Card className="p-8">
        <div className="flex flex-col items-center gap-4 text-center">
          <Hammer size={22} className="muted" />
          <div>
            <p className="text-sm font-medium">Built in Phase {phase}</p>
            <p className="mx-auto mt-1 max-w-md text-xs muted">
              This screen is routed and styled; its data and controls arrive in Phase {phase}.
            </p>
          </div>
          {building?.length > 0 && (
            <ul className="mt-1 space-y-1 text-left text-xs muted">
              {building.map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="text-brand-400">·</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>
    </>
  )
}
