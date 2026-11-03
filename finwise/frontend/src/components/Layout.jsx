import {
  Bot,
  FileBarChart2,
  LayoutDashboard,
  Lightbulb,
  LogOut,
  Menu,
  Moon,
  PiggyBank,
  Receipt,
  Settings,
  Stethoscope,
  Sun,
  Wallet,
  X,
} from 'lucide-react'
import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'

import { useAuth } from '../auth'
import { useTheme } from '../theme'

/** Single source of truth for navigation — the router reads this too. */
export const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/transactions', label: 'Transactions', icon: Receipt },
  { to: '/budget', label: 'Budget Planner', icon: Wallet },
  { to: '/insights', label: 'AI Insights', icon: Lightbulb },
  { to: '/health', label: 'Financial Health', icon: Stethoscope },
  { to: '/goals', label: 'Savings Goals', icon: PiggyBank },
  { to: '/assistant', label: 'AI Assistant', icon: Bot },
  { to: '/reports', label: 'Reports', icon: FileBarChart2 },
  { to: '/settings', label: 'Settings', icon: Settings },
]

function Logo() {
  return (
    <div className="flex items-center gap-2.5 px-5 py-5">
      <div className="grid h-8 w-8 place-items-center rounded-lg bg-brand-500 text-sm font-bold text-white">
        F
      </div>
      <div className="leading-none">
        <p className="text-sm font-semibold tracking-tight">FINWISE</p>
        <p className="mt-0.5 text-[10px] font-medium tracking-[0.14em] text-brand-400">AI</p>
      </div>
    </div>
  )
}

function NavItems({ onNavigate }) {
  return (
    <nav className="flex-1 space-y-0.5 px-3">
      {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          onClick={onNavigate}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
              isActive
                ? 'bg-brand-500/10 font-medium text-brand-400'
                : 'text-ink-600 hover:bg-ink-100 dark:text-ink-400 dark:hover:bg-ink-800/70'
            }`
          }
        >
          <Icon size={17} className="shrink-0" />
          <span className="truncate">{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}

function ThemeToggle() {
  const { isDark, toggle } = useTheme()
  return (
    <button
      onClick={toggle}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Light mode' : 'Dark mode'}
      className="rounded-lg p-2 text-ink-600 transition hover:bg-ink-100 dark:text-ink-400 dark:hover:bg-ink-800"
    >
      {isDark ? <Sun size={17} /> : <Moon size={17} />}
    </button>
  )
}

function UserMenu() {
  const { user, logout } = useAuth()
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
    <div className="flex items-center gap-2">
      <div className="hidden text-right sm:block">
        <p className="text-xs font-medium leading-tight">{user?.name}</p>
        <p className="text-[11px] leading-tight muted">{user?.email}</p>
      </div>
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-500/15 text-xs font-semibold text-brand-400">
        {initials}
      </div>
      <button
        onClick={onLogout}
        aria-label="Sign out"
        title="Sign out"
        className="rounded-lg p-2 text-ink-600 transition hover:bg-ink-100 hover:text-neg dark:text-ink-400 dark:hover:bg-ink-800"
      >
        <LogOut size={17} />
      </button>
    </div>
  )
}

export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="min-h-screen lg:flex">
      {/* Desktop sidebar: fixed, always visible from lg up. */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-ink-200 bg-white lg:flex dark:border-ink-800 dark:bg-ink-900">
        <Logo />
        <NavItems />
        <div className="border-t border-ink-200 p-3 dark:border-ink-800">
          <p className="px-2 text-[10px] leading-relaxed muted">
            Educational project. Not financial advice.
          </p>
        </div>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-ink-950/60"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative flex h-full w-64 flex-col border-r border-ink-200 bg-white dark:border-ink-800 dark:bg-ink-900">
            <div className="flex items-center justify-between pr-3">
              <Logo />
              <button
                onClick={() => setMobileOpen(false)}
                aria-label="Close navigation"
                className="rounded p-1.5 muted"
              >
                <X size={18} />
              </button>
            </div>
            <NavItems onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-ink-200 bg-ink-50/85 px-4 backdrop-blur dark:border-ink-800 dark:bg-ink-950/85">
          <button
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
            className="rounded-lg p-2 text-ink-600 hover:bg-ink-100 lg:hidden dark:text-ink-400 dark:hover:bg-ink-800"
          >
            <Menu size={18} />
          </button>
          <div className="min-w-0 flex-1" />
          <ThemeToggle />
          <UserMenu />
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
