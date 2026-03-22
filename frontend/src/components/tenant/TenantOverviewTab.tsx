import { useEffect, useState } from 'react'
import { Wrench, PhilippinePeso, CheckCircle2, AlertTriangle, MapPin, Building2 } from 'lucide-react'
import { useTheme } from '../../context/ThemeContext'
import {
  getTenantDashboardStats,
  getTenantApartmentInfo,
  getTenantMaintenanceRequests,
  type TenantMaintenanceRequest,
} from '../../lib/tenantApi'
import { getClientApartmentName, getOwnerApartmentAddress } from '../../lib/ownerApi'
import { CardsSkeleton, TableSkeleton } from '@/components/ui/skeleton'
import TablePagination from '@/components/ui/table-pagination'

interface TenantOverviewTabProps {
  tenantId: string
  apartmentId: string | null
  tenantName?: string
  clientId?: string | null
}

export default function TenantOverviewTab({ tenantId, apartmentId, tenantName, clientId }: TenantOverviewTabProps) {
  const { isDark } = useTheme()
  const [stats, setStats] = useState({ pendingMaintenance: 0, resolvedMaintenance: 0, totalPaid: 0, pendingPayments: 0 })
  const [apartmentInfo, setApartmentInfo] = useState<{ name: string; address: string; monthly_rent: number; apartmentowner_id: string } | null>(null)
  const [apartmentAddress, setApartmentAddress] = useState<string | null>(null)
  const [recentMaintenance, setRecentMaintenance] = useState<TenantMaintenanceRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const pageSize = 10

  useEffect(() => {
    async function load() {
      try {
        const [s, requests] = await Promise.all([
          getTenantDashboardStats(tenantId, apartmentId),
          getTenantMaintenanceRequests(tenantId),
        ])
        setStats(s)
        setRecentMaintenance(requests)

        if (apartmentId) {
          const info = await getTenantApartmentInfo(apartmentId)
          setApartmentInfo(info)
          const fallbackClientId = info?.apartmentowner_id || clientId || null
          const [fallbackAddress, fallbackApartmentName] = fallbackClientId
            ? await Promise.all([
                getOwnerApartmentAddress(fallbackClientId),
                getClientApartmentName(fallbackClientId),
              ])
            : [null, null]
          setApartmentAddress(fallbackAddress || info?.address || info?.name || fallbackApartmentName || null)
        } else if (clientId) {
          const [fallbackAddress, fallbackApartmentName] = await Promise.all([
            getOwnerApartmentAddress(clientId),
            getClientApartmentName(clientId),
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
  }, [tenantId, apartmentId, clientId])

  const cardClass = `rounded-xl p-6 border ${
    isDark ? 'bg-navy-card border-[#1E293B]' : 'bg-white border-gray-200 shadow-sm'
  }`

  const statCards = [
    { label: 'Pending Maintenance Request', value: stats.pendingMaintenance, icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-500/15' },
    { label: 'Resolved Requests', value: stats.resolvedMaintenance, icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/15' },
    { label: 'Pending Payments', value: stats.pendingPayments, icon: PhilippinePeso, color: 'text-red-400', bg: 'bg-red-500/15' },
  ]
  const totalPages = Math.max(1, Math.ceil(recentMaintenance.length / pageSize))
  const paginatedMaintenance = recentMaintenance.slice((page - 1) * pageSize, page * pageSize)

  useEffect(() => {
    setPage(1)
  }, [recentMaintenance.length])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const priorityColor = (p: string) => {
    switch (p) {
      case 'urgent': return 'bg-red-500/15 text-red-400'
      case 'high': return 'bg-orange-500/15 text-orange-400'
      case 'medium': return 'bg-yellow-500/15 text-yellow-400'
      default: return 'bg-green-500/15 text-green-400'
    }
  }

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

      {/* Recent Maintenance Requests */}
      <div className={`${cardClass} flex-1 flex flex-col min-h-0`}>
        <h3 className={`text-xl font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
          Recent Maintenance Requests
        </h3>
        <div className="overflow-auto flex-1 min-h-0 flex flex-col">
          {recentMaintenance.length === 0 && !loading ? (
            <div className={`flex-1 flex items-center justify-center ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
              No maintenance requests yet
            </div>
          ) : (
          <table className="w-full text-base">
            <thead>
              <tr className={`border-b ${isDark ? 'border-[#1E293B]' : 'border-gray-200'}`}>
                {['Subject', 'Priority', 'Status', 'Date'].map((h) => (
                  <th key={h} className={`text-left py-3.5 px-4 font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginatedMaintenance.map((req) => (
                <tr
                  key={req.id}
                  className={`border-b last:border-0 transition-colors ${
                    isDark ? 'border-[#1E293B] hover:bg-white/[0.02]' : 'border-gray-100 hover:bg-gray-50'
                  }`}
                >
                  <td className={`py-3.5 px-4 font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {req.title}
                  </td>
                  <td className="py-3.5 px-4">
                    <span className={`inline-block px-2.5 py-0.5 text-xs font-medium rounded-full ${priorityColor(req.priority)}`}>
                      {req.priority}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`inline-block px-2.5 py-0.5 text-xs font-medium rounded-full ${
                        req.status === 'resolved' || req.status === 'closed'
                          ? 'bg-emerald-500/15 text-emerald-400'
                          : req.status === 'in_progress'
                          ? 'bg-blue-500/15 text-blue-400'
                          : 'bg-yellow-500/15 text-yellow-400'
                      }`}
                    >
                      {req.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className={`py-3.5 px-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    {new Date(req.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          )}
        </div>

        {!loading && (
          <TablePagination
            currentPage={page}
            totalPages={totalPages}
            totalItems={recentMaintenance.length}
            pageSize={pageSize}
            onPageChange={setPage}
            isDark={isDark}
          />
        )}
      </div>
    </div>
  )
}
