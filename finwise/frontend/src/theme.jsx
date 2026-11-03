import { createContext, useCallback, useContext, useEffect, useState } from 'react'

/**
 * Light/dark mode. Tailwind is configured with darkMode:'class', so all this
 * does is toggle `dark` on <html> and remember the choice.
 */

const ThemeContext = createContext(null)
const STORAGE_KEY = 'finwise.theme'

function initialTheme() {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved === 'light' || saved === 'dark') return saved
  // No stored preference: follow the OS rather than guessing.
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(initialTheme)

  useEffect(() => {
    // index.html ships with class="dark" so the first paint is already dark and
    // there is no white flash before React mounts.
    document.documentElement.classList.toggle('dark', theme === 'dark')
    localStorage.setItem(STORAGE_KEY, theme)
  }, [theme])

  const toggle = useCallback(() => {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'))
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, toggle, isDark: theme === 'dark' }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used inside ThemeProvider')
  return context
}
