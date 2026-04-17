import { useEffect, useState, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Users, AlertTriangle, MapPin, Building2, CheckCircle, XCircle, Wrench, PhilippinePeso, Clock, Eye, X } from 'lucide-react'
import { useTheme } from '../../context/ThemeContext'
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription'
import { getManagerDashboardStats, getManagerMaintenanceRequests, getPayments, getManagedApartments, type MaintenanceRequest, type Payment } from '../../lib/managerApi'
import { getOwnerApartmentAddress, getOwnerApartmentName } from '../../lib/ownerApi'
import { CardsSkeleton, TableSkeleton } from '@/components/ui/skeleton'
import TablePagination from '@/components/ui/table-pagination'
import CalendarWidget from '../owner/CalendarWidget'

interface ManagerOverviewTabProps {
  managerId: string
  managerName?: string
  ownerId: string
}

type HistoryItem = { id: string; type: 'maintenance' | 'payment'; description: string; detail: string; date: string; badge: string; badgeColor: string; branch?: string; extra?: Record<string, string>; photo_url?: string | null }

export default function ManagerOverviewTab({ managerId, managerName, ownerId }: ManagerOverviewTabProps) {
  const { isDark } = useTheme()
  const [stats, setStats] = useState({ managedApartments: 0, activeTenants: 0, pendingMaintenance: 0, totalMaintenance: 0, paidTenants: 0, unpaidTenants: 0 })
  const [recentRequests, setRecentRequests] = useState<MaintenanceRequest[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<HistoryItem | null>(null)
  const [apartmentBranch, setApartmentBranch] = useState<string | null>(null)
  const [apartmentAddress, setApartmentAddress] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const initialLoadDone = useRef(false)
  const [page, setPage] = useState(1)
  const pageSize = 10

  const loadAll = useCallback(async () => {
    try {
      if (!initialLoadDone.current) setLoading(true)
      const [s, requests, units, paymentData] = await Promise.all([
        getManagerDashboardStats(managerId),
        getManagerMaintenanceRequests(managerId),
        getManagedApartments(managerId),
        getPayments(managerId),
      ])
      setStats(s)
      setRecentRequests(requests)
      setPayments(paymentData)

      let branchResolved = false
      let addressResolved = false
      const firstUnit = units?.[0]
      if (firstUnit) {
        const aptCode = firstUnit.apartment_name || null
        const unitName = firstUnit.name || null
        if (aptCode && unitName) {
          setApartmentBranch(`${aptCode} — ${unitName}`)
          branchResolved = true
        } else if (aptCode || unitName) {
          setApartmentBranch(aptCode || unitName || null)
          branchResolved = true
        }
        const addrParts = [
          firstUnit.apartment_address_street,
          firstUnit.apartment_address_barangay,
          firstUnit.apartment_address_city,
          firstUnit.apartment_address_province,
        ].filter(Boolean)
        if (addrParts.length > 0) {
          setApartmentAddress(addrParts.join(', '))
          addressResolved = true
        }
      }
      if ((!branchResolved || !addressResolved) && ownerId) {
        const [name, addr] = await Promise.all([
          branchResolved ? Promise.resolve(null) : getOwnerApartmentName(ownerId),
          addressResolved ? Promise.resolve(null) : getOwnerApartmentAddress(ownerId),
        ])
        if (name) setApartmentBranch(name)
        if (addr) setApartmentAddress(addr)
      }
    } catch (err) {
      console.error('Failed to load manager overview:', err)
    } finally {
      setLoading(false)
      initialLoadDone.current = true
    }
  }, [managerId, ownerId])

  useEffect(() => { loadAll() }, [loadAll])

  // Real-time: auto-refresh when key data changes
  useRealtimeSubscription(`mgr-overview-${managerId}`, [
    { table: 'units', ...(ownerId ? { filter: `apartmentowner_id=eq.${ownerId}` } : {}), onChanged: loadAll },
    { table: 'maintenance', ...(ownerId ? { filter: `apartmentowner_id=eq.${ownerId}` } : {}), onChanged: loadAll },
    { table: 'payments', ...(ownerId ? { filter: `apartmentowner_id=eq.${ownerId}` } : {}), onChanged: loadAll },
    { table: 'apartment_managers', filter: `id=eq.${managerId}`, onChanged: loadAll },
  ])

  const cardClass = `rounded-xl p-6 border ${
    isDark ? 'bg-navy-card border-[#1E293B]' : 'bg-white border-gray-200 shadow-sm'
  }`

  const statCards = [
    { label: 'Active Tenants', value: stats.activeTenants, icon: Users, color: 'text-emerald-400', bg: 'bg-emerald-500/15' },
    { label: 'Pending Maintenance Request', value: stats.pendingMaintenance, icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-500/15' },
    { label: 'Total Paid Tenants', value: stats.paidTenants, icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-500/15' },
    { label: 'Total Unpaid Tenants', value: stats.unpaidTenants, icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/15' },
  ]

  // Build unified history from maintenance + payments
  const historyItems: HistoryItem[] = [
    ...recentRequests.map((m) => ({
      id: m.id,
      type: 'maintenance' as const,
      description: `${m.tenant_name || 'Tenant'} submitted a request`,
      detail: m.title,
      date: m.created_at,
      badge: m.status.replace('_', ' '),
      badgeColor: m.status === 'resolved' || m.status === 'closed'
        ? 'bg-emerald-500/15 text-emerald-400'
        : m.status === 'in_progress'
        ? 'bg-blue-500/15 text-blue-400'
        : 'bg-yellow-500/15 text-yellow-400',
      branch: m.apartment_name || undefined,
      photo_url: m.photo_url ?? null,
    })),
    ...payments.map((p) => ({
      id: p.id,
      type: 'payment' as const,
      description: `${p.tenant_name || 'Tenant'} rent payment`,
      detail: `₱${Number(p.amount).toLocaleString()}`,
      date: p.created_at,
      badge: p.status,
      badgeColor: p.status === 'paid'
        ? 'bg-emerald-500/15 text-emerald-400'
        : p.status === 'overdue'
        ? 'bg-red-500/15 text-red-400'
        : 'bg-yellow-500/15 text-yellow-400',
      branch: p.apartment_name || undefined,
      extra: {
        ...(p.payment_mode ? { 'Payment Mode': p.payment_mode } : {}),
        ...(p.period_from && p.period_to ? { 'Period': `${new Date(p.period_from).toLocaleDateString()} — ${new Date(p.period_to).toLocaleDateString()}` } : {}),
      },
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  const totalPages = Math.max(1, Math.ceil(historyItems.length / pageSize))
  const paginatedHistory = historyItems.slice((page - 1) * pageSize, page * pageSize)

  useEffect(() => {
    setPage(1)
  }, [recentRequests.length, payments.length])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  return (
    <div className="gap-6 animate-fade-up flex flex-col flex-1 min-h-0">
      {/* Realtime Ticker */}
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
                  const tickets = recentRequests
                    .filter(m => m.status === 'pending' || m.status === 'in_progress')
                    .map(m => `🔧 ${m.tenant_name || 'Tenant'}: ${m.title} (${m.status.replace('_', ' ')})`)
                  return tickets.length > 0 ? tickets.join('     •     ') : 'No active maintenance requests'
                })()}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Header */}
      <div>
        <h2 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Hello, {managerName?.split(' ')[0] || 'Manager'}!</h2>
        <div className={`mt-2 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
          {apartmentBranch && (
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">{apartmentBranch}</span>
            </div>
          )}
          {apartmentAddress && (
            <div className="flex items-center gap-2 mt-1">
              <MapPin className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">{apartmentAddress}</span>
            </div>
          )}
          {!apartmentBranch && !apartmentAddress && (
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">-</span>
            </div>
          )}
        </div>
      </div>

      {loading && (
        <div className="space-y-4">
          <CardsSkeleton count={4} />
          <TableSkeleton rows={4} />
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => {
          const Icon = stat.icon
          return (
            <div key={stat.label} className={cardClass}>
              <div className="flex items-start justify-between">
                <div>
                  <p className={`text-base ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{stat.label}</p>
                  <p className={`text-4xl font-bold mt-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>{stat.value}</p>
                </div>
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${stat.bg}`}>
                  <Icon className={`w-5 h-5 ${stat.color}`} />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Recent Histories + Calendar — equal halves */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 flex-1 min-h-0">
        {/* Left: Recent Histories */}
        <div className={`${cardClass} flex flex-col min-h-0`}>
          <div className="flex items-center gap-2 mb-3">
            <Clock className={`w-5 h-5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
            <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Recent Histories</h3>
          </div>

          {historyItems.length === 0 && !loading && (
            <p className={`py-8 text-center text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
              No activity yet
            </p>
          )}

          <div className="space-y-2 overflow-y-auto flex-1 min-h-0 max-h-[480px]">
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
                      {item.branch}
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
          deadlines={payments
            .filter((p) => p.period_to && p.tenant_name && p.tenant_name !== '—')
            .map((p) => ({
              tenantName: p.tenant_name || 'Tenant',
              unitName: p.apartment_name || 'Unit',
              dueDate: p.period_to!,
              status: p.status,
            }))}
        />
      </div>

      {/* History Detail Modal */}
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
                  <p className={isDark ? 'text-white' : 'text-gray-900'}>{selectedHistoryItem.branch}</p>
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
