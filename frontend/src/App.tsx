import { Routes, Route } from 'react-router-dom'
import { Toaster } from 'sonner'
import { useTheme } from './context/ThemeContext'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import AdminDashboard from './pages/AdminDashboard'
import OwnerDashboard from './pages/OwnerDashboard'
import ManagerDashboard from './pages/ManagerDashboard'
import TenantDashboard from './pages/TenantDashboard'
import ProtectedRoute from './components/ProtectedRoute'

function App() {
  const { isDark } = useTheme()

  return (
    <>
      <Toaster
        position="top-right"
        theme={isDark ? 'dark' : 'light'}
        toastOptions={{
          style: {
            background: isDark ? '#111D32' : '#ffffff',
            color: isDark ? '#fff' : '#1e293b',
            border: isDark
              ? '1px solid rgba(5, 150, 105, 0.3)'
              : '1px solid rgba(0, 0, 0, 0.1)',
          },
        }}
      />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/admin" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
        <Route path="/owner" element={<ProtectedRoute><OwnerDashboard /></ProtectedRoute>} />
        <Route path="/manager" element={<ProtectedRoute><ManagerDashboard /></ProtectedRoute>} />
        <Route path="/tenant" element={<ProtectedRoute><TenantDashboard /></ProtectedRoute>} />
      </Routes>
    </>
  )
}

export default App
