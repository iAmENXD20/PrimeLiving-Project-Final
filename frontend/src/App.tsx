import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import { Toaster } from 'sonner'
import { useTheme } from './context/ThemeContext'
import ProtectedRoute from './components/ProtectedRoute'

const WelcomePage = lazy(() => import('./pages/WelcomePage'))
const LoginPage = lazy(() => import('./pages/LoginPage'))
const OwnerDashboard = lazy(() => import('./pages/OwnerDashboard'))
const ManagerDashboard = lazy(() => import('./pages/ManagerDashboard'))
const TenantDashboard = lazy(() => import('./pages/TenantDashboard'))
const InviteConfirmPage = lazy(() => import('./pages/InviteConfirmPage'))
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'))

function PageLoader() {
  const { isDark } = useTheme()
  return (
    <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-[#0A1628]' : 'bg-gray-50'}`}>
      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

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
        <Route path="/" element={<WelcomePage />} />
        <Route path="/login" element={<Suspense fallback={<PageLoader />}><LoginPage /></Suspense>} />
        <Route path="/reset-password" element={<Suspense fallback={<PageLoader />}><ResetPasswordPage /></Suspense>} />
        <Route path="/invite/confirm" element={<Suspense fallback={<PageLoader />}><InviteConfirmPage /></Suspense>} />
        <Route path="/invite/confirm/*" element={<Suspense fallback={<PageLoader />}><InviteConfirmPage /></Suspense>} />
        <Route path="/owner" element={<ProtectedRoute><Suspense fallback={<PageLoader />}><OwnerDashboard /></Suspense></ProtectedRoute>} />
        <Route path="/manager" element={<ProtectedRoute><Suspense fallback={<PageLoader />}><ManagerDashboard /></Suspense></ProtectedRoute>} />
        <Route path="/tenant" element={<ProtectedRoute><Suspense fallback={<PageLoader />}><TenantDashboard /></Suspense></ProtectedRoute>} />
      </Routes>
    </>
  )
}

export default App
