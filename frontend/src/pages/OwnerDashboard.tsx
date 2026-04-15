import { useState, useEffect, lazy, Suspense } from 'react'
import { useTheme } from '../context/ThemeContext'
import OwnerSidebar from '../components/owner/OwnerSidebar'
import OwnerTopBar from '../components/owner/OwnerTopBar'
import { getCurrentOwner, getOwnerDashboardStats } from '../lib/ownerApi'
import { CardsSkeleton } from '../components/ui/skeleton'

const OwnerOverviewTab = lazy(() => import('../components/owner/OwnerOverviewTab'))
const OwnerManageApartmentTab = lazy(() => import('../components/owner/OwnerManageApartmentTab'))
const OwnerAccountTab = lazy(() => import('../components/owner/OwnerAccountTab'))
const OwnerMaintenanceTab = lazy(() => import('../components/owner/OwnerMaintenanceTab'))
const OwnerPaymentsTab = lazy(() => import('../components/owner/OwnerPaymentsTab'))
const OwnerApartmentLogsTab = lazy(() => import('../components/owner/OwnerApartmentLogsTab'))
const OwnerAuditReportsTab = lazy(() => import('../components/owner/OwnerAuditReportsTab'))

export default function OwnerDashboard() {
  const { isDark } = useTheme()
  const [activeTab, setActiveTab] = useState('overview')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [owner, setOwner] = useState<{ id: string; first_name: string; last_name: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [pendingMaintenanceCount, setPendingMaintenanceCount] = useState(0)

  useEffect(() => {
    async function loadOwner() {
      try {
        const data = await getCurrentOwner()
        if (data) {
          setOwner({ id: data.id, first_name: data.first_name, last_name: data.last_name })
          // Load pending maintenance count using lightweight stats endpoint
          try {
            const stats = await getOwnerDashboardStats(data.id)
            setPendingMaintenanceCount(stats.pendingMaintenance ?? 0)
          } catch {
            setPendingMaintenanceCount(0)
          }
        }
      } catch (err) {
        console.error('Failed to load owner:', err)
      } finally {
        setLoading(false)
      }
    }
    loadOwner()
  }, [])

  const handleTabChange = (tab: string) => {
    setActiveTab(tab)
    setSidebarOpen(false)
  }

  const renderContent = () => {
    if (loading) {
      return (
        <div className="space-y-4">
          <div className={`h-8 w-48 rounded ${isDark ? 'bg-white/10' : 'bg-gray-200'} animate-pulse`} />
          <CardsSkeleton count={4} />
        </div>
      )
    }

    if (!owner) {
      return (
        <div className={`text-center py-16 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          <p className="text-lg font-medium mb-2">Owner profile not found</p>
          <p className="text-sm">Please ensure your account is linked to an owner profile.</p>
        </div>
      )
    }

    switch (activeTab) {
      case 'overview':
        return <OwnerOverviewTab ownerId={owner.id} ownerName={`${owner.first_name} ${owner.last_name}`.trim()} />
      case 'units':
        return <OwnerManageApartmentTab key="units" ownerId={owner.id} mode="units" />
      case 'manage-apartment':
        return <OwnerManageApartmentTab key="manage" ownerId={owner.id} mode="manage" />
      case 'maintenance':
        return <OwnerMaintenanceTab ownerId={owner.id} ownerName={`${owner.first_name} ${owner.last_name}`.trim()} />
      case 'payments':
        return <OwnerPaymentsTab ownerId={owner.id} />
      case 'activity-logs':
        return <OwnerApartmentLogsTab ownerId={owner.id} />
      case 'audit-reports':
        return <OwnerAuditReportsTab ownerId={owner.id} />
      case 'account':
        return <OwnerAccountTab ownerId={owner.id} />
      default:
        return <OwnerOverviewTab ownerId={owner.id} ownerName={`${owner.first_name} ${owner.last_name}`.trim()} />
    }
  }

  return (
    <div
      className={`h-screen overflow-hidden ${
        isDark ? 'bg-[#0A1628] text-white' : 'bg-gray-50 text-gray-900'
      }`}
    >
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <OwnerSidebar
        activeTab={activeTab}
        onTabChange={handleTabChange}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        ownerName={owner ? `${owner.first_name} ${owner.last_name}`.trim() : ''}
        pendingMaintenanceCount={pendingMaintenanceCount}
      />

      {/* Main content area */}
      <div className="lg:ml-64 flex flex-col h-screen">
        <OwnerTopBar
          onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
          ownerName={owner ? `${owner.first_name} ${owner.last_name}`.trim() : undefined}
        />

        {/* Page content */}
        <main className="flex-1 p-4 sm:p-6 text-base sm:text-lg flex flex-col min-h-0 overflow-y-auto">
          <Suspense fallback={<div className="flex items-center justify-center py-16"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>}>
            {renderContent()}
          </Suspense>
        </main>
      </div>
    </div>
  )
}
