import { useState, useEffect } from 'react'
import { useTheme } from '../context/ThemeContext'
import Sidebar from '../components/admin/Sidebar'
import TopBar from '../components/admin/TopBar'
import OverviewTab from '../components/admin/OverviewTab'
import ClientsTab from '../components/admin/ClientsTab'
import InquiriesTab from '../components/admin/InquiriesTab'
import AccountTab from '../components/admin/AccountTab'
import { getPendingInquiryCount } from '../lib/api'

export default function AdminDashboard() {
  const { isDark } = useTheme()
  const [activeTab, setActiveTab] = useState('overview')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [inquiryCount, setInquiryCount] = useState(0)

  // Fetch pending inquiry count on mount and when tab changes
  useEffect(() => {
    async function fetchCount() {
      const count = await getPendingInquiryCount()
      setInquiryCount(count)
    }
    fetchCount()
    const interval = setInterval(fetchCount, 30000)
    return () => clearInterval(interval)
  }, [])

  // Refresh count when switching away from inquiries
  useEffect(() => {
    if (activeTab !== 'inquiries') return
    // Refresh after user views inquiries (they may have responded)
    return () => {
      getPendingInquiryCount().then(setInquiryCount)
    }
  }, [activeTab])

  const handleTabChange = (tab: string) => {
    setActiveTab(tab)
    setSidebarOpen(false) // Close sidebar on mobile after selecting
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        return <OverviewTab onTabChange={handleTabChange} />
      case 'clients':
        return <ClientsTab />
      case 'inquiries':
        return <InquiriesTab />
      case 'settings':
        return <AccountTab />
      default:
        return <OverviewTab />
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
      <Sidebar
        activeTab={activeTab}
        onTabChange={handleTabChange}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        inquiryCount={inquiryCount}
      />

      {/* Main content area */}
      <div className="lg:ml-60 flex flex-col min-h-screen">
        <TopBar onMenuToggle={() => setSidebarOpen(!sidebarOpen)} />

        {/* Page content */}
        <main className="flex-1 p-4 sm:p-6 text-base sm:text-lg flex flex-col min-h-0">{renderContent()}</main>
      </div>
    </div>
  )
}
