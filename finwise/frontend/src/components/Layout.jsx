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

export const NAV_ITEMS = [
  { to: '/', label: 'Overview', icon: LayoutDashboard },
  { to: '/transactions', label: 'Transactions', icon: Receipt },
  { to: '/budget', label: 'Budget Planner', icon: Wallet },
  { to: '/insights', label: 'Spending Insights', icon: Lightbulb },
  { to: '/health', label: 'Financial Health', icon: Stethoscope },
  { to: '/goals', label: 'Savings Goals', icon: PiggyBank },
  { to: '/assistant', label: 'Assistant', icon: Bot },
  { to: '/reports', label: 'Reports', icon: FileBarChart2 },
  { to: '/settings', label: 'Settings', icon: Settings },
]

function Logo() {
  return (
    <div className="flex items-center gap-2.5 px-5 py-5 border-b border-ink-100 dark:border-[#1E222D]">
      <div className="grid h-7 w-7 place-items-center rounded-md bg-ink-900 text-xs font-bold text-white dark:bg-white dark:text-ink-900">
        F
      </div>
      <div className="leading-none">
        <p className="text-sm font-semibold tracking-tight text-ink-900 dark:text-white">FINWISE</p>
        <p className="mt-0.5 text-[10px] font-medium tracking-[0.1em] text-ink-500 dark:text-ink-400">
          Personal Finance
        </p>
      </div>
    </div>
  )
}

function NavItems({ onNavigate }) {
  return (
    <nav className="flex-1 space-y-0.5 px-3 py-3">
      {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          onClick={onNavigate}
          className={({ isActive }) =>
            `flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs sm:text-sm font-medium transition-colors ${
              isActive
                ? 'bg-ink-100 text-ink-900 font-semibold dark:bg-ink-800 dark:text-white'
                : 'text-ink-600 hover:bg-ink-50 hover:text-ink-900 dark:text-ink-400 dark:hover:bg-ink-850 dark:hover:text-ink-200'
            }`
          }
        >
          <Icon size={16} className="shrink-0 opacity-70" />
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
      className="rounded-lg p-2 text-ink-500 hover:bg-ink-100 dark:text-ink-400 dark:hover:bg-ink-800 transition-colors"
    >
      {isDark ? <Sun size={16} /> : <Moon size={16} />}
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
    <div className="flex items-center gap-2.5">
      <div className="hidden text-right sm:block">
        <p className="text-xs font-medium leading-tight text-ink-900 dark:text-white">{user?.name}</p>
        <p className="text-[11px] leading-tight muted">{user?.email}</p>
      </div>
      <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-ink-200 text-xs font-semibold text-ink-700 dark:bg-ink-800 dark:text-ink-200">
        {initials}
      </div>
      <button
        onClick={onLogout}
        aria-label="Sign out"
        title="Sign out"
        className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-neg dark:hover:bg-ink-800 transition-colors"
      >
        <LogOut size={16} />
      </button>
    </div>
  )
}

export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="min-h-screen lg:flex">
      {/* Desktop sidebar */}
      <aside className="hidden w-56 shrink-0 flex-col border-r border-ink-200 bg-white lg:flex dark:border-[#1E222D] dark:bg-[#11131A]">
        <Logo />
        <NavItems />
        <div className="border-t border-ink-100 p-4 dark:border-[#1E222D]">
          <p className="text-[11px] leading-relaxed muted">
            Educational project. Not financial advice.
          </p>
        </div>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-ink-950/50"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative flex h-full w-64 flex-col border-r border-ink-200 bg-white dark:border-ink-800 dark:bg-ink-900">
            <div className="flex items-center justify-between pr-3">
              <Logo />
              <button
                onClick={() => setMobileOpen(false)}
                aria-label="Close navigation"
                className="rounded p-1 text-ink-400"
              >
                <X size={18} />
              </button>
            </div>
            <NavItems onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b border-ink-200 bg-white/90 px-6 backdrop-blur dark:border-[#1E222D] dark:bg-[#0D0E12]/90">
          <button
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
            className="rounded-lg p-2 text-ink-600 hover:bg-ink-100 lg:hidden dark:text-ink-400"
          >
            <Menu size={18} />
          </button>
          <div className="min-w-0 flex-1" />
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <div className="h-4 w-[1px] bg-ink-200 dark:bg-ink-800" />
            <UserMenu />
          </div>
        </header>

        <main className="flex-1 px-4 py-7 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
