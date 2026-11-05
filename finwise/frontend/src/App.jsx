import { Route, Routes } from 'react-router-dom'

import { ProtectedRoute, PublicOnlyRoute } from './auth'
import Layout from './components/Layout'
import { Card, PageHeader } from './components/ui'
import Assistant from './pages/Assistant'
import Budget from './pages/Budget'
import Dashboard from './pages/Dashboard'
import Goals from './pages/Goals'
import Health from './pages/Health'
import Insights from './pages/Insights'
import Login from './pages/Login'
import Register from './pages/Register'
import Reports from './pages/Reports'
import Settings from './pages/Settings'
import Transactions from './pages/Transactions'

function NotFound() {
  return (
    <>
      <PageHeader title="Page not found" subtitle="That route does not exist." />
      <Card className="p-8 text-center text-sm muted">
        Pick a destination from the navigation.
      </Card>
    </>
  )
}

/**
 * Two route groups: the signed-out pair, and everything behind
 * ProtectedRoute inside the app shell. Routes mirror NAV_ITEMS in Layout.jsx.
 */
export default function App() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicOnlyRoute>
            <Login />
          </PublicOnlyRoute>
        }
      />
      <Route
        path="/register"
        element={
          <PublicOnlyRoute>
            <Register />
          </PublicOnlyRoute>
        }
      />

      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="transactions" element={<Transactions />} />
        <Route path="budget" element={<Budget />} />
        <Route path="insights" element={<Insights />} />
        <Route path="health" element={<Health />} />
        <Route path="goals" element={<Goals />} />
        <Route path="assistant" element={<Assistant />} />
        <Route path="reports" element={<Reports />} />
        <Route path="settings" element={<Settings />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
