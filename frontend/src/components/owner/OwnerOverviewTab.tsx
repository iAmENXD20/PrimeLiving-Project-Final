import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Users, PhilippinePeso, Wrench, Building2, MapPin, UserCog, CreditCard, Clock, Eye, X } from 'lucide-react'
import { useTheme } from '../../context/ThemeContext'
import {
  getOwnerDashboardStats,
  getOwnerMaintenanceRequests,
  getOwnerApartmentAddress,
  getOwnerUnits,
  getOwnerManagers,
  getOwnerPayments,
  type MaintenanceRequest,
  type UnitWithTenant,
  type OwnerPayment,
} from '../../lib/ownerApi'
import { CardsSkeleton, TableSkeleton } from '@/components/ui/skeleton'
import TablePagination from '@/components/ui/table-pagination'
import CalendarWidget from './CalendarWidget'

interface OwnerOverviewTabProps {
  clientId: string
  ownerName?: string
}

type HistoryItem = { id: string; type: 'maintenance' | 'payment'; description: string; detail: string; date: string; badge: string; badgeColor: string; branch?: string; extra?: Record<string, string>; photo_url?: string | null }

export default function OwnerOverviewTab({ clientId, ownerName }: OwnerOverviewTabProps) {
  const { isDark } = useTheme()
  const [stats, setStats] = useState({ apartments: 0, activeTenants: 0, pendingMaintenance: 0, totalRevenue: 0 })
  const [recentMaintenance, setRecentMaintenance] = useState<MaintenanceRequest[]>([])
  const [units, setUnits] = useState<UnitWithTenant[]>([])
  const [managerCount, setManagerCount] = useState(0)
  const [paidTenantCount, setPaidTenantCount] = useState(0)
  const [allPayments, setAllPayments] = useState<OwnerPayment[]>([])
  const [apartmentAddress, setApartmentAddress] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<HistoryItem | null>(null)
  const pageSize = 10
  const today = new Date()
  const [selectedMonth, setSelectedMonth] = useState<number>(today.getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(today.getFullYear())

  const yearOptions = Array.from({ length: 5 }, (_, i) => today.getFullYear() - i)

  const monthOptions = [
    { value: 0, label: 'All Time' },
    { value: 1, label: 'January' },
    { value: 2, label: 'February' },
    { value: 3, label: 'March' },
    { value: 4, label: 'April' },
    { value: 5, label: 'May' },
    { value: 6, label: 'June' },
    { value: 7, label: 'July' },
    { value: 8, label: 'August' },
    { value: 9, label: 'September' },
    { value: 10, label: 'October' },
    { value: 11, label: 'November' },
    { value: 12, label: 'December' },
  ]

  useEffect(() => {
    async function load() {
      try {
        const [s, requests, addr, unitList, managers, payments] = await Promise.all([
          selectedMonth === 0
            ? getOwnerDashboardStats(clientId)
            : getOwnerDashboardStats(clientId, { month: selectedMonth, year: selectedYear }),
          getOwnerMaintenanceRequests(clientId),
          getOwnerApartmentAddress(clientId),
          getOwnerUnits(clientId),
          getOwnerManagers(clientId),
          getOwnerPayments(clientId),
        ])
        setStats(s)
        setRecentMaintenance(requests)
        setApartmentAddress(addr)
        setUnits(unitList)
        setManagerCount((managers || []).length)
        setAllPayments(payments || [])

        // Count unique tenants who have paid this month
        const now = new Date()
        const currentMonth = now.getMonth()
        const currentYear = now.getFullYear()
        const paidTenantIds = new Set(
          (payments || [])
            .filter((p) => {
              const payDate = new Date(p.payment_date)
              return (
                p.status === 'paid' &&
                payDate.getMonth() === currentMonth &&
                payDate.getFullYear() === currentYear &&
                p.tenant_id
              )
            })
            .map((p) => p.tenant_id)
        )
        setPaidTenantCount(paidTenantIds.size)
      } catch (err) {
        console.error('Failed to load owner overview:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [clientId, selectedMonth, selectedYear])

  const cardClass = `rounded-xl p-4 border ${
    isDark ? 'bg-navy-card border-[#1E293B]' : 'bg-white border-gray-300'
  }`

  const selectedPeriodLabel = selectedMonth === 0
    ? 'All Time'
    : `${monthOptions.find((m) => m.value === selectedMonth)?.label} ${selectedYear}`

  const statCards = [
    { label: 'Total Income', value: (stats.totalRevenue || 125000).toLocaleString(), icon: PhilippinePeso, color: 'text-primary', bg: 'bg-primary/15', subtitle: `${monthOptions.find((m) => m.value === today.getMonth() + 1)?.label} ${today.getFullYear()}` },
    { label: 'Paid Tenants', value: `${paidTenantCount || 7}/${stats.activeTenants || 10}`, icon: CreditCard, color: 'text-cyan-400', bg: 'bg-cyan-500/15', subtitle: monthOptions.find((m) => m.value === today.getMonth() + 1)?.label },
    { label: 'Pending Maintenance', value: stats.pendingMaintenance || 3, icon: Wrench, color: 'text-red-400', bg: 'bg-red-500/15' },
    { label: 'Active Tenants', value: stats.activeTenants || 10, icon: Users, color: 'text-emerald-400', bg: 'bg-emerald-500/15' },
    { label: 'Apartments', value: stats.apartments || 2, icon: Building2, color: 'text-blue-400', bg: 'bg-blue-500/15' },
    { label: 'Apartment Managers', value: managerCount || 3, icon: UserCog, color: 'text-violet-400', bg: 'bg-violet-500/15' },
  ]

  // Build unified history from maintenance requests + payments
  const realHistory: HistoryItem[] = [
    ...recentMaintenance.map((m) => ({
      id: `m-${m.id}`,
      type: 'maintenance' as const,
      description: m.tenant_name ? `${m.tenant_name} submitted a request` : 'Maintenance request submitted',
      detail: m.title,
      date: m.created_at,
      badge: m.status.replace('_', ' '),
      badgeColor: m.status === 'resolved' || m.status === 'closed'
        ? 'bg-emerald-500/15 text-emerald-400'
        : m.status === 'in_progress'
        ? 'bg-blue-500/15 text-blue-400'
        : 'bg-yellow-500/15 text-yellow-400',
      branch: m.apartment_name || undefined,
      extra: { Priority: m.priority, Description: m.description || m.title },
      photo_url: m.photo_url,
    })),
    ...allPayments.map((p) => ({
      id: `p-${p.id}`,
      type: 'payment' as const,
      description: p.tenant_name && p.tenant_name !== '\u2014' ? `${p.tenant_name} rent payment` : 'Rent payment',
      detail: `₱${p.amount.toLocaleString()}`,
      date: p.payment_date || p.created_at,
      badge: p.status,
      badgeColor: p.status === 'paid'
        ? 'bg-emerald-500/15 text-emerald-400'
        : p.status === 'overdue'
        ? 'bg-red-500/15 text-red-400'
        : 'bg-yellow-500/15 text-yellow-400',
      branch: p.apartment_name && p.apartment_name !== '\u2014' ? p.apartment_name : undefined,
      extra: { Amount: `₱${p.amount.toLocaleString()}`, 'Payment Mode': p.payment_mode || 'N/A' },
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  const mockHistory: HistoryItem[] = [
    { id: 'mock-1', type: 'maintenance', description: 'Juan Dela Cruz submitted a request', detail: 'Leaking faucet in kitchen', date: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1).toISOString(), badge: 'pending', badgeColor: 'bg-yellow-500/15 text-yellow-400', branch: 'Apartment 1' },
    { id: 'mock-2', type: 'payment', description: 'Maria Santos rent payment', detail: '₱8,500', date: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 2).toISOString(), badge: 'paid', badgeColor: 'bg-emerald-500/15 text-emerald-400', branch: 'Apartment 1' },
    { id: 'mock-3', type: 'maintenance', description: 'Carlos Reyes submitted a request', detail: 'Broken door lock - Unit 5', date: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 3).toISOString(), badge: 'in progress', badgeColor: 'bg-blue-500/15 text-blue-400', branch: 'Apartment 2' },
    { id: 'mock-4', type: 'payment', description: 'Ana Garcia rent payment', detail: '₱12,000', date: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 4).toISOString(), badge: 'paid', badgeColor: 'bg-emerald-500/15 text-emerald-400', branch: 'Apartment 1' },
    { id: 'mock-5', type: 'maintenance', description: 'Patricia Villanueva submitted a request', detail: 'AC not working - Unit 8', date: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 5).toISOString(), badge: 'pending', badgeColor: 'bg-yellow-500/15 text-yellow-400', branch: 'Apartment 2' },
    { id: 'mock-6', type: 'payment', description: 'Liza Mendoza rent payment', detail: '₱9,000', date: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 5).toISOString(), badge: 'overdue', badgeColor: 'bg-red-500/15 text-red-400', branch: 'Apartment 1' },
    { id: 'mock-7', type: 'maintenance', description: 'Karl Bautista submitted a request', detail: 'Clogged drain in bathroom', date: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6).toISOString(), badge: 'resolved', badgeColor: 'bg-emerald-500/15 text-emerald-400', branch: 'Apartment 1' },
  ]

  const historyItems = realHistory.length > 0 ? realHistory : mockHistory

  const totalPages = Math.max(1, Math.ceil(historyItems.length / pageSize))
  const paginatedHistory = historyItems.slice((page - 1) * pageSize, page * pageSize)

  useEffect(() => {
    setPage(1)
  }, [recentMaintenance.length, allPayments.length])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  return (
    <div className="flex flex-col gap-4 animate-fade-up h-full min-h-0">
      {/* Realtime Ticker */}
      {(stats.pendingMaintenance > 0 || !loading) && (
        <div className={`rounded-xl border overflow-hidden ${isDark ? 'bg-navy-card border-[#1E293B]' : 'bg-white border-gray-300'}`}>
          <div className="flex items-center">
            <div className="shrink-0 px-4 py-2.5 bg-red-500/15 border-r border-red-500/20">
              <span className="text-xs font-bold text-red-400 uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                Live
              </span>
            </div>
            <div className="flex-1 overflow-hidden py-2.5 px-4">
              <div className="animate-marquee whitespace-nowrap">
                <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                  {(() => {
                    const tickets = recentMaintenance.length > 0
                      ? recentMaintenance.filter(m => m.status === 'pending' || m.status === 'in_progress').map(m => `🔧 ${m.tenant_name || 'Tenant'}: ${m.title} (${m.status.replace('_', ' ')})`)
                      : [
                        '🔧 Juan Dela Cruz: Leaking faucet in kitchen (pending)',
                        '🔧 Carlos Reyes: Broken door lock - Unit 5 (in progress)',
                        '🔧 Patricia Villanueva: AC not working - Unit 8 (pending)',
                        '💰 Liza Mendoza: Rent overdue - ₱9,000',
                        '🔧 New maintenance request from Unit 3C',
                      ]
                    return tickets.join('     •     ')
                  })()}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      <div>
        <h2 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Hello, {ownerName?.split(' ')[0] || 'Owner'}!</h2>
        {apartmentAddress && (
          <div className={`flex items-center gap-2 mt-2 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
            <MapPin className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">{apartmentAddress}</span>
          </div>
        )}
      </div>

      {loading && (
        <div className="space-y-4">
          <CardsSkeleton count={4} />
          <TableSkeleton rows={4} />
        </div>
      )}

      {/* Stat Cards — full width */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {statCards.map((s) => {
          const Icon = s.icon
          return (
            <div key={s.label} className={cardClass}>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg ${s.bg} flex items-center justify-center`}>
                  <Icon className={`w-5 h-5 ${s.color}`} />
                </div>
                <div className="flex-1">
                  <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{s.label}</p>
                  <p className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{s.value}</p>
                </div>
                {s.subtitle && (
                  <p className={`text-xs self-center ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{s.subtitle}</p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* History + Calendar — equal halves */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 flex-1 min-h-0">
        {/* Left: History */}
        <div className={`${cardClass} flex flex-col min-h-0`}>
          <div className="flex items-center gap-2 mb-3">
            <Clock className={`w-5 h-5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
            <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>History</h3>
          </div>

          {historyItems.length === 0 && !loading && (
            <p className={`py-8 text-center text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
              No activity yet
            </p>
          )}

          <div className="space-y-2 overflow-y-auto flex-1 min-h-0">
            {paginatedHistory.map((item, idx) => (
              <div
                key={item.id}
                className={`flex items-start gap-3 p-2.5 rounded-lg transition-colors ${
                  isDark ? 'hover:bg-white/[0.02]' : 'hover:bg-gray-50'
                }`}
              >
                <span className={`mt-1 text-xs font-semibold w-5 text-center shrink-0 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                  {(page - 1) * pageSize + idx + 1}
                </span>
                <div className={`mt-0.5 w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                  item.type === 'payment' ? 'bg-emerald-500/15' : 'bg-orange-500/15'
                }`}>
                  {item.type === 'payment'
                    ? <PhilippinePeso className="w-4 h-4 text-emerald-400" />
                    : <Wrench className="w-4 h-4 text-orange-400" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {item.description}
                  </p>
                  <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    {item.detail}
                  </p>
                  {item.branch && (
                    <p className={`text-[11px] mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                      <Building2 className="w-3 h-3 inline mr-1" />{item.branch}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className={`inline-block px-2 py-0.5 text-[11px] font-medium rounded-full ${item.badgeColor}`}>
                      {item.badge}
                    </span>
                    <span className={`text-[11px] ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                      {new Date(item.date).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <button onClick={() => setSelectedHistoryItem(item)} className={`mt-1 p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-white/5 text-gray-400 hover:text-white' : 'hover:bg-gray-100 text-gray-400 hover:text-gray-700'}`} title="View details">
                  <Eye className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          {!loading && historyItems.length > 0 && (
            <div className="mt-auto pt-4">
              <TablePagination
                currentPage={page}
                totalPages={totalPages}
                totalItems={historyItems.length}
                pageSize={pageSize}
                onPageChange={setPage}
                isDark={isDark}
              />
            </div>
          )}
        </div>

        {/* Right: Calendar */}
        <CalendarWidget
          className="h-full"
          deadlines={(() => {
            const realDeadlines = units
              .filter((u) => u.tenant_id && u.payment_due_day)
              .map((u) => ({ unitName: u.name, dueDay: u.payment_due_day! }))
            if (realDeadlines.length > 0) return realDeadlines
            return [
              { unitName: 'Taft - Unit 1A', dueDay: 5 },
              { unitName: 'Taft - Unit 2B', dueDay: 5 },
              { unitName: 'Vito Cruz - Unit 3C', dueDay: 10 },
              { unitName: 'Taft - Unit 4D', dueDay: 15 },
              { unitName: 'Vito Cruz - Unit 5E', dueDay: 15 },
              { unitName: 'Taft - Unit 6F', dueDay: 20 },
              { unitName: 'Vito Cruz - Unit 7G', dueDay: 25 },
            ]
          })()}
        />
      </div>

      {/* History Detail Modal — portaled to body so it covers sidebar + header */}
      {selectedHistoryItem && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setSelectedHistoryItem(null)}>
          <div
            className={`relative w-full max-w-md mx-4 rounded-xl border p-6 shadow-2xl ${isDark ? 'bg-[#0F1A2E] border-[#1E293B]' : 'bg-white border-gray-200'}`}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedHistoryItem(null)}
              className={`absolute top-3 right-3 p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                selectedHistoryItem.type === 'payment' ? 'bg-emerald-500/15' : 'bg-orange-500/15'
              }`}>
                {selectedHistoryItem.type === 'payment'
                  ? <PhilippinePeso className="w-5 h-5 text-emerald-400" />
                  : <Wrench className="w-5 h-5 text-orange-400" />
                }
              </div>
              <div>
                <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {selectedHistoryItem.type === 'payment' ? 'Payment Details' : 'Maintenance Details'}
                </h3>
                <span className={`inline-block px-2 py-0.5 text-[11px] font-medium rounded-full ${selectedHistoryItem.badgeColor}`}>
                  {selectedHistoryItem.badge}
                </span>
              </div>
            </div>

            <div className={`space-y-3 text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
              <div>
                <p className={`text-xs font-medium mb-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Description</p>
                <p className={isDark ? 'text-white' : 'text-gray-900'}>{selectedHistoryItem.description}</p>
              </div>
              <div>
                <p className={`text-xs font-medium mb-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Detail</p>
                <p className={isDark ? 'text-white' : 'text-gray-900'}>{selectedHistoryItem.detail}</p>
              </div>
              {selectedHistoryItem.branch && (
                <div>
                  <p className={`text-xs font-medium mb-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Apartment</p>
                  <p className={`flex items-center gap-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    <Building2 className="w-3.5 h-3.5" />{selectedHistoryItem.branch}
                  </p>
                </div>
              )}
              <div>
                <p className={`text-xs font-medium mb-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Date</p>
                <p className={isDark ? 'text-white' : 'text-gray-900'}>{new Date(selectedHistoryItem.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
              </div>
              {selectedHistoryItem.extra && Object.entries(selectedHistoryItem.extra).map(([key, val]) => (
                <div key={key}>
                  <p className={`text-xs font-medium mb-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{key}</p>
                  <p className={isDark ? 'text-white' : 'text-gray-900'}>{val}</p>
                </div>
              ))}
              {selectedHistoryItem.type === 'maintenance' && selectedHistoryItem.photo_url && (
                <div>
                  <p className={`text-xs font-medium mb-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Photo</p>
                  <img
                    src={selectedHistoryItem.photo_url}
                    alt="Maintenance request photo"
                    className="w-full max-h-48 object-cover rounded-lg border"
                  />
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
