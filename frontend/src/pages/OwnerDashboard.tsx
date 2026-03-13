import { useState, useEffect } from 'react'
import { useTheme } from '../context/ThemeContext'
import OwnerSidebar from '../components/owner/OwnerSidebar'
import OwnerTopBar from '../components/owner/OwnerTopBar'
import OwnerOverviewTab from '../components/owner/OwnerOverviewTab'
import OwnerManageApartmentTab from '../components/owner/OwnerManageApartmentTab'
import OwnerAccountTab from '../components/owner/OwnerAccountTab'
import OwnerMaintenanceTab from '../components/owner/OwnerMaintenanceTab'
import OwnerPaymentsTab from '../components/owner/OwnerPaymentsTab'
import { getCurrentOwner } from '../lib/ownerApi'

export default function OwnerDashboard() {
  const { isDark } = useTheme()
  const [activeTab, setActiveTab] = useState('overview')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [owner, setOwner] = useState<{ id: string; name: string } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadOwner() {
      try {
        const data = await getCurrentOwner()
        if (data) {
          setOwner({ id: data.id, name: data.name })
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
        <div className={`text-center py-16 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          Loading dashboard...
        </div>
      )
    }

    if (!owner) {
      return (
        <div className={`text-center py-16 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          <p className="text-lg font-medium mb-2">Owner profile not found</p>
          <p className="text-sm">Please ensure your account is linked to a client profile.</p>
        </div>
      )
    }

    switch (activeTab) {
      case 'overview':
        return <OwnerOverviewTab clientId={owner.id} ownerName={owner.name} />
      case 'manage-apartment':
        return <OwnerManageApartmentTab clientId={owner.id} />
      case 'maintenance':
        return <OwnerMaintenanceTab clientId={owner.id} ownerName={owner.name} />
      case 'payments':
        return <OwnerPaymentsTab clientId={owner.id} />
      case 'account':
        return <OwnerAccountTab clientId={owner.id} />
      default:
        return <OwnerOverviewTab clientId={owner.id} ownerName={owner.name} />
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
      <OwnerSidebar
        activeTab={activeTab}
        onTabChange={handleTabChange}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main content area */}
      <div className="lg:ml-60 flex flex-col h-screen">
        <OwnerTopBar
          onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
          ownerName={owner?.name}
        />

        {/* Page content */}
        <main className="flex-1 p-4 sm:p-6 text-base sm:text-lg flex flex-col min-h-0">{renderContent()}</main>
      </div>
    </div>
  )
}
