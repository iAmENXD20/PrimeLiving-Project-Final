import { useState, useEffect, useCallback, lazy, Suspense } from 'react'
import { createPortal } from 'react-dom'
import { HelpCircle, X, ChevronDown } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'
import TenantSidebar from '../components/tenant/TenantSidebar'
import TenantTopBar from '../components/tenant/TenantTopBar'
import { getCurrentTenant, getTenantApartmentInfo, getUnreadNotificationCount, getTenantNotifications } from '../lib/tenantApi'
import useBrowserNotifications from '../hooks/useBrowserNotifications'
import { CardsSkeleton } from '../components/ui/skeleton'

const TenantOverviewTab = lazy(() => import('../components/tenant/TenantOverviewTab'))
const TenantMaintenanceTab = lazy(() => import('../components/tenant/TenantMaintenanceTab'))
const TenantPaymentsTab = lazy(() => import('../components/tenant/TenantPaymentsTab'))
const TenantNotificationsTab = lazy(() => import('../components/tenant/TenantNotificationsTab'))
const TenantAccountTab = lazy(() => import('../components/tenant/TenantAccountTab'))
const TenantDocumentsTab = lazy(() => import('../components/tenant/TenantDocumentsTab'))

export default function TenantDashboard() {
  const { isDark } = useTheme()
  const [activeTab, setActiveTab] = useState('overview')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [tenant, setTenant] = useState<{
    id: string
    name: string
    phone: string | null
    apartmentId: string | null
    clientId: string | null
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [notificationCount, setNotificationCount] = useState(0)

  useEffect(() => {
    async function loadTenant() {
      try {
        const data = await getCurrentTenant()
        if (data) {
          let clientId: string | null = data.apartmentowner_id || null
          if (data.unit_id) {
            const aptInfo = await getTenantApartmentInfo(data.unit_id)
            clientId = aptInfo?.apartmentowner_id || clientId
          }
          setTenant({
            id: data.id,
            name: data.name,
            phone: data.phone,
            apartmentId: data.unit_id,
            clientId,
          })

          // Load unread notification count
          const count = await getUnreadNotificationCount(data.id, clientId)
          setNotificationCount(count)
        }
      } catch (err) {
        console.error('Failed to load tenant:', err)
      } finally {
        setLoading(false)
      }
    }
    loadTenant()
  }, [])

  // Refresh notification count periodically and when switching tabs
  const [faqOpen, setFaqOpen] = useState(false)
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null)

  const faqs = [
    { q: 'How do I pay my monthly rent?', a: 'Go to the Payments tab, click "Pay Now", select your mode of payment (Cash or QR Payment), fill in the details, and submit. Your payment will appear as pending until confirmed by the manager.' },
    { q: 'How do I submit a maintenance request?', a: 'Navigate to the Maintenance tab, fill out the form on the left with a title, description, and priority level, then click Submit. You can track the status of your request in the list.' },
    { q: 'What should I do if there\'s an emergency repair needed?', a: 'Submit a maintenance request with "Urgent" priority. For immediate emergencies (fire, flooding, gas leak), contact your building manager directly by phone.' },
    { q: 'When is my rent due?', a: 'Rent is typically due on the 1st of each month. Check with your property manager for specific due dates and any grace period policies.' },
    { q: 'Can I see my payment history?', a: 'Yes! Go to the Payments tab to view all your past and pending payments, including dates, amounts, and confirmation status.' },
    { q: 'How do I update my personal information?', a: 'Go to Account Settings from the sidebar. You can update your name, phone number, and password from there.' },
    { q: 'What is the process for renewing my lease?', a: 'Your property manager will notify you before your lease expires. You can discuss renewal terms and sign a new contract through the Documents section or directly with management.' },
    { q: 'How do I report a noise complaint?', a: 'Submit a maintenance request with the category describing the issue. Include details like the time, location, and nature of the disturbance.' },
    { q: 'Are pets allowed in the building?', a: 'Pet policies vary by property. Check your lease agreement or contact your property manager for the specific pet policy of your building.' },
    { q: 'How do I give notice before moving out?', a: 'Notify your property manager in writing at least 30 days before your intended move-out date (or as specified in your lease). Coordinate the unit inspection and key return with management.' },
  ]

  const refreshNotificationCount = async () => {
    if (tenant?.id) {
      try {
        const count = await getUnreadNotificationCount(tenant.id, tenant.clientId)
        setNotificationCount(count)
      } catch {
        // silent
      }
    }
  }

  // Poll every 30 seconds for new notifications
  useEffect(() => {
    if (!tenant?.id) return
    const interval = setInterval(refreshNotificationCount, 30000)
    return () => clearInterval(interval)
  }, [tenant?.id, tenant?.clientId])

  const fetchTenantNotifications = useCallback(async () => {
    if (!tenant?.id) return []
    return getTenantNotifications(tenant.id, tenant.clientId)
  }, [tenant?.id, tenant?.clientId])

  useBrowserNotifications({
    enabled: Boolean(tenant?.id),
    storageKey: `primeliving_browser_notifs_tenant_${tenant?.id || 'unknown'}`,
    fetchNotifications: fetchTenantNotifications,
    pollMs: 30000,
  })

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

    if (!tenant) {
      return (
        <div className={`text-center py-16 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          <p className="text-lg font-medium mb-2">Tenant profile not found</p>
          <p className="text-sm">Please ensure your account is linked to a tenant profile.</p>
        </div>
      )
    }

    switch (activeTab) {
      case 'overview':
        return <TenantOverviewTab tenantId={tenant.id} apartmentId={tenant.apartmentId} tenantName={tenant.name} clientId={tenant.clientId} />
      case 'maintenance':
        return <TenantMaintenanceTab tenantId={tenant.id} apartmentId={tenant.apartmentId} clientId={tenant.clientId} />
      case 'payments':
        return <TenantPaymentsTab tenantId={tenant.id} clientId={tenant.clientId} apartmentId={tenant.apartmentId} />
      case 'documents':
        return <TenantDocumentsTab tenantId={tenant.id} clientId={tenant.clientId} />
      case 'notifications':
        return <TenantNotificationsTab tenantId={tenant.id} clientId={tenant.clientId} onRead={refreshNotificationCount} />
      case 'account':
        return <TenantAccountTab tenantId={tenant.id} tenantName={tenant.name} tenantPhone={tenant.phone} apartmentId={tenant.apartmentId} clientId={tenant.clientId} />
      default:
        return <TenantOverviewTab tenantId={tenant.id} apartmentId={tenant.apartmentId} tenantName={tenant.name} clientId={tenant.clientId} />
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
      <TenantSidebar
        activeTab={activeTab}
        onTabChange={handleTabChange}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        notificationCount={notificationCount}
      />

      {/* Main content area */}
      <div className="lg:ml-60 flex flex-col min-h-screen">
        <TenantTopBar
          onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
          tenantName={tenant?.name}
        />

        {/* Page content */}
        <main className="flex-1 p-4 sm:p-6 text-base sm:text-lg flex flex-col min-h-0">
          <Suspense fallback={<div className="flex items-center justify-center py-16"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>}>
            {renderContent()}
          </Suspense>
        </main>
      </div>

      {/* Floating FAQ Button */}
      <button
        onClick={() => setFaqOpen(true)}
        className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-primary text-white shadow-lg hover:bg-primary/90 transition-all hover:scale-105 flex items-center justify-center"
        title="Frequently Asked Questions"
      >
        <HelpCircle className="w-6 h-6" />
      </button>

      {/* FAQ Modal */}
      {faqOpen && createPortal(
        <div className="fixed inset-0 z-[100]">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => { setFaqOpen(false); setExpandedFaq(null) }} />
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className={`relative w-full max-w-lg max-h-[80vh] flex flex-col rounded-xl border p-6 ${isDark ? 'bg-[#111C32] border-[#1E293B]' : 'bg-white border-gray-200 shadow-xl'}`}>
              <div className="flex items-center justify-between mb-4 flex-shrink-0">
                <div>
                  <h3 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    Frequently Asked Questions
                  </h3>
                  <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    Common questions about renting
                  </p>
                </div>
                <button
                  onClick={() => { setFaqOpen(false); setExpandedFaq(null) }}
                  className={`p-2 rounded-lg transition-colors ${isDark ? 'text-gray-400 hover:bg-white/10' : 'text-gray-500 hover:bg-gray-100'}`}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="overflow-y-auto flex-1 min-h-0 space-y-2 pr-1">
                {faqs.map((faq, i) => (
                  <div
                    key={i}
                    className={`rounded-lg border transition-colors ${
                      isDark ? 'border-[#1E293B]' : 'border-gray-200'
                    }`}
                  >
                    <button
                      onClick={() => setExpandedFaq(expandedFaq === i ? null : i)}
                      className={`w-full flex items-center justify-between px-4 py-3 text-left text-sm font-medium transition-colors ${
                        isDark
                          ? 'text-white hover:bg-white/5'
                          : 'text-gray-900 hover:bg-gray-50'
                      }`}
                    >
                      <span className="flex items-center gap-3 flex-1 pr-2">
                        <span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          expandedFaq === i
                            ? 'bg-primary text-white'
                            : isDark ? 'bg-[#1E293B] text-gray-400' : 'bg-gray-100 text-gray-500'
                        }`}>
                          {i + 1}
                        </span>
                        {faq.q}
                      </span>
                      <ChevronDown className={`w-4 h-4 flex-shrink-0 transition-transform duration-200 ${expandedFaq === i ? 'rotate-180' : ''} ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                    </button>
                    <div
                      className={`overflow-hidden transition-all duration-200 ${
                        expandedFaq === i ? 'max-h-48 opacity-100' : 'max-h-0 opacity-0'
                      }`}
                    >
                      <p className={`px-4 pb-3 pl-[52px] text-sm leading-relaxed ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                        {faq.a}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
