import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'

import { ProtectedRoute, PublicOnlyRoute } from './auth'
import Layout from './components/Layout'
import { Card, PageHeader, Spinner } from './components/ui'

const Assistant = lazy(() => import('./pages/Assistant'))
const Budget = lazy(() => import('./pages/Budget'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Goals = lazy(() => import('./pages/Goals'))
const Health = lazy(() => import('./pages/Health'))
const Insights = lazy(() => import('./pages/Insights'))
const Login = lazy(() => import('./pages/Login'))
const Register = lazy(() => import('./pages/Register'))
const Reports = lazy(() => import('./pages/Reports'))
const Settings = lazy(() => import('./pages/Settings'))
const Subscriptions = lazy(() => import('./pages/Subscriptions'))
const Transactions = lazy(() => import('./pages/Transactions'))

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
    <Suspense fallback={<Spinner label="Loading page" />}>
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
          <Route path="subscriptions" element={<Subscriptions />} />
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
    </Suspense>
  )
}
