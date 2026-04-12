import { useEffect, useState } from 'react'
import { Users, PhilippinePeso, Wrench, Building2, MapPin, UserCog, CreditCard, Clock } from 'lucide-react'
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

  const cardClass = `rounded-xl p-6 border ${
    isDark ? 'bg-navy-card border-[#1E293B]' : 'bg-white border-gray-300'
  }`

  const selectedPeriodLabel = selectedMonth === 0
    ? 'All Time'
    : `${monthOptions.find((m) => m.value === selectedMonth)?.label} ${selectedYear}`

  const statCards = [
    { label: 'Total Revenue', value: stats.totalRevenue.toLocaleString(), icon: PhilippinePeso, color: 'text-primary', bg: 'bg-primary/15', subtitle: selectedPeriodLabel },
    { label: 'Paid Tenants', value: `${paidTenantCount}/${stats.activeTenants}`, icon: CreditCard, color: 'text-cyan-400', bg: 'bg-cyan-500/15', subtitle: monthOptions.find((m) => m.value === today.getMonth() + 1)?.label },
    { label: 'Pending Maintenance', value: stats.pendingMaintenance, icon: Wrench, color: 'text-red-400', bg: 'bg-red-500/15' },
    { label: 'Active Tenants', value: stats.activeTenants, icon: Users, color: 'text-emerald-400', bg: 'bg-emerald-500/15' },
    { label: 'Units', value: stats.apartments, icon: Building2, color: 'text-blue-400', bg: 'bg-blue-500/15' },
    { label: 'Apartment Managers', value: managerCount, icon: UserCog, color: 'text-violet-400', bg: 'bg-violet-500/15' },
  ]

  // Build unified history from maintenance requests + payments
  type HistoryItem = { id: string; type: 'maintenance' | 'payment'; description: string; detail: string; date: string; badge: string; badgeColor: string }
  const historyItems: HistoryItem[] = [
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
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  const totalPages = Math.max(1, Math.ceil(historyItems.length / pageSize))
  const paginatedHistory = historyItems.slice((page - 1) * pageSize, page * pageSize)

  useEffect(() => {
    setPage(1)
  }, [recentMaintenance.length, allPayments.length])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  return (
    <div className="space-y-6 animate-fade-up">
      <div>
        <h2 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Hello, {ownerName?.split(' ')[0] || 'Owner'}!</h2>
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

      {/* Revenue Period Filter */}
      <div className="flex flex-wrap items-center gap-3">
        <span className={`text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Revenue Period:</span>
        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(Number(e.target.value))}
          className={`px-3 py-1.5 rounded-lg border text-sm ${isDark ? 'bg-[#0A1628] border-[#1E293B] text-white' : 'bg-gray-50 border-gray-200 text-gray-900'}`}
        >
          {monthOptions.map((m) => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
        {selectedMonth !== 0 && (
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className={`px-3 py-1.5 rounded-lg border text-sm ${isDark ? 'bg-[#0A1628] border-[#1E293B] text-white' : 'bg-gray-50 border-gray-200 text-gray-900'}`}
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        )}
      </div>

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
                  <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{s.value}</p>
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
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 min-h-[500px]">
        {/* Left: History */}
        <div className={`${cardClass} flex flex-col`}>
          <div className="flex items-center gap-2 mb-4">
            <Clock className={`w-5 h-5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
            <h3 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>History</h3>
          </div>

          {historyItems.length === 0 && !loading && (
            <p className={`py-8 text-center text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
              No activity yet
            </p>
          )}

          <div className="space-y-3">
            {paginatedHistory.map((item) => (
              <div
                key={item.id}
                className={`flex items-start gap-3 p-3 rounded-lg transition-colors ${
                  isDark ? 'hover:bg-white/[0.02]' : 'hover:bg-gray-50'
                }`}
              >
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
          deadlines={units
            .filter((u) => u.tenant_id && u.payment_due_day)
            .map((u) => ({ unitName: u.name, dueDay: u.payment_due_day! }))}
        />
      </div>
    </div>
  )
}
