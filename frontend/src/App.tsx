import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import { useAuthStore } from './stores/authStore'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import DashboardPage from './pages/DashboardPage'
import AccountsPage from './pages/AccountsPage'
import AccountDetailPage from './pages/AccountDetailPage'
import ImportPage from './pages/ImportPage'
import SettingsPage from './pages/SettingsPage'
import TagsPage from './pages/TagsPage'
import TagRulesPage from './pages/TagRulesPage'
import AppShell from './components/layout/AppShell'
import ErrorBoundary from './components/layout/ErrorBoundary'

function App() {
  const { user, loading } = useAuth()
  const hydrate = useAuthStore((s) => s.hydrate)

  useEffect(() => {
    hydrate()
  }, [hydrate])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    )
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    )
  }

  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/" element={
          <AppShell containerClass="max-w-6xl">
            <DashboardPage />
          </AppShell>
        } />
        <Route path="/accounts" element={
          <AppShell>
            <AccountsPage />
          </AppShell>
        } />
        <Route path="/accounts/:id" element={
          <AppShell>
            <AccountDetailPage />
          </AppShell>
        } />
        <Route path="/import" element={
          <AppShell>
            <ImportPage />
          </AppShell>
        } />
        <Route path="/settings" element={
          <AppShell>
            <SettingsPage />
          </AppShell>
        } />
        <Route path="/tags" element={
          <AppShell>
            <TagsPage />
          </AppShell>
        } />
        <Route path="/tag-rules" element={
          <AppShell>
            <TagRulesPage />
          </AppShell>
        } />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ErrorBoundary>
  )
}

export default App
