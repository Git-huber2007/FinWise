import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Info,
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
import { money } from '../format'

export default function Health() {
  const [result, setResult] = useState(null)
  const [runway, setRunway] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function analyse() {
    setLoading(true)
    setError(null)
    try {
      const [healthRes, runwayRes] = await Promise.all([
        api.post('/api/ai/financial-health'),
        api.get('/api/ai/runway').catch(() => null),
      ])
      setResult(healthRes)
      if (runwayRes) setRunway(runwayRes)
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Financial Health Index"
        subtitle="A transparent composite score derived from your ledger — every component weight is exposed"
        action={
          result && (
            <Button variant="secondary" onClick={analyse} loading={loading}>
              Re-compute
            </Button>
          )
        }
      />

      {!result && !error && (
        <Card className="p-10">
          <div className="mx-auto flex max-w-md flex-col items-center gap-4 text-center">
            <div className="grid h-10 w-10 place-items-center rounded-md border border-ink-200 bg-ink-50 text-ink-700 dark:border-[#242422] dark:bg-[#1A1A18] dark:text-ink-300">
              <Activity size={18} strokeWidth={1.75} />
            </div>
            <div>
              <p className="text-sm font-medium text-ink-900 dark:text-ink-100">
                Run composite health audit
              </p>
              <p className="mt-1 text-xs leading-relaxed muted">
                Six weighted components scored out of 100 from your recorded inflows, outflows,
                budget ceilings, and emergency reserves. Every formula weight is exposed.
              </p>
            </div>
            <Button size="lg" onClick={analyse} loading={loading}>
              Compute health score
            </Button>
          </div>
        </Card>
      )}

      {error && <ErrorState error={error} onRetry={analyse} />}
      {loading && !result && <Spinner label="Analysing" />}

      {result && (
        <div className="space-y-6">
          <ScoreCard result={result} />

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader
                title="Component breakdown"
                subtitle="Each factor, its maximum weight, and the underlying ledger figures"
              />
              <div className="divide-y divide-ink-200 dark:divide-[#222220]">
                {result.components.map((component) => (
                  <ComponentRow key={component.key} component={component} />
                ))}
              </div>
            </Card>

            <div className="space-y-6">
              {result.warnings.length > 0 && (
                <Card>
                  <CardHeader title="Audit flags" />
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

              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                <ListCard
                  title="Strengths"
                  icon={CheckCircle2}
                  tone="text-pos"
                  items={result.strengths}
                  empty="No component is scoring above 75% yet."
                />
                <ListCard
                  title="Constraints"
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
                title="Recommended adjustments"
                subtitle="Prioritised by lowest-scoring ledger components"
              />
              <ul className="space-y-3 p-5">
                {result.recommendations.map((item, index) => (
                  <li key={index} className="flex gap-2.5 text-sm leading-relaxed">
                    <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded bg-ink-100 font-mono text-[11px] font-medium text-ink-900 dark:bg-[#222220] dark:text-ink-100">
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
                title="Monthly action schedule"
                subtitle="Concrete adjustments derived from your recorded figures"
              />
              <div className="divide-y divide-ink-200 dark:divide-[#222220]">
                {result.monthly_plan.map((step, index) => (
                  <div key={index} className="flex gap-3 px-5 py-3.5">
                    <ClipboardList size={15} className="mt-0.5 shrink-0 text-ink-500" />
                    <div>
                      <p className="text-sm font-medium text-ink-900 dark:text-ink-100">{step.step}</p>
                      <p className="mt-0.5 text-xs leading-relaxed muted">{step.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {runway && <RunwaySimulatorCard runway={runway} />}

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
  const bar = result.score >= 65 ? 'positive' : result.score >= 50 ? 'warning' : 'negative'

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-center gap-6">
        <div>
          <p className="text-xs font-medium text-ink-500 dark:text-ink-400">
            Composite Health Index
          </p>
          <p className="display-serif mt-1 text-4xl text-ink-900 dark:text-ink-100 tnum">
            {result.score}
            <span className="font-sans text-lg font-normal muted"> / 100</span>
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <Badge tone={result.score >= 65 ? 'positive' : result.score >= 50 ? 'warning' : 'negative'}>
              {result.band}
            </Badge>
            <span className="font-mono text-[11px] muted">
              {result.months_of_data}m history · {result.month_label}
            </span>
          </div>
        </div>

        <div className="min-w-[240px] flex-1">
          <ProgressBar value={result.score} tone={bar} />
          <div className="mt-1.5 flex justify-between font-mono text-[10px] muted">
            <span>0 · Critical</span>
            <span>50 · Moderate</span>
            <span>100 · Optimal</span>
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
        <p className="text-sm font-medium text-ink-900 dark:text-ink-100">
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
        <p className="shrink-0 font-mono text-xs tnum">
          <span className="font-semibold text-ink-900 dark:text-ink-100">{component.points}</span>
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
      <CardHeader title="Target monthly retention" subtitle={target.basis} />
      <div className="p-5">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs text-ink-500">Recommended target</p>
            <p className="mt-0.5 font-mono text-lg font-medium text-ink-900 dark:text-ink-100 tnum">
              {money(target.monthly_target)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-ink-500">Recorded savings</p>
            <p className="mt-0.5 font-mono text-lg font-medium text-ink-900 dark:text-ink-100 tnum">
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
            : `${money(target.gap)} short of target.`}
        </p>
      </div>
    </Card>
  )
}

function RunwaySimulatorCard({ runway }) {
  if (!runway) return null
  const { liquid_reserves, total_survival_burn, scenarios = {} } = runway
  const { barebones_survival, lifestyle_maintenance, inflation_shock_20pct, emergency_medical_shock } = scenarios

  return (
    <Card className="p-5">
      <CardHeader
        title="Emergency Runway & Financial Safety Simulator"
        subtitle="Months of survival coverage under real economic shocks and unexpected income loss"
      />

      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-3.5 dark:border-slate-800 dark:bg-slate-900/40">
          <p className="font-mono text-[10px] uppercase muted">Liquid Reserves</p>
          <p className="mt-1 font-display text-xl font-bold tracking-tight text-ink-900 dark:text-white tnum">
            {money(liquid_reserves)}
          </p>
          <p className="mt-0.5 text-[10px] muted">Available cash & bank accounts</p>
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-3.5 dark:border-slate-800 dark:bg-slate-900/40">
          <p className="font-mono text-[10px] uppercase muted">Survival Monthly Burn</p>
          <p className="mt-1 font-display text-xl font-bold tracking-tight text-ink-900 dark:text-white tnum">
            {money(total_survival_burn)}/mo
          </p>
          <p className="mt-0.5 text-[10px] muted">Essentials + required loan EMIs</p>
        </div>

        <div className="col-span-2 sm:col-span-1 rounded-xl border-2 border-emerald-500/40 bg-emerald-50/40 dark:bg-emerald-950/20 p-3.5">
          <p className="font-mono text-[10px] uppercase font-semibold text-pos">Current Survival Runway</p>
          <p className="mt-1 font-display text-2xl font-bold tracking-tight text-pos tnum">
            {barebones_survival?.runway_months ?? 0} months
          </p>
          <p className="mt-0.5 text-[10px] muted">Months before reserve depletion</p>
        </div>
      </div>

      {/* Stress-Test Scenarios */}
      <div className="mt-5">
        <p className="font-mono text-[11px] uppercase tracking-wider muted mb-3">
          Stress-Test Scenarios
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-xs">
          {[barebones_survival, lifestyle_maintenance, inflation_shock_20pct, emergency_medical_shock]
            .filter(Boolean)
            .map((s, idx) => (
              <div
                key={idx}
                className="rounded-md border border-ink-200/80 bg-white p-3 dark:border-[#282825] dark:bg-[#161614]"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-ink-900 dark:text-ink-100 truncate">
                    {s.title}
                  </span>
                  <span className="font-mono font-medium text-ink-900 dark:text-ink-100">
                    {s.runway_months}m
                  </span>
                </div>
                <p className="mt-1 font-mono text-[10px] text-ink-600 dark:text-ink-400">
                  {money(s.monthly_burn)}/mo
                </p>
                <p className="mt-1 text-[11px] muted leading-normal">{s.description}</p>
              </div>
            ))}
        </div>
      </div>
    </Card>
  )
}
