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
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { money, moneyCompact } from '../format'
import { useTheme } from '../theme'

const CATEGORICAL = {
  //                      light      dark
  Food: ['#1D4ED8', '#60A5FA'],
  Housing: ['#B45309', '#F59E0B'],
  Transportation: ['#0F766E', '#2DD4BF'],
  Shopping: ['#A16207', '#FACC15'],
  Entertainment: ['#9D174D', '#F472B6'],
  Utilities: ['#15803D', '#4ADE80'],
  Education: ['#4338CA', '#818CF8'],
  Healthcare: ['#BE123C', '#FB7185'],
}

const NON_CATEGORICAL = {
  Investments: ['#6E6B63', '#8C887E'],
  Salary: ['#6E6B63', '#8C887E'],
  Other: ['#6E6B63', '#8C887E'],
}

export const MAX_SLICES = 8

export function foldTail(breakdown, max = MAX_SLICES) {
  if (!breakdown || breakdown.length <= max) return breakdown || []
  const head = breakdown.slice(0, max - 1)
  const tail = breakdown.slice(max - 1)
  return [
    ...head,
    {
      category: `Other (${tail.length} categories)`,
      amount: Math.round(tail.reduce((sum, item) => sum + item.amount, 0) * 100) / 100,
      share: Math.round(tail.reduce((sum, item) => sum + item.share, 0) * 10) / 10,
      transactions: tail.reduce((sum, item) => sum + (item.transactions || 0), 0),
      isTail: true,
    },
  ]
}

const SLOTS = { ...CATEGORICAL, ...NON_CATEGORICAL }

export function categoryColor(category, isDark = false) {
  const pair = SLOTS[category] || NON_CATEGORICAL.Other
  return pair[isDark ? 1 : 0]
}

export function useCategoryColor() {
  const { isDark } = useTheme()
  return (category) => categoryColor(category, isDark)
}

function useChartTheme() {
  const { isDark } = useTheme()
  return {
    axis: isDark ? '#8C887E' : '#6E6B63',
    grid: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(17, 17, 16, 0.06)',
    tooltipBg: isDark ? '#181816' : '#FFFFFF',
    tooltipBorder: isDark ? '#2E2E2A' : '#E5E3DC',
    tooltipText: isDark ? '#F1EFEA' : '#111110',
    inflowBar: isDark ? '#F1EFEA' : '#181816',
    outflowBar: isDark ? '#57554E' : '#B8B4A9',
    linePrimary: isDark ? '#F1EFEA' : '#181816',
    savingsStroke: isDark ? '#4ADE80' : '#15803D',
  }
}

function MoneyTooltip({ active, payload, label, theme }) {
  if (!active || !payload?.length) return null
  return (
    <div
      className="rounded-md border px-3 py-2 text-xs shadow-card"
      style={{
        background: theme.tooltipBg,
        borderColor: theme.tooltipBorder,
        color: theme.tooltipText,
      }}
    >
      {label && <p className="mb-1.5 font-mono text-[11px] font-medium">{label}</p>}
      <div className="space-y-1">
        {payload.map((entry) => (
          <p key={entry.name} className="flex items-center justify-between gap-4 font-mono text-[11px] tnum">
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-xs" style={{ background: entry.color || entry.fill }} />
              <span className="muted font-sans">{entry.name}</span>
            </span>
            <span className="font-medium">{money(entry.value)}</span>
          </p>
        ))}
      </div>
    </div>
  )
}

const axisProps = (theme) => ({
  stroke: theme.axis,
  tick: { fill: theme.axis, fontSize: 11 },
  tickLine: false,
  axisLine: false,
})

export function IncomeVsExpenseChart({ data, height = 250 }) {
  const theme = useChartTheme()
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }} barGap={3}>
        <CartesianGrid vertical={false} stroke={theme.grid} />
        <XAxis dataKey="label" {...axisProps(theme)} />
        <YAxis tickFormatter={moneyCompact} {...axisProps(theme)} width={56} />
        <Tooltip content={<MoneyTooltip theme={theme} />} cursor={{ fill: theme.grid, opacity: 0.5 }} />
        <Legend iconType="square" iconSize={8} wrapperStyle={{ fontSize: 11, color: theme.axis }} />
        <Bar dataKey="income" name="Inflows" fill={theme.inflowBar} radius={[2, 2, 0, 0]} maxBarSize={22} />
        <Bar dataKey="expense" name="Outflows" fill={theme.outflowBar} radius={[2, 2, 0, 0]} maxBarSize={22} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function CategoryBars({ data, max }) {
  const colour = useCategoryColor()
  if (!data?.length) return null
  const rows = foldTail(data, max)

  return (
    <ul className="divide-y divide-ink-200/70 dark:divide-[#222220]">
      {rows.map((row) => (
        <li key={row.category} className="py-2.5 first:pt-0 last:pb-0">
          <div className="flex items-baseline justify-between gap-3 text-xs">
            <span className="flex min-w-0 items-center gap-2 font-medium text-ink-900 dark:text-ink-100">
              <span
                className="size-2 shrink-0 rounded-xs"
                style={{ background: colour(row.category) }}
              />
              <span className="truncate">{row.category}</span>
            </span>
            <span className="shrink-0 font-mono text-xs tnum">
              <span className="font-medium text-ink-900 dark:text-ink-100">{money(row.amount)}</span>
              <span className="muted"> · {row.share}%</span>
            </span>
          </div>
          <div className="mt-1.5 h-1 w-full overflow-hidden rounded-xs bg-ink-100 dark:bg-[#222220]">
            <div
              className="h-full transition-[width] duration-300"
              style={{ width: `${Math.max(1, row.share)}%`, background: colour(row.category) }}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}

export function ExpenseTrendChart({ data, height = 220 }) {
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
          name="Outflows"
          stroke={theme.linePrimary}
          strokeWidth={1.75}
          dot={{ r: 2.5, strokeWidth: 0, fill: theme.linePrimary }}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

export function SavingsGrowthChart({ data, height = 220 }) {
  const theme = useChartTheme()
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
            <stop offset="0%" stopColor={theme.savingsStroke} stopOpacity={0.16} />
            <stop offset="100%" stopColor={theme.savingsStroke} stopOpacity={0.0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke={theme.grid} />
        <XAxis dataKey="label" {...axisProps(theme)} />
        <YAxis tickFormatter={moneyCompact} {...axisProps(theme)} width={56} />
        <Tooltip content={<MoneyTooltip theme={theme} />} />
        <Area
          type="monotone"
          dataKey="cumulative"
          name="Cumulative retained"
          stroke={theme.savingsStroke}
          strokeWidth={1.75}
          fill="url(#savingsFill)"
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

export function BudgetUtilisationChart({ alerts, height = 220 }) {
  const theme = useChartTheme()
  const { isDark } = useTheme()
  if (!alerts?.length) return null
  const data = alerts.map((a) => ({ ...a, name: a.label }))
  const budgetBar = isDark ? '#2C2C28' : '#E5E3DC'

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, left: 8, bottom: 0 }}>
        <CartesianGrid horizontal={false} stroke={theme.grid} />
        <XAxis type="number" tickFormatter={moneyCompact} {...axisProps(theme)} />
        <YAxis type="category" dataKey="name" width={96} {...axisProps(theme)} />
        <Tooltip content={<MoneyTooltip theme={theme} />} cursor={{ fill: theme.grid, opacity: 0.4 }} />
        <Legend iconType="square" iconSize={8} wrapperStyle={{ fontSize: 11, color: theme.axis }} />
        <Bar dataKey="spent" name="Spent" radius={[0, 2, 2, 0]} maxBarSize={14}>
          {data.map((entry) => (
            <Cell
              key={entry.label}
              fill={
                entry.status === 'over'
                  ? '#BE123C'
                  : entry.status === 'warning'
                    ? '#B45309'
                    : theme.inflowBar
              }
            />
          ))}
        </Bar>
        <Bar dataKey="budget" name="Limit" fill={budgetBar} radius={[0, 2, 2, 0]} maxBarSize={14} />
      </BarChart>
    </ResponsiveContainer>
  )
}
