import { useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import Layout from './components/layout/Layout'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import InboundsPage from './pages/InboundsPage'
import ClientsPage from './pages/ClientsPage'
import TrafficPage from './pages/TrafficPage'
import SettingsPage from './pages/SettingsPage'
import LogsPage from './pages/LogsPage'
import IPLimitPage from './pages/IPLimitPage'
import LoadingScreen from './components/LoadingScreen'

function PrivateRoute({ children }) {
  const { user } = useAuth()
  return user ? children : <Navigate to="/login" replace />
}

export default function App() {
  const [appLoading, setAppLoading] = useState(true)

  if (appLoading) return <LoadingScreen onDone={() => setAppLoading(false)} />

  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="inbounds" element={<InboundsPage />} />
          <Route path="clients" element={<ClientsPage />} />
          <Route path="traffic" element={<TrafficPage />} />
          <Route path="logs" element={<LogsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="iplimit" element={<IPLimitPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </AuthProvider>
  )
}
