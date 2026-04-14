import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Wrench, PhilippinePeso, CheckCircle2, AlertTriangle, MapPin, Building2, Clock, Eye, X } from 'lucide-react'
import { useTheme } from '../../context/ThemeContext'
import {
  getTenantDashboardStats,
  getTenantApartmentInfo,
  getTenantMaintenanceRequests,
  getTenantPayments,
  type TenantMaintenanceRequest,
  type TenantPayment,
} from '../../lib/tenantApi'
import { getOwnerApartmentName, getOwnerApartmentAddress } from '../../lib/ownerApi'
import { CardsSkeleton, TableSkeleton } from '@/components/ui/skeleton'
import TablePagination from '@/components/ui/table-pagination'
import CalendarWidget from '../owner/CalendarWidget'

interface TenantOverviewTabProps {
  tenantId: string
  apartmentId: string | null
  tenantName?: string
  ownerId?: string | null
}

type HistoryItem = { id: string; type: 'maintenance' | 'payment'; description: string; detail: string; date: string; badge: string; badgeColor: string; extra?: Record<string, string>; photo_url?: string | null }

export default function TenantOverviewTab({ tenantId, apartmentId, tenantName, ownerId }: TenantOverviewTabProps) {
  const { isDark } = useTheme()
  const [stats, setStats] = useState({ pendingMaintenance: 0, resolvedMaintenance: 0, totalPaid: 0, pendingPayments: 0 })
  const [apartmentInfo, setApartmentInfo] = useState<{ name: string; address: string; monthly_rent: number; apartmentowner_id: string } | null>(null)
  const [apartmentAddress, setApartmentAddress] = useState<string | null>(null)
  const [recentMaintenance, setRecentMaintenance] = useState<TenantMaintenanceRequest[]>([])
  const [payments, setPayments] = useState<TenantPayment[]>([])
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<HistoryItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const pageSize = 10

  useEffect(() => {
    async function load() {
      try {
        const [s, requests, paymentData] = await Promise.all([
          getTenantDashboardStats(tenantId, apartmentId),
          getTenantMaintenanceRequests(tenantId),
          getTenantPayments(tenantId),
        ])
        setStats(s)
        setRecentMaintenance(requests)
        setPayments(paymentData)

        if (apartmentId) {
          const info = await getTenantApartmentInfo(apartmentId)
          setApartmentInfo(info)
          const fallbackClientId = info?.apartmentowner_id || ownerId || null
          const [fallbackAddress, fallbackApartmentName] = fallbackClientId
            ? await Promise.all([
                getOwnerApartmentAddress(fallbackClientId),
                getOwnerApartmentName(fallbackClientId),
              ])
            : [null, null]
          setApartmentAddress(fallbackAddress || info?.address || info?.name || fallbackApartmentName || null)
        } else if (ownerId) {
          const [fallbackAddress, fallbackApartmentName] = await Promise.all([
            getOwnerApartmentAddress(ownerId),
            getOwnerApartmentName(ownerId),
          ])  
          setApartmentAddress(fallbackAddress || fallbackApartmentName || null)
        }
      } catch (err) {
        console.error('Failed to load tenant overview:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [tenantId, apartmentId, ownerId])

  const cardClass = `rounded-xl p-6 border ${
    isDark ? 'bg-navy-card border-[#1E293B]' : 'bg-white border-gray-200 shadow-sm'
  }`

  const statCards = [
    { label: 'Pending Maintenance Request', value: stats.pendingMaintenance, icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-500/15' },
    { label: 'Resolved Requests', value: stats.resolvedMaintenance, icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/15' },
    { label: 'Pending Payments', value: stats.pendingPayments, icon: PhilippinePeso, color: 'text-red-400', bg: 'bg-red-500/15' },
  ]

  // Build unified history from maintenance + payments
  const historyItems: HistoryItem[] = [
    ...recentMaintenance.map((m) => ({
      id: m.id,
      type: 'maintenance' as const,
      description: `${tenantName || 'You'} submitted a request`,
      detail: m.title,
      date: m.created_at,
      badge: m.status.replace('_', ' '),
      badgeColor: m.status === 'resolved' || m.status === 'closed'
        ? 'bg-emerald-500/15 text-emerald-400'
        : m.status === 'in_progress'
        ? 'bg-blue-500/15 text-blue-400'
        : 'bg-yellow-500/15 text-yellow-400',
      photo_url: m.photo_url ?? null,
    })),
    ...payments.map((p) => ({
      id: p.id,
      type: 'payment' as const,
      description: `${tenantName || 'You'} rent payment`,
      detail: `₱${Number(p.amount).toLocaleString()}`,
      date: p.created_at,
      badge: p.status,
      badgeColor: p.status === 'paid'
        ? 'bg-emerald-500/15 text-emerald-400'
        : p.status === 'overdue'
        ? 'bg-red-500/15 text-red-400'
        : 'bg-yellow-500/15 text-yellow-400',
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
  }, [recentMaintenance.length, payments.length])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  return (
    <div className="gap-6 animate-fade-up flex flex-col flex-1 min-h-0">
      <div>
        <h2 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Hello, {tenantName?.split(' ')[0] || 'Tenant'}!</h2>
        <div className={`flex items-center gap-2 mt-2 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
          <MapPin className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">{apartmentAddress || '-'}</span>
        </div>
      </div>

      {loading && (
        <div className="space-y-4">
          <CardsSkeleton count={3} />
          <TableSkeleton rows={4} />
        </div>
      )}

      {/* Apartment Info */}
      {apartmentInfo && (
        <div className={cardClass}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/15 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {apartmentInfo.name}
              </h3>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                Monthly Rent: ₱{Number(apartmentInfo.monthly_rent).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {statCards.map((s) => {
          const Icon = s.icon
          return (
            <div key={s.label} className={cardClass}>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg ${s.bg} flex items-center justify-center`}>
                  <Icon className={`w-5 h-5 ${s.color}`} />
                </div>
                <div>
                  <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{s.label}</p>
                  <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{s.value}</p>
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
            .filter((p) => p.period_to)
            .map((p) => ({
              tenantName: tenantName || 'You',
              unitName: apartmentInfo?.name || 'Unit',
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
