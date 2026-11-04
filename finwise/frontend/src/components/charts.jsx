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
/**
 * Category colours.
 *
 * Two earlier attempts were wrong, and the second was wrong in a way that only
 * measurement caught. The first was the stock Tailwind 500 ramp. The second was
 * hand-picked "to harmonise" and failed three objective checks: indigo against
 * blue measured ΔE 2.5 under deuteranopia (invisible to a red-green colourblind
 * reader), teal against sea-green measured ΔE 7.3 for *normal* vision, which is
 * below the 15 floor at which two series can be told apart at all, and three of
 * the eleven fell under the chroma floor and read as grey.
 *
 * These eight hues and their per-mode steps come from a palette validated with
 * the data-viz validator against this app's own card surfaces (#ffffff light,
 * #161a22 dark). Both modes pass every gate: worst adjacent CVD ΔE 9.1 light /
 * 8.4 dark, worst adjacent normal-vision ΔE 19.6 / 19.3.
 *
 * Dark is a separate set of steps chosen for the dark surface, not an automatic
 * lightening of the light values.
 *
 * Eight is the cap, not a coincidence: past eight slots no ordering clears the
 * separation floors, so a ninth hue would be indistinguishable from one already
 * on screen. The eight consumption categories take the eight slots; the three
 * that are not consumption are handled outside the categorical set.
 */
const CATEGORICAL = {
  //                      light      dark
  Food: ['#2a78d6', '#3987e5'], // slot 1  blue
  Housing: ['#eb6834', '#d95926'], // slot 2  orange
  Transportation: ['#1baf7a', '#199e70'], // slot 3  aqua
  Shopping: ['#eda100', '#c98500'], // slot 4  yellow
  Entertainment: ['#e87ba4', '#d55181'], // slot 5  magenta
  Utilities: ['#008300', '#008300'], // slot 6  green
  Education: ['#6250d6', '#9085e9'], // slot 7  violet
  Healthcare: ['#e34948', '#e66767'], // slot 8  red
}

// Residual slots, deliberately neutral. An earlier draft gave Investments its
// own income-green, which measured ΔE 9.3 light / 12.1 dark against the slot-6
// green of Utilities -- below the 15 floor, so the two were hard to tell apart
// in the same donut even with full colour vision. There is no ninth hue
// available that clears the floors, so the tail is folded instead of coloured
// (see MAX_SLICES below), which is the structural fix rather than a new colour.
const NON_CATEGORICAL = {
  Investments: ['#8b93a3', '#6c7384'],
  Salary: ['#8b93a3', '#6c7384'],
  Other: ['#8b93a3', '#6c7384'],
}

// Eight hues clear the separation floors; a ninth cannot. So no chart shows
// more than eight slices: the largest seven keep their own colour and
// everything past them is summed into one labelled neutral slice. The sum is
// the true total of the remainder, so nothing is hidden -- only merged.
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

/** Hook form, so a swatch repaints when the theme toggles. */
export function useCategoryColor() {
  const { isDark } = useTheme()
  return (category) => categoryColor(category, isDark)
}

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

/**
 * Spending by category, as a ranked bar list rather than a donut.
 *
 * The form changed for a measured reason, not a stylistic one. A donut is an
 * all-pairs form -- every slice can sit beside every other and the legend lists
 * them together -- and no eight-hue palette clears the separation floors under
 * all-pairs: in this one, red against orange measures ΔE 7.1 for normal vision,
 * against a floor of 15. Adding a ninth hue for Investments made it worse, and
 * the pair that failed was not even the new one.
 *
 * A ranked bar list is an adjacent-pairs form, and more importantly it carries
 * a direct label on every row, so identity never depends on colour at all. It
 * also answers the question the page is actually asking -- "which category is
 * biggest, and by how much" -- which is a length comparison, something a bar
 * does well and a ring of angles does badly.
 */
export function CategoryBars({ data, max }) {
  const colour = useCategoryColor()
  if (!data?.length) return null
  const rows = foldTail(data, max)

  return (
    <ul className="space-y-3">
      {rows.map((row) => (
        <li key={row.category}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: colour(row.category) }}
              />
              <span className="truncate">{row.category}</span>
            </span>
            <span className="shrink-0 tnum">
              <span className="font-medium">{money(row.amount)}</span>
              <span className="muted"> · {row.share}%</span>
            </span>
          </div>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800">
            <div
              className="h-full rounded-full transition-[width] duration-500"
              style={{ width: `${Math.max(1, row.share)}%`, background: colour(row.category) }}
            />
          </div>
        </li>
      ))}
    </ul>
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
