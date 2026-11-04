import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Info,
  Stethoscope,
  Target,
  TrendingDown,
} from 'lucide-react'
import { useState } from 'react'

import { api } from '../api'
import {
  Badge,
  Button,
  Card,
  CardHeader,
  ErrorState,
  EstimateNote,
  PageHeader,
  ProgressBar,
  Spinner,
} from '../components/ui'
import { money, pct } from '../format'

export default function Health() {
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function analyse() {
    setLoading(true)
    setError(null)
    try {
      setResult(await api.post('/api/ai/financial-health'))
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Financial Health Checkup"
        subtitle="A transparent score from your own transactions — every weight is shown"
        action={
          result && (
            <Button variant="secondary" onClick={analyse} loading={loading}>
              Re-analyse
            </Button>
          )
        }
      />

      {!result && !error && (
        <Card className="p-10">
          <div className="mx-auto flex max-w-md flex-col items-center gap-4 text-center">
            <Stethoscope size={28} className="text-brand-400" />
            <div>
              <p className="text-sm font-medium">Check your financial health</p>
              <p className="mt-1 text-xs leading-relaxed muted">
                Six components, scored out of 100 from the income, expenses, budgets and
                emergency fund you have recorded. You will see every weight and the figures
                behind each one.
              </p>
            </div>
            <Button size="lg" onClick={analyse} loading={loading}>
              Analyse my financial health
            </Button>
          </div>
        </Card>
      )}

      {error && <ErrorState error={error} onRetry={analyse} />}
      {loading && !result && <Spinner label="Analysing" />}

      {result && (
        <div className="space-y-5">
          <ScoreCard result={result} />

          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader
                title="How the score is built"
                subtitle="Each component, its weight, and the numbers behind it"
              />
              <div className="divide-y divide-ink-100 dark:divide-ink-800/60">
                {result.components.map((component) => (
                  <ComponentRow key={component.key} component={component} />
                ))}
              </div>
            </Card>

            <div className="space-y-5">
              {result.warnings.length > 0 && (
                <Card>
                  <CardHeader title="Spending warnings" />
                  <ul className="space-y-2.5 p-5">
                    {result.warnings.map((warning, index) => (
                      <li key={index} className="flex gap-2 text-xs leading-relaxed">
                        <AlertTriangle size={14} className="mt-0.5 shrink-0 text-warn" />
                        <span>{warning}</span>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}

              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                <ListCard
                  title="Strengths"
                  icon={CheckCircle2}
                  tone="text-pos"
                  items={result.strengths}
                  empty="No component is scoring above 75% yet."
                />
                <ListCard
                  title="Areas to improve"
                  icon={TrendingDown}
                  tone="text-neg"
                  items={result.weaknesses}
                  empty="No component is scoring below 50%."
                />
              </div>

              {result.suggested_savings_target && (
                <SavingsTargetCard target={result.suggested_savings_target} />
              )}
            </div>
          </div>

          {result.recommendations.length > 0 && (
            <Card>
              <CardHeader
                title="Personalised recommendations"
                subtitle="Aimed at your weakest components first"
              />
              <ul className="space-y-3 p-5">
                {result.recommendations.map((item, index) => (
                  <li key={index} className="flex gap-2.5 text-sm leading-relaxed">
                    <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand-500/10 text-[11px] font-semibold text-brand-400">
                      {index + 1}
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {result.monthly_plan.length > 0 && (
            <Card>
              <CardHeader
                title="Monthly improvement plan"
                subtitle="Each step names the figure it came from"
              />
              <div className="divide-y divide-ink-100 dark:divide-ink-800/60">
                {result.monthly_plan.map((step, index) => (
                  <div key={index} className="flex gap-3 px-5 py-3.5">
                    <ClipboardList size={15} className="mt-0.5 shrink-0 text-brand-400" />
                    <div>
                      <p className="text-sm font-medium">{step.step}</p>
                      <p className="mt-0.5 text-xs leading-relaxed muted">{step.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card className="p-5">
            <p className="flex items-start gap-2 text-[11px] leading-relaxed muted">
              <Info size={13} className="mt-0.5 shrink-0" />
              <span>{result.disclaimer}</span>
            </p>
          </Card>
        </div>
      )}
    </>
  )
}

function ScoreCard({ result }) {
  const tone =
    result.score >= 65 ? 'text-pos' : result.score >= 50 ? 'text-warn' : 'text-neg'
  const bar = result.score >= 65 ? 'positive' : result.score >= 50 ? 'warning' : 'negative'

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-center gap-6">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide muted">
            Financial Health Score
          </p>
          <p className={`mt-1 text-4xl font-semibold tnum ${tone}`}>
            {result.score}
            <span className="text-lg font-normal muted"> / 100</span>
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <Badge tone={result.score >= 65 ? 'positive' : result.score >= 50 ? 'warning' : 'negative'}>
              {result.band}
            </Badge>
            <span className="text-[11px] muted">
              {result.months_of_data} month(s) of data · {result.month_label}
            </span>
          </div>
        </div>

        <div className="min-w-[240px] flex-1">
          <ProgressBar value={result.score} tone={bar} />
          <div className="mt-1.5 flex justify-between text-[10px] muted">
            <span>0 · At risk</span>
            <span>50 · Fair</span>
            <span>100 · Excellent</span>
          </div>
        </div>
      </div>

      {result.provisional && (
        <EstimateNote>
          Provisional — based on fewer than three months of data. The score will become
          more reliable as you record more transactions.
        </EstimateNote>
      )}
    </Card>
  )
}

function ComponentRow({ component }) {
  const tone =
    component.pct >= 75 ? 'positive' : component.pct >= 50 ? 'warning' : 'negative'

  return (
    <div className="px-5 py-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-medium">
          {component.label}
          {component.neutral && (
            <Badge tone="neutral" className="ml-2">
              not scored
            </Badge>
          )}
          {component.self_reported && (
            <Badge tone="neutral" className="ml-2">
              self-reported
            </Badge>
          )}
        </p>
        <p className="shrink-0 text-sm tnum">
          <span className="font-semibold">{component.points}</span>
          <span className="muted"> / {component.max_points}</span>
        </p>
      </div>

      <ProgressBar className="mt-2" value={component.pct} tone={component.neutral ? 'brand' : tone} />
      <p className="mt-1.5 text-xs leading-relaxed muted">{component.explanation}</p>
    </div>
  )
}

function ListCard({ title, icon: Icon, tone, items, empty }) {
  return (
    <Card>
      <CardHeader title={title} />
      <div className="p-5">
        {items.length ? (
          <ul className="space-y-2">
            {items.map((item) => (
              <li key={item} className="flex items-start gap-2 text-xs">
                <Icon size={14} className={`mt-0.5 shrink-0 ${tone}`} />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs muted">{empty}</p>
        )}
      </div>
    </Card>
  )
}

function SavingsTargetCard({ target }) {
  return (
    <Card>
      <CardHeader title="Suggested savings target" subtitle={target.basis} />
      <div className="p-5">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-wide muted">Target</p>
            <p className="mt-0.5 text-lg font-semibold tnum">{money(target.monthly_target)}</p>
          </div>
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-wide muted">You saved</p>
            <p
              className={`mt-0.5 text-lg font-semibold tnum ${
                target.achieved ? 'text-pos' : 'text-neg'
              }`}
            >
              {money(target.current_savings)}
            </p>
          </div>
        </div>

        <ProgressBar
          className="mt-3"
          value={
            target.monthly_target > 0
              ? (target.current_savings / target.monthly_target) * 100
              : 0
          }
          tone={target.achieved ? 'positive' : 'warning'}
        />

        <p className="mt-2 flex items-center gap-1.5 text-xs muted">
          <Target size={13} />
          {target.achieved
            ? 'Target met this month.'
            : `${money(target.gap)} short of the target.`}
        </p>
      </div>
    </Card>
  )
}
