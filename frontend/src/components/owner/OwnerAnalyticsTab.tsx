import { Star } from 'lucide-react'
import { useEffect, useState, useCallback } from 'react'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'
import { useTheme } from '../../context/ThemeContext'
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription'
import {
  getRevenueByMonth,
  getMaintenanceRequestsByMonth,
  getOwnerUnits,
  getOwnerManagers,
  getMaintenanceSummary,
  type MaintenanceSummary,
} from '../../lib/ownerApi'
import { CardsSkeleton } from '@/components/ui/skeleton'

interface OwnerAnalyticsTabProps {
  ownerId: string
}

const PIE_COLORS = ['#059669', '#EF4444', '#22C55E']

export default function OwnerAnalyticsTab({ ownerId }: OwnerAnalyticsTabProps) {
  const { isDark } = useTheme()
  const [revenueData, setRevenueData] = useState<{ month: string; revenue: number }[]>([])
  const [maintenanceData, setMaintenanceData] = useState<{ month: string; pending: number; resolved: number }[]>([])
  const [statusData, setStatusData] = useState<{ name: string; value: number }[]>([])
  const [maintenanceSummary, setMaintenanceSummary] = useState<MaintenanceSummary | null | 'loading'>('loading')
  const [loading, setLoading] = useState(true)

  const loadAnalytics = useCallback(async () => {
    try {
      const [rev, maint, units, mgrs, summary] = await Promise.all([
        getRevenueByMonth(ownerId),
        getMaintenanceRequestsByMonth(ownerId),
        getOwnerUnits(ownerId),
        getOwnerManagers(ownerId),
        getMaintenanceSummary(ownerId).catch(() => null),
      ])
      setRevenueData(rev)
      setMaintenanceData(maint)
      setMaintenanceSummary(summary as MaintenanceSummary | null)

      const occupiedCount = units.filter((u) => u.tenant_name).length
      const availableCount = units.length - occupiedCount

      setStatusData([
        { name: 'Apartment Managers', value: mgrs.length },
        { name: 'Occupied', value: occupiedCount },
        { name: 'Vacant', value: availableCount },
      ])
    } catch (err) {
      console.error('Failed to load analytics:', err)
    } finally {
      setLoading(false)
    }
  }, [ownerId])

  useEffect(() => { loadAnalytics() }, [ownerId])

  // Real-time: auto-refresh when key data changes
  useRealtimeSubscription(`owner-analytics-${ownerId}`, [
    { table: 'units', filter: `apartmentowner_id=eq.${ownerId}`, onChanged: () => loadAnalytics() },
    { table: 'payments', filter: `apartmentowner_id=eq.${ownerId}`, onChanged: () => loadAnalytics() },
    { table: 'maintenance', filter: `apartmentowner_id=eq.${ownerId}`, onChanged: () => loadAnalytics() },
    { table: 'apartment_managers', filter: `apartmentowner_id=eq.${ownerId}`, onChanged: () => loadAnalytics() },
  ])

  const cardClass = `rounded-xl p-6 border ${
    isDark ? 'bg-navy-card border-[#1E293B]' : 'bg-white border-gray-200 shadow-sm'
  }`

  const headingClass = `text-xl font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`

  const tooltipStyle = {
    backgroundColor: isDark ? '#111D32' : '#fff',
    border: `1px solid ${isDark ? '#1E293B' : '#e5e7eb'}`,
    borderRadius: 8,
    color: isDark ? '#fff' : '#1e293b',
  }

  return (
    <div className="space-y-6 animate-fade-up">
      <div>
        <h2 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Analytics</h2>
        <p className={`text-base mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          Revenue trends, maintenance insights, and property distribution
        </p>
      </div>

      {loading && (
        <CardsSkeleton count={3} />
      )}

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Line Chart */}
        <div className={cardClass}>
          <h3 className={headingClass}>Revenue Over Time</h3>
          {revenueData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#1E293B' : '#e5e7eb'} vertical={false} />
                <XAxis dataKey="month" tick={{ fill: isDark ? '#94a3b8' : '#6b7280', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: isDark ? '#94a3b8' : '#6b7280', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} formatter={(value: number | undefined) => [`₱${(value ?? 0).toLocaleString()}`, 'Revenue']} />
                <Line type="monotone" dataKey="revenue" stroke="#059669" strokeWidth={2} dot={{ fill: '#059669', r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className={`text-center py-8 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>No revenue data yet</p>
          )}
        </div>

        {/* Property Distribution Pie Chart */}
        <div className={cardClass}>
          <h3 className={headingClass}>Property Distribution</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={statusData}
                cx="50%"
                cy="50%"
                innerRadius={0}
                outerRadius={90}
                paddingAngle={2}
                dataKey="value"
                label={({ name, value }) => `${name}: ${value}`}
              >
                {statusData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
              <Legend
                wrapperStyle={{ color: isDark ? '#94a3b8' : '#6b7280' }}
                formatter={(value: string) => <span style={{ marginRight: 16 }}>{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Maintenance Requests Bar Chart (full width) */}
      <div className={cardClass}>
        <h3 className={headingClass}>Maintenance Requests Trend</h3>
        {maintenanceData.length > 0 ? (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={maintenanceData} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#1E293B' : '#e5e7eb'} vertical={false} />
              <XAxis dataKey="month" tick={{ fill: isDark ? '#94a3b8' : '#6b7280', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: isDark ? '#94a3b8' : '#6b7280', fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ color: isDark ? '#94a3b8' : '#6b7280' }} />
              <Bar dataKey="pending" fill="#EF4444" radius={[4, 4, 0, 0]} name="Pending" />
              <Bar dataKey="resolved" fill="#22C55E" radius={[4, 4, 0, 0]} name="Resolved" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className={`text-center py-8 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>No maintenance data yet</p>
        )}
      </div>

      {/* ── Maintenance Analytics Section ── */}
      {maintenanceSummary === 'loading' ? null : maintenanceSummary ? (
        <>
          {/* Status + Rating summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Total Requests', value: maintenanceSummary.total, color: isDark ? 'text-white' : 'text-gray-900' },
              { label: 'Pending', value: maintenanceSummary.statusBreakdown.pending, color: 'text-red-400' },
              { label: 'In Progress', value: maintenanceSummary.statusBreakdown.in_progress, color: 'text-yellow-400' },
              { label: 'Closed', value: maintenanceSummary.statusBreakdown.closed, color: 'text-emerald-400' },
            ].map((item) => (
              <div key={item.label} className={`${cardClass} flex flex-col items-center justify-center text-center gap-1 py-5`}>
                <p className={`text-3xl font-bold ${item.color}`}>{item.value}</p>
                <p className={`text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{item.label}</p>
              </div>
            ))}
          </div>

          {/* Ratings + Category row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Average Ratings */}
            <div className={cardClass}>
              <h3 className={headingClass}>Average Ratings</h3>
              {maintenanceSummary.totalReviewed === 0 ? (
                <p className={`text-center py-6 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>No reviews submitted yet</p>
              ) : (
                <div className="space-y-5">
                  <div>
                    <p className={`text-xs font-medium mb-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Repairman Rating</p>
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            className={`w-6 h-6 ${s <= Math.round(maintenanceSummary.avgRepairmanRating ?? 0) ? 'fill-yellow-400 text-yellow-400' : isDark ? 'text-gray-600' : 'text-gray-300'}`}
                          />
                        ))}
                      </div>
                      <span className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {maintenanceSummary.avgRepairmanRating ?? '—'}
                      </span>
                      <span className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>/ 5</span>
                    </div>
                  </div>
                  <div>
                    <p className={`text-xs font-medium mb-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Work Done Rating</p>
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            className={`w-6 h-6 ${s <= Math.round(maintenanceSummary.avgServiceRating ?? 0) ? 'fill-yellow-400 text-yellow-400' : isDark ? 'text-gray-600' : 'text-gray-300'}`}
                          />
                        ))}
                      </div>
                      <span className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {maintenanceSummary.avgServiceRating ?? '—'}
                      </span>
                      <span className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>/ 5</span>
                    </div>
                  </div>
                  <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                    Based on {maintenanceSummary.totalReviewed} reviewed {maintenanceSummary.totalReviewed === 1 ? 'request' : 'requests'}
                  </p>
                </div>
              )}
            </div>

            {/* Category Breakdown Bar Chart */}
            <div className={cardClass}>
              <h3 className={headingClass}>Requests by Category</h3>
              {maintenanceSummary.categoryBreakdown.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={maintenanceSummary.categoryBreakdown} layout="vertical" margin={{ left: 16, right: 24 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#1E293B' : '#e5e7eb'} horizontal={false} />
                    <XAxis type="number" tick={{ fill: isDark ? '#94a3b8' : '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" tick={{ fill: isDark ? '#94a3b8' : '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} width={80} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} name="Requests" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className={`text-center py-8 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>No category data yet</p>
              )}
            </div>
          </div>
        </>
      ) : (
        /* null = loaded but API failed or no data */
        <div className={cardClass}>
          <h3 className={headingClass}>Maintenance Analytics</h3>
          <p className={`text-center py-8 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>No maintenance data available</p>
        </div>
      )}
    </div>
  )
}
