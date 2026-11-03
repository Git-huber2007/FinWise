import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

import { api, onUnauthorized } from './api'
import { Spinner } from './components/ui'

/**
 * Session state for the whole app.
 *
 * The browser cannot see the session cookie (it is HttpOnly), so "are we
 * logged in?" is answered by asking the server once on mount, not by reading
 * local storage. That also means a session expiring server-side is detected.
 */

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [preferences, setPreferences] = useState(null)
  // 'checking' until the first /api/me resolves, so ProtectedRoute does not
  // bounce an authenticated user to /login during that first round trip.
  const [status, setStatus] = useState('checking')

  useEffect(() => {
    let cancelled = false
    api
      .get('/api/me')
      .then((data) => {
        if (cancelled) return
        setUser(data.user)
        setPreferences(data.preferences)
        setStatus('authenticated')
      })
      .catch(() => {
        if (!cancelled) setStatus('anonymous')
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Any 401 from anywhere in the app clears the session here.
  useEffect(
    () =>
      onUnauthorized(() => {
        setUser(null)
        setStatus('anonymous')
      }),
    [],
  )

  const adopt = useCallback((data) => {
    setUser(data.user)
    setPreferences(data.preferences)
    setStatus('authenticated')
    return data.user
  }, [])

  const register = useCallback(
    async (payload) => adopt(await api.post('/api/register', payload)),
    [adopt],
  )

  const login = useCallback(
    async (email, password) => adopt(await api.post('/api/login', { email, password })),
    [adopt],
  )

  const logout = useCallback(async () => {
    try {
      await api.post('/api/logout')
    } finally {
      // Clear locally even if the request fails -- leaving a stale user on
      // screen after the user asked to leave is the worse failure.
      setUser(null)
      setPreferences(null)
      setStatus('anonymous')
    }
  }, [])

  const updateProfile = useCallback(
    async (payload) => adopt(await api.put('/api/me', payload)),
    [adopt],
  )

  return (
    <AuthContext.Provider
      value={{
        user,
        preferences,
        status,
        isAuthenticated: status === 'authenticated',
        register,
        login,
        logout,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}

export function ProtectedRoute({ children }) {
  const { status } = useAuth()
  const location = useLocation()

  if (status === 'checking') {
    return (
      <div className="grid min-h-screen place-items-center">
        <Spinner label="Checking your session" />
      </div>
    )
  }
  if (status !== 'authenticated') {
    // Remember where they were headed so login can return them there.
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  return children
}

/** Keeps a signed-in user away from /login and /register. */
export function PublicOnlyRoute({ children }) {
  const { status } = useAuth()
  if (status === 'checking') {
    return (
      <div className="grid min-h-screen place-items-center">
        <Spinner label="Checking your session" />
      </div>
    )
  }
  return status === 'authenticated' ? <Navigate to="/" replace /> : children
}
