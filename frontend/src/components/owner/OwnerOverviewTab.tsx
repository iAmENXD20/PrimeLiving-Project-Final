import { useEffect, useState } from 'react'
import { Users, PhilippinePeso, Wrench, Building2, MapPin } from 'lucide-react'
import { useTheme } from '../../context/ThemeContext'
import {
  getOwnerDashboardStats,
  getOwnerMaintenanceRequests,
  getOwnerApartmentAddress,
  getClientApartmentName,
  type MaintenanceRequest,
} from '../../lib/ownerApi'

interface OwnerOverviewTabProps {
  clientId: string
  ownerName?: string
}

export default function OwnerOverviewTab({ clientId, ownerName }: OwnerOverviewTabProps) {
  const { isDark } = useTheme()
  const [stats, setStats] = useState({ apartments: 0, activeTenants: 0, pendingMaintenance: 0, totalRevenue: 0 })
  const [recentMaintenance, setRecentMaintenance] = useState<MaintenanceRequest[]>([])
  const [apartmentAddress, setApartmentAddress] = useState<string | null>(null)
  const [apartmentName, setApartmentName] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const today = new Date()
  const [selectedMonth, setSelectedMonth] = useState<number>(0)
  const [selectedYear, setSelectedYear] = useState(today.getFullYear())

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
  const yearOptions = Array.from({ length: 6 }, (_, index) => today.getFullYear() - 4 + index)

  useEffect(() => {
    async function load() {
      try {
        const [s, requests, addr, aptName] = await Promise.all([
          selectedMonth === 0
            ? getOwnerDashboardStats(clientId)
            : getOwnerDashboardStats(clientId, { month: selectedMonth, year: selectedYear }),
          getOwnerMaintenanceRequests(clientId),
          getOwnerApartmentAddress(clientId),
          getClientApartmentName(clientId),
        ])
        setStats(s)
        setRecentMaintenance(requests.slice(0, 5))
        setApartmentAddress(addr)
        setApartmentName(aptName)
      } catch (err) {
        console.error('Failed to load owner overview:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [clientId, selectedMonth, selectedYear])

  const cardClass = `rounded-xl p-6 border ${
    isDark ? 'bg-navy-card border-[#1E293B]' : 'bg-white border-gray-200 shadow-sm'
  }`

  const headingClass = `text-xl font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`

  const selectedPeriodLabel = selectedMonth === 0
    ? 'All Time'
    : `${monthOptions.find((m) => m.value === selectedMonth)?.label} ${selectedYear}`

  const statCards = [
    { label: 'Active Tenants', value: stats.activeTenants, icon: Users, color: 'text-emerald-400', bg: 'bg-emerald-500/15' },
    { label: 'Total Revenue', value: `₱${stats.totalRevenue.toLocaleString()}`, icon: PhilippinePeso, color: 'text-primary', bg: 'bg-primary/15', subtitle: selectedPeriodLabel },
    { label: 'Units', value: stats.apartments, icon: Building2, color: 'text-blue-400', bg: 'bg-blue-500/15' },
    { label: 'Pending Maintenance', value: stats.pendingMaintenance, icon: Wrench, color: 'text-red-400', bg: 'bg-red-500/15' },
  ]

  const priorityColor = (p: string) => {
    switch (p) {
      case 'urgent': return 'bg-red-500/15 text-red-400'
      case 'high': return 'bg-orange-500/15 text-orange-400'
      case 'medium': return 'bg-yellow-500/15 text-yellow-400'
      default: return 'bg-green-500/15 text-green-400'
    }
  }

  return (
    <div className="space-y-6 animate-fade-up">
      <div>
        <h2 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Hello, {ownerName?.split(' ')[0] || 'Owner'}!</h2>
        {apartmentName && (
          <p className={`text-base font-medium mt-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{apartmentName}</p>
        )}
        {apartmentAddress && (
          <div className={`flex items-center gap-2 mt-2 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
            <MapPin className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">{apartmentAddress}</span>
          </div>
        )}
      </div>

      {loading && (
        <div className={`text-center py-8 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          Loading dashboard data...
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <p className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Revenue period:</p>
        <select
          value={selectedMonth}
          onChange={(event) => setSelectedMonth(Number(event.target.value))}
          className={`px-3 py-2 rounded-lg border text-sm ${
            isDark
              ? 'bg-[#111D32] border-[#1E293B] text-white'
              : 'bg-white border-gray-200 text-gray-700'
          }`}
        >
          {monthOptions.map((month) => (
            <option key={month.value} value={month.value}>{month.label}</option>
          ))}
        </select>
        <select
          value={selectedYear}
          onChange={(event) => setSelectedYear(Number(event.target.value))}
          disabled={selectedMonth === 0}
          className={`px-3 py-2 rounded-lg border text-sm ${
            isDark
              ? 'bg-[#111D32] border-[#1E293B] text-white'
              : 'bg-white border-gray-200 text-gray-700'
          } ${selectedMonth === 0 ? 'opacity-60 cursor-not-allowed' : ''}`}
        >
          {yearOptions.map((year) => (
            <option key={year} value={year}>{year}</option>
          ))}
        </select>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
                  {s.subtitle && (
                    <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{s.subtitle}</p>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Recent Maintenance Inquiries */}
      <div className={`${cardClass} min-h-[calc(100vh-280px)]`}>
        <h3 className={headingClass}>Recent Maintenance Inquiries</h3>
        <div className="overflow-x-auto">
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
              {recentMaintenance.length === 0 && !loading && (
                <tr>
                  <td colSpan={4} className={`py-8 text-center ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                    No maintenance inquiries yet
                  </td>
                </tr>
              )}
              {recentMaintenance.map((req) => (
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
        </div>
      </div>
    </div>
  )
}
