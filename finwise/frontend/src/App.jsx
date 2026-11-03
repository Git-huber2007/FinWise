import { Route, Routes } from 'react-router-dom'

import Layout from './components/Layout'
import { Card, PageHeader } from './components/ui'
import Assistant from './pages/Assistant'
import Budget from './pages/Budget'
import Dashboard from './pages/Dashboard'
import Goals from './pages/Goals'
import Health from './pages/Health'
import Insights from './pages/Insights'
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
 * Routes mirror NAV_ITEMS in components/Layout.jsx. Phase 4 wraps these in
 * ProtectedRoute and adds /login and /register outside the layout.
 */
export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
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
