import { useState, useEffect, useCallback, lazy, Suspense } from 'react'
import { useTheme } from '../context/ThemeContext'
import OwnerSidebar from '../components/owner/OwnerSidebar'
import OwnerTopBar from '../components/owner/OwnerTopBar'
import { getCurrentOwner, getOwnerDashboardStats } from '../lib/ownerApi'
import { useAutoRefresh } from '../hooks/useAutoRefresh'
import { CardsSkeleton, DashboardPageSkeleton } from '../components/ui/skeleton'
import TwoFactorEnforcementOverlay from '../components/shared/TwoFactorEnforcementOverlay'

const OwnerOverviewTab = lazy(() => import('../components/owner/OwnerOverviewTab'))
const OwnerManageApartmentTab = lazy(() => import('../components/owner/OwnerManageApartmentTab'))
const OwnerAccountTab = lazy(() => import('../components/owner/OwnerAccountTab'))
const OwnerMaintenanceTab = lazy(() => import('../components/owner/OwnerMaintenanceTab'))
const OwnerPaymentsTab = lazy(() => import('../components/owner/OwnerPaymentsTab'))
const OwnerApartmentLogsTab = lazy(() => import('../components/owner/OwnerApartmentLogsTab'))
const OwnerAuditReportsTab = lazy(() => import('../components/owner/OwnerAuditReportsTab'))
const OwnerAnnouncementsTab = lazy(() => import('../components/owner/OwnerAnnouncementsTab'))
const OwnerAnalyticsTab = lazy(() => import('../components/owner/OwnerAnalyticsTab'))

export default function OwnerDashboard() {
  const { isDark } = useTheme()
  const [activeTab, setActiveTab] = useState('overview')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [owner, setOwner] = useState<{ id: string; first_name: string; last_name: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [pendingMaintenanceCount, setPendingMaintenanceCount] = useState(0)
  const [refreshKey, setRefreshKey] = useState(0)

  const loadOwner = async () => {
    setLoading(true)
    setLoadError(false)
    try {
      const data = await getCurrentOwner()
      if (data) {
        setOwner({ id: data.id, first_name: data.first_name, last_name: data.last_name })
        try {
          const stats = await getOwnerDashboardStats(data.id)
          setPendingMaintenanceCount(stats.pendingMaintenance ?? 0)
        } catch {
          setPendingMaintenanceCount(0)
        }
      }
    } catch (err) {
      console.error('Failed to load owner:', err)
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }

  const refreshData = useCallback(() => {
    loadOwner()
    setRefreshKey((k) => k + 1)
  }, [])

  useAutoRefresh(refreshData, { enabled: !!owner })

  useEffect(() => {
    loadOwner()
  }, [])

  const handleTabChange = (tab: string) => {
    setActiveTab(tab)
    setSidebarOpen(false)
  }

  const renderContent = () => {
    if (loading) {
      return <DashboardPageSkeleton />
    }

    if (!owner) {
      return (
        <div className={`text-center py-16 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          <p className="text-lg font-medium mb-2">{loadError ? 'Failed to load profile' : 'Owner profile not found'}</p>
          <p className="text-sm mb-4">{loadError ? 'A connection error occurred. Please try again.' : 'Please ensure your account is linked to an owner profile.'}</p>
          {loadError && (
            <button onClick={loadOwner} className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors">
              Retry
            </button>
          )}
        </div>
      )
    }

    switch (activeTab) {
      case 'overview':
        return <OwnerOverviewTab key={refreshKey} ownerId={owner.id} ownerName={`${owner.first_name} ${owner.last_name}`.trim()} />
      case 'units':
        return <OwnerManageApartmentTab key={`units-${refreshKey}`} ownerId={owner.id} mode="units" />
      case 'manage-apartment':
        return <OwnerManageApartmentTab key={`manage-${refreshKey}`} ownerId={owner.id} mode="manage" />
      case 'maintenance':
        return <OwnerMaintenanceTab key={refreshKey} ownerId={owner.id} ownerName={`${owner.first_name} ${owner.last_name}`.trim()} />
      case 'payments':
        return <OwnerPaymentsTab key={refreshKey} ownerId={owner.id} />
      case 'activity-logs':
        return <OwnerApartmentLogsTab key={refreshKey} ownerId={owner.id} />
      case 'announcements':
        return <OwnerAnnouncementsTab key={refreshKey} ownerId={owner.id} ownerName={`${owner.first_name} ${owner.last_name}`.trim()} />
      case 'analytics':
        return <OwnerAnalyticsTab key={refreshKey} ownerId={owner.id} />
      case 'audit-reports':
        return <OwnerAuditReportsTab key={refreshKey} ownerId={owner.id} />
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
      <TwoFactorEnforcementOverlay role="Owner" />

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
          onRefresh={refreshData}
        />

        {/* Page content */}
        <main className="flex-1 p-4 sm:p-6 text-base sm:text-lg flex flex-col min-h-0 overflow-y-auto">
          <Suspense fallback={<DashboardPageSkeleton />}>
            {renderContent()}
          </Suspense>
        </main>
      </div>
    </div>
  )
}
