import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { money, moneyCompact } from '../format'
import { useTheme } from '../theme'

/**
 * Chart wrappers.
 *
 * Recharts renders inline SVG that Tailwind cannot reach, so colours and
 * typography are passed explicitly here. Defining them once is what keeps five
 * charts on one dashboard looking like one system.
 */

// One colour per category, fixed by name so a category keeps its colour across
// every chart and every page. Ordered to keep adjacent slices distinguishable.
export const CATEGORY_COLORS = {
  Food: '#3b6fe0',
  Shopping: '#8b5cf6',
  Transportation: '#0ea5e9',
  Education: '#14b8a6',
  Entertainment: '#ec4899',
  Healthcare: '#ef4444',
  Housing: '#f59e0b',
  Utilities: '#84cc16',
  Investments: '#14936c',
  Salary: '#22c55e',
  Other: '#94a3b8',
}

export const colorFor = (category) => CATEGORY_COLORS[category] || CATEGORY_COLORS.Other

const POSITIVE = '#14936c'
const NEGATIVE = '#d64545'
const BRAND = '#3b6fe0'

function useChartTheme() {
  const { isDark } = useTheme()
  return {
    axis: isDark ? '#8b93a3' : '#4c5361',
    grid: isDark ? '#232834' : '#eceef2',
    tooltipBg: isDark ? '#161a22' : '#ffffff',
    tooltipBorder: isDark ? '#232834' : '#dcdfe6',
    tooltipText: isDark ? '#eceef2' : '#232834',
  }
}

/** Shared tooltip so every chart formats rupees the same way. */
function MoneyTooltip({ active, payload, label, theme }) {
  if (!active || !payload?.length) return null
  return (
    <div
      className="rounded-lg border px-3 py-2 text-xs shadow-pop"
      style={{ background: theme.tooltipBg, borderColor: theme.tooltipBorder, color: theme.tooltipText }}
    >
      {label && <p className="mb-1 font-medium">{label}</p>}
      {payload.map((entry) => (
        <p key={entry.name} className="flex items-center gap-2 tnum">
          <span className="h-2 w-2 rounded-full" style={{ background: entry.color || entry.fill }} />
          <span className="muted">{entry.name}</span>
          <span className="ml-auto font-medium">{money(entry.value)}</span>
        </p>
      ))}
    </div>
  )
}

const axisProps = (theme) => ({
  stroke: theme.axis,
  tick: { fill: theme.axis, fontSize: 11 },
  tickLine: false,
  axisLine: false,
})

export function IncomeVsExpenseChart({ data, height = 260 }) {
  const theme = useChartTheme()
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={theme.grid} />
        <XAxis dataKey="label" {...axisProps(theme)} />
        <YAxis tickFormatter={moneyCompact} {...axisProps(theme)} width={56} />
        <Tooltip content={<MoneyTooltip theme={theme} />} cursor={{ fill: theme.grid, opacity: 0.4 }} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: theme.axis }} />
        <Bar dataKey="income" name="Income" fill={POSITIVE} radius={[4, 4, 0, 0]} maxBarSize={28} />
        <Bar dataKey="expense" name="Expenses" fill={NEGATIVE} radius={[4, 4, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function CategoryPie({ data, height = 260 }) {
  const theme = useChartTheme()
  if (!data?.length) return null
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          dataKey="amount"
          nameKey="category"
          innerRadius="55%"
          outerRadius="80%"
          paddingAngle={2}
          stroke="none"
        >
          {data.map((entry) => (
            <Cell key={entry.category} fill={colorFor(entry.category)} />
          ))}
        </Pie>
        <Tooltip content={<MoneyTooltip theme={theme} />} />
        <Legend
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 11, color: theme.axis }}
          formatter={(value) => <span style={{ color: theme.axis }}>{value}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}

export function ExpenseTrendChart({ data, height = 240 }) {
  const theme = useChartTheme()
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={theme.grid} />
        <XAxis dataKey="label" {...axisProps(theme)} />
        <YAxis tickFormatter={moneyCompact} {...axisProps(theme)} width={56} />
        <Tooltip content={<MoneyTooltip theme={theme} />} />
        <Line
          type="monotone"
          dataKey="expense"
          name="Expenses"
          stroke={NEGATIVE}
          strokeWidth={2}
          dot={{ r: 3, strokeWidth: 0, fill: NEGATIVE }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

export function SavingsGrowthChart({ data, height = 240 }) {
  const theme = useChartTheme()
  // Running total, because "savings growth" is cumulative — a per-month bar
  // chart would answer a different question.
  let running = 0
  const cumulative = data.map((row) => {
    running += row.savings
    return { ...row, cumulative: Math.round(running * 100) / 100 }
  })

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={cumulative} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
        <defs>
          <linearGradient id="savingsFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={BRAND} stopOpacity={0.35} />
            <stop offset="100%" stopColor={BRAND} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke={theme.grid} />
        <XAxis dataKey="label" {...axisProps(theme)} />
        <YAxis tickFormatter={moneyCompact} {...axisProps(theme)} width={56} />
        <Tooltip content={<MoneyTooltip theme={theme} />} />
        <Area
          type="monotone"
          dataKey="cumulative"
          name="Cumulative savings"
          stroke={BRAND}
          strokeWidth={2}
          fill="url(#savingsFill)"
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

export function BudgetUtilisationChart({ alerts, height = 240 }) {
  const theme = useChartTheme()
  const { isDark } = useTheme()
  if (!alerts?.length) return null
  const data = alerts.map((a) => ({ ...a, name: a.label }))
  // The grid colour is deliberately near-invisible; a reference bar drawn in
  // it reads as a rendering fault rather than as the budget line.
  const budgetBar = isDark ? '#39414f' : '#cbd2dd'

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, left: 8, bottom: 0 }}>
        <CartesianGrid horizontal={false} stroke={theme.grid} />
        <XAxis type="number" tickFormatter={moneyCompact} {...axisProps(theme)} />
        <YAxis type="category" dataKey="name" width={96} {...axisProps(theme)} />
        <Tooltip content={<MoneyTooltip theme={theme} />} cursor={{ fill: theme.grid, opacity: 0.4 }} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: theme.axis }} />
        <Bar dataKey="spent" name="Spent" radius={[0, 4, 4, 0]} maxBarSize={18}>
          {data.map((entry) => (
            <Cell
              key={entry.label}
              fill={entry.status === 'over' ? NEGATIVE : entry.status === 'warning' ? '#c98a1b' : POSITIVE}
            />
          ))}
        </Bar>
        <Bar dataKey="budget" name="Budget" fill={budgetBar} radius={[0, 4, 4, 0]} maxBarSize={18} />
      </BarChart>
    </ResponsiveContainer>
  )
}
