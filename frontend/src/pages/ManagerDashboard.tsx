import { useState, useEffect, useCallback } from 'react'
import { useTheme } from '../context/ThemeContext'
import ManagerSidebar from '../components/manager/ManagerSidebar'
import ManagerTopBar from '../components/manager/ManagerTopBar'
import ManagerOverviewTab from '../components/manager/ManagerOverviewTab'
import ManagerMaintenanceTab from '../components/manager/ManagerMaintenanceTab'
import ManagerManageApartmentTab from '../components/manager/ManagerManageApartmentTab'
import ManagerSettingsTab from '../components/manager/ManagerSettingsTab'
import ManagerPaymentsTab from '../components/manager/ManagerPaymentsTab'
import ManagerNotificationsTab from '../components/manager/ManagerNotificationsTab'
import { getCurrentManager, getManagerNotifications } from '../lib/managerApi'
import { supabase } from '../lib/supabase'
import useBrowserNotifications from '../hooks/useBrowserNotifications'

export default function ManagerDashboard() {
  const { isDark } = useTheme()
  const [activeTab, setActiveTab] = useState('overview')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [manager, setManager] = useState<{ id: string; name: string; clientId: string | null; phone: string | null } | null>(null)
  const [loading, setLoading] = useState(true)
  const [pendingMaintenanceCount, setPendingMaintenanceCount] = useState(0)
  const [notificationCount, setNotificationCount] = useState(0)

  useEffect(() => {
    async function loadManager() {
      try {
        const data = await getCurrentManager()
        if (data) {
          setManager({ id: data.id, name: data.name, clientId: data.client_id, phone: data.phone })
        }
      } catch (err) {
        console.error('Failed to load manager:', err)
      } finally {
        setLoading(false)
      }
    }
    loadManager()
  }, [])

  // Fetch pending maintenance count
  useEffect(() => {
    if (!manager?.clientId) return
    async function fetchPendingCount() {
      const { count } = await supabase
        .from('maintenance_requests')
        .select('id', { count: 'exact', head: true })
        .eq('client_id', manager!.clientId!)
        .eq('status', 'pending')
      setPendingMaintenanceCount(count ?? 0)
    }
    fetchPendingCount()
    const interval = setInterval(fetchPendingCount, 30000)
    return () => clearInterval(interval)
  }, [manager?.clientId])

  const fetchManagerNotifications = useCallback(async () => {
    if (!manager?.id || !manager.clientId) return []
    return getManagerNotifications(manager.id, manager.clientId)
  }, [manager?.id, manager?.clientId])

  const refreshNotificationCount = useCallback(async () => {
    const notifications = await fetchManagerNotifications()
    const unread = notifications.filter((notification) => !notification.is_read).length
    setNotificationCount(unread)
  }, [fetchManagerNotifications])

  useEffect(() => {
    if (!manager?.id || !manager.clientId) return

    refreshNotificationCount().catch(() => {
      // silent
    })

    const interval = setInterval(() => {
      refreshNotificationCount().catch(() => {
        // silent
      })
    }, 30000)

    return () => clearInterval(interval)
  }, [manager?.id, manager?.clientId, refreshNotificationCount])

  useBrowserNotifications({
    enabled: Boolean(manager?.id && manager?.clientId),
    storageKey: `primeliving_browser_notifs_manager_${manager?.id || 'unknown'}`,
    fetchNotifications: fetchManagerNotifications,
    pollMs: 30000,
  })

  const handleTabChange = (tab: string) => {
    setActiveTab(tab)
    setSidebarOpen(false)
  }

  const renderContent = () => {
    if (loading) {
      return (
        <div className={`text-center py-16 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          Loading dashboard...
        </div>
      )
    }

    if (!manager) {
      return (
        <div className={`text-center py-16 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          <p className="text-lg font-medium mb-2">Manager profile not found</p>
          <p className="text-sm">Please ensure your account is linked to a manager profile.</p>
        </div>
      )
    }

    switch (activeTab) {
      case 'overview':
        return <ManagerOverviewTab managerId={manager.id} clientId={manager.clientId || ''} managerName={manager.name} />
      case 'maintenance':
        return <ManagerMaintenanceTab clientId={manager.clientId || ''} />
      case 'manage-apartment':
        return <ManagerManageApartmentTab clientId={manager.clientId || ''} managerName={manager.name} managerId={manager.id} />
      case 'payments':
        return <ManagerPaymentsTab clientId={manager.clientId || ''} />
      case 'notifications':
        return <ManagerNotificationsTab managerId={manager.id} clientId={manager.clientId || ''} onRead={refreshNotificationCount} />
      case 'settings':
        return <ManagerSettingsTab managerId={manager.id} managerName={manager.name} managerPhone={manager.phone} clientId={manager.clientId} />
      default:
        return <ManagerOverviewTab managerId={manager.id} clientId={manager.clientId || ''} managerName={manager.name} />
    }
  }

  return (
    <div
      className={`min-h-screen ${
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
      <ManagerSidebar
        activeTab={activeTab}
        onTabChange={handleTabChange}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        pendingMaintenanceCount={pendingMaintenanceCount}
        notificationCount={notificationCount}
      />

      {/* Main content area */}
      <div className="lg:ml-60 flex flex-col h-screen">
        <ManagerTopBar
          onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
          managerName={manager?.name}
        />

        {/* Page content */}
        <main className="flex-1 p-4 sm:p-6 text-base sm:text-lg flex flex-col min-h-0">{renderContent()}</main>
      </div>
    </div>
  )
}
