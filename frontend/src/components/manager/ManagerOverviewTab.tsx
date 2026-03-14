import { useEffect, useState } from 'react'
import { Users, AlertTriangle, MapPin, CheckCircle, XCircle } from 'lucide-react'
import { useTheme } from '../../context/ThemeContext'
import { getManagerDashboardStats, getManagerMaintenanceRequests, getManagedApartments, type MaintenanceRequest } from '../../lib/managerApi'
import { getOwnerApartmentAddress } from '../../lib/ownerApi'

interface ManagerOverviewTabProps {
  managerId: string
  clientId: string
  managerName?: string
}

export default function ManagerOverviewTab({ managerId, clientId, managerName }: ManagerOverviewTabProps) {
  const { isDark } = useTheme()
  const [stats, setStats] = useState({ managedApartments: 0, activeTenants: 0, pendingMaintenance: 0, totalMaintenance: 0, paidTenants: 0, unpaidTenants: 0 })
  const [recentRequests, setRecentRequests] = useState<MaintenanceRequest[]>([])
  const [apartmentAddress, setApartmentAddress] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const [s, requests, apartments] = await Promise.all([
          getManagerDashboardStats(managerId, clientId),
          getManagerMaintenanceRequests(clientId),
          getManagedApartments(managerId),
        ])
        const resolvedClientId = clientId || apartments?.[0]?.client_id || ''
        const ownerAddress = resolvedClientId
          ? await getOwnerApartmentAddress(resolvedClientId)
          : null
        setStats(s)
        setRecentRequests(requests.slice(0, 5))
        setApartmentAddress(apartments?.[0]?.address || ownerAddress || null)
      } catch (err) {
        console.error('Failed to load manager overview:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [managerId, clientId])

  const cardClass = `rounded-xl p-6 border ${
    isDark ? 'bg-navy-card border-[#1E293B]' : 'bg-white border-gray-200 shadow-sm'
  }`

  const statCards = [
    { label: 'Active Tenants', value: stats.activeTenants, icon: Users, color: 'text-emerald-400', bg: 'bg-emerald-500/15' },
    { label: 'Pending Maintenance Request', value: stats.pendingMaintenance, icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-500/15' },
    { label: 'Total Paid Tenants', value: stats.paidTenants, icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-500/15' },
    { label: 'Total Unpaid Tenants', value: stats.unpaidTenants, icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/15' },
  ]

  const priorityColor: Record<string, string> = {
    low: 'bg-blue-400/15 text-blue-400',
    medium: 'bg-yellow-400/15 text-yellow-500',
    high: 'bg-orange-400/15 text-orange-400',
    urgent: 'bg-red-400/15 text-red-400',
  }

  const statusColor: Record<string, string> = {
    pending: 'bg-yellow-500/15 text-yellow-500',
    in_progress: 'bg-blue-400/15 text-blue-400',
    resolved: 'bg-green-400/15 text-green-500',
    closed: 'bg-gray-400/15 text-gray-400',
  }

  return (
    <div className="gap-6 animate-fade-up flex flex-col flex-1 min-h-0">
      {/* Header */}
      <div>
        <h2 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Hello, {managerName?.split(' ')[0] || 'Manager'}!</h2>
        <div className={`flex items-center gap-2 mt-2 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
          <MapPin className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">{apartmentAddress || '-'}</span>
        </div>
      </div>

      {loading && (
        <div className={`text-center py-8 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          Loading dashboard data...
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

      {/* Recent Maintenance Requests */}
      <div className={`${cardClass} flex-1 min-h-0 flex flex-col`}>
        <h3 className={`text-xl font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
          Recent Maintenance Requests
        </h3>
        <div className="overflow-x-auto flex-1 min-h-0 overflow-y-auto">
          <table className="w-full text-base">
            <thead>
              <tr className={`border-b ${isDark ? 'border-[#1E293B]' : 'border-gray-200'}`}>
                {['Title', 'Names', 'Apartment', 'Priority', 'Status', 'Date'].map((h) => (
                  <th key={h} className={`text-left py-3 px-4 font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recentRequests.map((req) => (
                <tr key={req.id} className={`border-b last:border-0 ${isDark ? 'border-[#1E293B]' : 'border-gray-100'}`}>
                  <td className={`py-3 px-4 font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{req.title}</td>
                  <td className={`py-3 px-4 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{req.tenant_name}</td>
                  <td className={`py-3 px-4 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{req.apartment_name}</td>
                  <td className="py-3 px-4">
                    <span className={`inline-block px-2.5 py-0.5 text-xs font-medium rounded-full ${priorityColor[req.priority] || ''}`}>
                      {req.priority}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`inline-block px-2.5 py-0.5 text-xs font-medium rounded-full ${statusColor[req.status] || ''}`}>
                      {req.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className={`py-3 px-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    {new Date(req.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
              {recentRequests.length === 0 && (
                <tr>
                  <td colSpan={6} className={`py-8 text-center ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                    No maintenance requests yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
