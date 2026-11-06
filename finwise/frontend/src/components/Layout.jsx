import {
  Activity,
  ArrowLeftRight,
  BarChart3,
  CalendarClock,
  FileText,
  Landmark,
  Layers,
  LogOut,
  Menu,
  Moon,
  Receipt,
  Scale,
  SlidersHorizontal,
  Sun,
  Terminal,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react'
import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'

import { useAuth } from '../auth'
import { useTheme } from '../theme'

export const NAV_ITEMS = [
  { to: '/', label: 'Overview', icon: Layers, group: 'Ledger' },
  { to: '/transactions', label: 'Transactions', icon: ArrowLeftRight, group: 'Ledger' },
  { to: '/subscriptions', label: 'Subscriptions', icon: CalendarClock, group: 'Ledger' },
  { to: '/budget', label: 'Budget Limits', icon: BarChart3, group: 'Ledger' },
  { to: '/goals', label: 'Savings Goals', icon: Landmark, group: 'Ledger' },
  { to: '/net-worth', label: 'Net Worth', icon: Scale, group: 'Wealth' },
  { to: '/debt', label: 'Debt Planner', icon: TrendingDown, group: 'Wealth' },
  { to: '/tax', label: 'Tax Estimator', icon: Receipt, group: 'Wealth' },
  { to: '/insights', label: 'Spending Analysis', icon: TrendingUp, group: 'Analysis' },
  { to: '/health', label: 'Health & Runway', icon: Activity, group: 'Analysis' },
  { to: '/assistant', label: 'Query Ledger', icon: Terminal, group: 'Analysis' },
  { to: '/reports', label: 'Statements', icon: FileText, group: 'Analysis' },
  { to: '/settings', label: 'Preferences', icon: SlidersHorizontal, group: 'System' },
]

function Logo() {
  return (
    <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200/80 dark:border-slate-800/80">
      <div className="flex items-center gap-3">
        <div className="relative grid size-7 place-items-center rounded-lg bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-sm shadow-blue-500/20 font-sans font-bold text-sm">
          F
          <span className="absolute -bottom-0.5 -right-0.5 size-2 rounded-full bg-emerald-400 ring-2 ring-white dark:ring-[#0A0D15]" />
        </div>
        <div className="leading-tight">
          <div className="flex items-center gap-1.5">
            <p className="font-display text-[14px] font-bold tracking-tight text-slate-900 dark:text-white">FinWise</p>
          </div>
          <p className="font-mono text-[10px] text-slate-400 dark:text-slate-500">
            Financial Intelligence
          </p>
        </div>
      </div>
    </div>
  )
}

function NavItems({ onNavigate }) {
  const groups = ['Ledger', 'Wealth', 'Analysis', 'System']
  return (
    <nav className="flex-1 space-y-5 overflow-y-auto px-3.5 py-4">
      {groups.map((group) => {
        const items = NAV_ITEMS.filter((item) => item.group === group)
        return (
          <div key={group}>
            <p className="px-2.5 pb-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              {group}
            </p>
            <div className="space-y-0.5">
              {items.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === '/'}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-all ${
                      isActive
                        ? 'bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-900'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-white'
                    }`
                  }
                >
                  <Icon size={14} strokeWidth={1.8} className="shrink-0 opacity-80" />
                  <span className="truncate">{label}</span>
                </NavLink>
              ))}
            </div>
          </div>
        )
      })}
    </nav>
  )
}

function SidebarFooter() {
  const { user, logout } = useAuth()
  const { isDark, toggle } = useTheme()
  const navigate = useNavigate()

  async function onLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  const initials = (user?.name || '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('')

  return (
    <div className="border-t border-slate-200/80 p-3.5 dark:border-slate-800/80">
      <div className="flex items-center justify-between gap-2 px-1 py-0.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="grid size-7 shrink-0 place-items-center rounded-full bg-slate-100 font-mono text-[11px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-slate-900 dark:text-white">
              {user?.name}
            </p>
            <p className="truncate font-mono text-[10px] text-slate-400 dark:text-slate-500">{user?.email}</p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={toggle}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white transition-colors"
          >
            {isDark ? <Sun size={14} /> : <Moon size={14} />}
          </button>
          <button
            onClick={onLogout}
            aria-label="Sign out"
            title="Sign out"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:text-slate-400 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 transition-colors"
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const { isDark, toggle } = useTheme()

  return (
    <div className="relative min-h-dvh lg:flex">
      {/* Ambient background glow for high-end dark mode depth */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden dark:block hidden">
        <div className="absolute -top-[30%] left-1/2 -translate-x-1/2 w-[900px] h-[550px] rounded-full bg-gradient-to-b from-blue-600/10 via-indigo-600/5 to-transparent blur-3xl" />
      </div>

      {/* Modern Desktop Sidebar */}
      <aside className="relative z-10 hidden w-60 shrink-0 flex-col border-r border-slate-200/80 bg-white lg:sticky lg:top-0 lg:h-dvh lg:flex dark:border-slate-800/80 dark:bg-[#0A0D15]">
        <Logo />
        <NavItems />
        <SidebarFooter />
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative flex h-full w-64 flex-col border-r border-slate-200/80 bg-white dark:border-slate-800/80 dark:bg-[#0A0D15]">
            <div className="flex items-center justify-between pr-3">
              <Logo />
              <button
                onClick={() => setMobileOpen(false)}
                aria-label="Close navigation"
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X size={16} />
              </button>
            </div>
            <NavItems onNavigate={() => setMobileOpen(false)} />
            <SidebarFooter />
          </aside>
        </div>
      )}

      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        {/* Compact mobile-only header */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-200/80 bg-white/95 px-4 backdrop-blur lg:hidden dark:border-slate-800/80 dark:bg-[#0A0D15]/95">
          <button
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
            className="flex items-center gap-2 rounded-lg p-1.5 text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <Menu size={16} />
            <span className="font-display text-base font-bold tracking-tight">FinWise</span>
          </button>
          <button
            onClick={toggle}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            {isDark ? <Sun size={15} /> : <Moon size={15} />}
          </button>
        </header>

        <main className="flex-1 px-4 py-6 sm:px-7 lg:px-10 lg:py-8">
          <div className="mx-auto max-w-6xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
