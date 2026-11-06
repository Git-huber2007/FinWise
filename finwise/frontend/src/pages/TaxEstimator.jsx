import {
  ArrowRight,
  CheckCircle2,
  FileText,
  Info,
  Percent,
  Receipt,
  Scale,
  ShieldCheck,
  TrendingDown,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import { api } from '../api'
import {
  Badge,
  Button,
  Card,
  CardHeader,
  ErrorState,
  Field,
  Input,
  PageHeader,
  Spinner,
} from '../components/ui'
import { money } from '../format'

export default function TaxEstimator() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Interactive inputs
  const [grossIncome, setGrossIncome] = useState(900000)
  const [sec80c, setSec80c] = useState(150000)
  const [sec80d, setSec80d] = useState(25000)
  const [sec24b, setSec24b] = useState(0)

  const load = useCallback(async (gross, c, d, h) => {
    try {
      const res = await api.get(
        `/api/tax/estimate?gross_income=${gross}&sec_80c=${c}&sec_80d=${d}&sec_24b=${h}`
      )
      setData(res)
      setError(null)
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(grossIncome, sec80c, sec80d, sec24b)
  }, [load, grossIncome, sec80c, sec80d, sec24b])

  if (loading && !data) return <Spinner label="Computing income tax regimes" />
  if (error) return <ErrorState error={error} onRetry={() => load(grossIncome, sec80c, sec80d, sec24b)} />

  const { recommendation = {}, new_regime = {}, old_regime = {} } = data || {}
  const isNewBetter = recommendation.preferred === 'new'

  return (
    <div className="space-y-6">
      <PageHeader
        title="Income Tax Regime Estimator"
        subtitle="Side-by-side mathematical comparison of New vs. Old Tax Regime (Section 115BAC, FY 2024-25 / 2025-26)."
      />

      {/* Recommendation Banner */}
      <Card className="border-l-4 border-l-pos bg-pos/5 p-5">
        <div className="flex items-start gap-3.5">
          <div className="mt-0.5 rounded-full bg-pos/15 p-1 text-pos">
            <CheckCircle2 size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-ink-900 dark:text-ink-100">
                Recommended: {recommendation.preferred_label}
              </h3>
              {recommendation.tax_saved > 0 && (
                <Badge tone="positive">Saves {money(recommendation.tax_saved)}/year</Badge>
              )}
            </div>
            <p className="mt-1 text-xs text-ink-700 dark:text-ink-300">
              {recommendation.summary}
            </p>
          </div>
        </div>
      </Card>

      {/* Comparative Summary Cards */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* New Regime Card */}
        <Card className={`p-5 ${isNewBetter ? 'border-2 border-pos/40' : ''}`}>
          <div className="flex items-center justify-between border-b border-ink-200/90 pb-3 dark:border-[#242421]">
            <div>
              <span className="font-semibold text-ink-900 dark:text-ink-100 text-sm">
                New Tax Regime
              </span>
              <p className="font-mono text-[11px] muted">Default u/s 115BAC</p>
            </div>
            {isNewBetter && <Badge tone="positive">Recommended</Badge>}
          </div>

          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-xs muted">Total Tax Liability:</span>
            <span className="font-serif text-2xl font-bold text-ink-900 dark:text-ink-100">
              {money(new_regime.total_tax)}
            </span>
          </div>

          <p className="font-mono text-[11px] text-right text-ink-600 dark:text-ink-400 mt-0.5">
            Effective rate: {new_regime.effective_tax_rate}%
          </p>

          <div className="mt-4 space-y-2 border-t border-ink-200/60 pt-3 text-xs dark:border-[#1E1E1C]">
            <div className="flex justify-between">
              <span className="muted">Standard Deduction</span>
              <span className="font-mono font-medium text-pos">-₹75,000</span>
            </div>
            <div className="flex justify-between">
              <span className="muted">Other Deductions (80C/80D)</span>
              <span className="font-mono muted">Not allowed</span>
            </div>
            <div className="flex justify-between">
              <span className="muted">Net Taxable Income</span>
              <span className="font-mono font-medium">{money(new_regime.taxable_income)}</span>
            </div>
            <div className="flex justify-between">
              <span className="muted">Section 87A Rebate</span>
              <span className="font-mono text-pos">-₹{new_regime.rebate_87a?.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between">
              <span className="muted">4% Health & Education Cess</span>
              <span className="font-mono">₹{new_regime.cess_4pct?.toLocaleString('en-IN')}</span>
            </div>
          </div>
        </Card>

        {/* Old Regime Card */}
        <Card className={`p-5 ${!isNewBetter && recommendation.preferred === 'old' ? 'border-2 border-pos/40' : ''}`}>
          <div className="flex items-center justify-between border-b border-ink-200/90 pb-3 dark:border-[#242421]">
            <div>
              <span className="font-semibold text-ink-900 dark:text-ink-100 text-sm">
                Old Tax Regime
              </span>
              <p className="font-mono text-[11px] muted">With itemized exemptions</p>
            </div>
            {!isNewBetter && recommendation.preferred === 'old' && <Badge tone="positive">Recommended</Badge>}
          </div>

          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-xs muted">Total Tax Liability:</span>
            <span className="font-serif text-2xl font-bold text-ink-900 dark:text-ink-100">
              {money(old_regime.total_tax)}
            </span>
          </div>

          <p className="font-mono text-[11px] text-right text-ink-600 dark:text-ink-400 mt-0.5">
            Effective rate: {old_regime.effective_tax_rate}%
          </p>

          <div className="mt-4 space-y-2 border-t border-ink-200/60 pt-3 text-xs dark:border-[#1E1E1C]">
            <div className="flex justify-between">
              <span className="muted">Standard Deduction</span>
              <span className="font-mono font-medium text-pos">-₹50,000</span>
            </div>
            <div className="flex justify-between">
              <span className="muted">Chapter VI-A (80C, 80D, 24b)</span>
              <span className="font-mono font-medium text-pos">
                -₹{((old_regime.total_deductions || 50000) - 50000).toLocaleString('en-IN')}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="muted">Net Taxable Income</span>
              <span className="font-mono font-medium">{money(old_regime.taxable_income)}</span>
            </div>
            <div className="flex justify-between">
              <span className="muted">Section 87A Rebate</span>
              <span className="font-mono text-pos">-₹{old_regime.rebate_87a?.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between">
              <span className="muted">4% Health & Education Cess</span>
              <span className="font-mono">₹{old_regime.cess_4pct?.toLocaleString('en-IN')}</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Interactive Scenario Controls */}
      <Card className="p-5">
        <CardHeader
          title="Interactive Deduction & Salary Simulator"
          subtitle="Adjust income and investment deductions to see which regime benefits your specific situation:"
        />

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Gross Annual Salary / Income">
            <Input
              type="number"
              step="10000"
              value={grossIncome}
              onChange={(e) => setGrossIncome(Number(e.target.value))}
            />
          </Field>

          <Field label="Section 80C (EPF/PPF/ELSS)">
            <Input
              type="number"
              step="5000"
              max="150000"
              value={sec80c}
              onChange={(e) => setSec80c(Number(e.target.value))}
            />
          </Field>

          <Field label="Section 80D (Health Insurance)">
            <Input
              type="number"
              step="5000"
              max="100000"
              value={sec80d}
              onChange={(e) => setSec80d(Number(e.target.value))}
            />
          </Field>

          <Field label="Home Loan Interest (Sec 24b)">
            <Input
              type="number"
              step="10000"
              max="200000"
              value={sec24b}
              onChange={(e) => setSec24b(Number(e.target.value))}
            />
          </Field>
        </div>
      </Card>
    </div>
  )
}

