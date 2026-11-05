import {
  Activity,
  ArrowLeftRight,
  BarChart3,
  FileText,
  Landmark,
  Layers,
  LogOut,
  Menu,
  Moon,
  Network,
  SlidersHorizontal,
  Sun,
  Terminal,
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
  { to: '/budget', label: 'Budget Limits', icon: BarChart3, group: 'Ledger' },
  { to: '/goals', label: 'Savings Goals', icon: Landmark, group: 'Ledger' },
  { to: '/insights', label: 'Spending Analysis', icon: TrendingUp, group: 'Analysis' },
  { to: '/health', label: 'Health Rubric', icon: Activity, group: 'Analysis' },
  { to: '/assistant', label: 'Query Ledger', icon: Terminal, group: 'Analysis' },
  { to: '/reports', label: 'Statements', icon: FileText, group: 'Analysis' },
  { to: '/architecture', label: 'Architecture', icon: Network, group: 'System' },
  { to: '/settings', label: 'Preferences', icon: SlidersHorizontal, group: 'System' },
]

function Logo() {
  return (
    <div className="flex items-center justify-between px-5 py-4 border-b border-ink-200/90 dark:border-[#242421]">
      <div className="flex items-center gap-2.5">
        <div className="grid size-6 place-items-center rounded bg-ink-900 font-serif text-sm text-[#F8F7F4] dark:bg-ink-100 dark:text-ink-900">
          F
        </div>
        <div className="leading-none">
          <p className="text-[13px] font-semibold text-ink-900 dark:text-ink-100">FinWise</p>
          <p className="mt-0.5 font-mono text-[10px] text-ink-500 dark:text-ink-400">
            Personal Ledger
          </p>
        </div>
      </div>
    </div>
  )
}

function NavItems({ onNavigate }) {
  const groups = ['Ledger', 'Analysis', 'System']
  return (
    <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
      {groups.map((group) => {
        const items = NAV_ITEMS.filter((item) => item.group === group)
        return (
          <div key={group}>
            <p className="px-2.5 pb-1.5 font-mono text-[10px] font-medium uppercase text-ink-400 dark:text-ink-500">
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
                    `flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] transition-colors ${
                      isActive
                        ? 'bg-ink-900 text-[#F8F7F4] font-medium dark:bg-ink-100 dark:text-ink-900'
                        : 'text-ink-600 hover:bg-ink-200/60 hover:text-ink-900 dark:text-ink-400 dark:hover:bg-[#1C1C1A] dark:hover:text-ink-100'
                    }`
                  }
                >
                  <Icon size={14} strokeWidth={1.6} className="shrink-0 opacity-80" />
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
    <div className="border-t border-ink-200/90 p-3 dark:border-[#242421]">
      <div className="flex items-center justify-between gap-2 px-1.5 py-1">
        <div className="flex min-w-0 items-center gap-2">
          <div className="grid size-6 shrink-0 place-items-center rounded bg-ink-200 font-mono text-[10px] font-medium text-ink-800 dark:bg-[#242421] dark:text-ink-200">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-ink-900 dark:text-ink-100">
              {user?.name}
            </p>
            <p className="truncate font-mono text-[10px] muted">{user?.email}</p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          <button
            onClick={toggle}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            title={isDark ? 'Paper light mode' : 'Carbon dark mode'}
            className="rounded p-1.5 text-ink-500 hover:bg-ink-200/60 hover:text-ink-900 dark:text-ink-400 dark:hover:bg-[#222220] dark:hover:text-ink-100 transition-colors"
          >
            {isDark ? <Sun size={14} /> : <Moon size={14} />}
          </button>
          <button
            onClick={onLogout}
            aria-label="Sign out"
            title="Sign out"
            className="rounded p-1.5 text-ink-500 hover:bg-ink-200/60 hover:text-neg dark:text-ink-400 dark:hover:bg-[#222220] transition-colors"
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
    <div className="min-h-dvh lg:flex">
      {/* Architectural Desktop Sidebar */}
      <aside className="hidden w-56 shrink-0 flex-col border-r border-ink-200/90 bg-[#F3F1EC] lg:sticky lg:top-0 lg:h-dvh lg:flex dark:border-[#242421] dark:bg-[#0E0E0D]">
        <Logo />
        <NavItems />
        <SidebarFooter />
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-ink-950/50"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative flex h-full w-64 flex-col border-r border-ink-200 bg-[#F3F1EC] dark:border-[#242421] dark:bg-[#0E0E0D]">
            <div className="flex items-center justify-between pr-3">
              <Logo />
              <button
                onClick={() => setMobileOpen(false)}
                aria-label="Close navigation"
                className="rounded p-1 text-ink-500"
              >
                <X size={16} />
              </button>
            </div>
            <NavItems onNavigate={() => setMobileOpen(false)} />
            <SidebarFooter />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Compact mobile-only header — desktop has zero wasted top chrome */}
        <header className="sticky top-0 z-30 flex h-12 items-center justify-between border-b border-ink-200 bg-[#F8F7F4]/95 px-4 lg:hidden dark:border-[#242421] dark:bg-[#0A0A09]/95">
          <button
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
            className="flex items-center gap-2 rounded p-1.5 text-ink-700 hover:bg-ink-200/60 dark:text-ink-300"
          >
            <Menu size={16} />
            <span className="font-serif text-base font-medium">FinWise</span>
          </button>
          <button
            onClick={toggle}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            className="rounded p-1.5 text-ink-500 hover:bg-ink-200/60 dark:text-ink-400"
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
