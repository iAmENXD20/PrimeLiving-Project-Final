import { useEffect, useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend,
} from 'recharts'
import { Eye, ArrowLeft, Users, UserCheck } from 'lucide-react'
import { useTheme } from '../../context/ThemeContext'
import StatsOverview from './StatsOverview'
import {
  getDashboardStats,
  getTenantsPerApartment,
  getClientDetailStats,
} from '../../lib/api'

// ── Component ──────────────────────────────────────────────
// Color palette for bar chart — each client gets a unique color
const BAR_COLORS = [
  '#059669', // green
  '#3B82F6', // blue
  '#10B981', // emerald
  '#8B5CF6', // violet
  '#EF4444', // red
  '#06B6D4', // cyan
  '#F97316', // orange
  '#EC4899', // pink
  '#14B8A6', // teal
  '#6366F1', // indigo
]

export default function AnalyticsTab() {
  const { isDark } = useTheme()
  const [stats, setStats] = useState({ apartments: 0, clients: 0, tenants: 0, pendingInquiries: 0, totalUsers: 0 })
  const [barData, setBarData] = useState<{ id: string; name: string; fullName: string; tenants: number; units: number; apartments: number; activeUnits: number; owner: string; location: string; managers: number }[]>([])
  const [loading, setLoading] = useState(true)
  const [hoveredBar, setHoveredBar] = useState<string | null>(null)

  // Client detail view state
  const [selectedClient, setSelectedClient] = useState<{ id: string; name: string } | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailStats, setDetailStats] = useState<{
    tenants: { active: number; inactive: number; total: number }
    managers: { active: number; inactive: number; total: number }
  } | null>(null)

  const COLORS_TENANTS = ['#10B981', '#6B7280']
  const COLORS_MANAGERS = ['#06B6D4', '#6B7280']

  useEffect(() => {
    async function load() {
      try {
        const [s, bar] = await Promise.all([
          getDashboardStats(),
          getTenantsPerApartment(),
        ])
        setStats(s)
        setBarData(bar)
      } catch (err) {
        console.error('Failed to load analytics data:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const cardClass = `rounded-xl p-6 border ${
    isDark
      ? 'bg-navy-card border-[#1E293B]'
      : 'bg-white border-gray-200 shadow-sm'
  }`

  const headingClass = `text-xl font-semibold mb-4 ${
    isDark ? 'text-white' : 'text-gray-900'
  }`

  const getClientBadgeColor = (tenants: number) => {
    if (tenants > 0) return 'bg-emerald-500/15 text-emerald-400'
    return 'bg-orange-500/15 text-orange-400'
  }

  async function handleViewClient(client: { id: string; name: string }) {
    setSelectedClient(client)
    setDetailLoading(true)
    try {
      const stats = await getClientDetailStats(client.id)
      setDetailStats(stats)
    } catch (err) {
      console.error('Failed to load client details:', err)
    } finally {
      setDetailLoading(false)
    }
  }

  function handleBack() {
    setSelectedClient(null)
    setDetailStats(null)
  }

  // Client Detail View
  if (selectedClient) {
    const tenantData = detailStats
      ? [
          { name: 'Active', value: detailStats.tenants.active },
          { name: 'Inactive', value: detailStats.tenants.inactive },
        ].filter(d => d.value > 0)
      : []

    const managerData = detailStats
      ? [
          { name: 'Active', value: detailStats.managers.active },
          { name: 'Inactive', value: detailStats.managers.inactive },
        ].filter(d => d.value > 0)
      : []

    return (
      <div className="space-y-6 animate-fade-up">
        <div className="flex items-center gap-4">
          <button
            onClick={handleBack}
            className={`p-2 rounded-lg transition-colors ${
              isDark ? 'text-gray-400 hover:text-white hover:bg-white/10' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }`}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {selectedClient.name}
            </h2>
            <p className={`text-base mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              Client overview — Tenants &amp; Managers
            </p>
          </div>
        </div>

        {detailLoading && (
          <div className={`text-center py-12 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            Loading client details...
          </div>
        )}

        {!detailLoading && detailStats && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Tenants Chart */}
            <div className={`${cardClass} p-6`}>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/15 flex items-center justify-center">
                  <Users className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    Tenants
                  </h3>
                  <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    Total: {detailStats.tenants.total}
                  </p>
                </div>
              </div>

              {detailStats.tenants.total === 0 ? (
                <div className={`text-center py-12 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                  <Users className="w-10 h-10 mx-auto mb-2 opacity-40" />
                  <p>No tenants assigned</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={tenantData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={4}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {tenantData.map((_, idx) => (
                        <Cell key={idx} fill={COLORS_TENANTS[idx % COLORS_TENANTS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: isDark ? '#111D32' : '#fff',
                        border: isDark ? '1px solid #1E293B' : '1px solid #e5e7eb',
                        borderRadius: '8px',
                        color: isDark ? '#fff' : '#111',
                      }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Managers Chart */}
            <div className={`${cardClass} p-6`}>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-cyan-500/15 flex items-center justify-center">
                  <UserCheck className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    Apartment Managers
                  </h3>
                  <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    Total: {detailStats.managers.total}
                  </p>
                </div>
              </div>

              {detailStats.managers.total === 0 ? (
                <div className={`text-center py-12 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                  <UserCheck className="w-10 h-10 mx-auto mb-2 opacity-40" />
                  <p>No managers assigned</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={managerData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={4}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {managerData.map((_, idx) => (
                        <Cell key={idx} fill={COLORS_MANAGERS[idx % COLORS_MANAGERS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: isDark ? '#111D32' : '#fff',
                        border: isDark ? '1px solid #1E293B' : '1px solid #e5e7eb',
                        borderRadius: '8px',
                        color: isDark ? '#fff' : '#111',
                      }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Title */}
      <h2 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
        System Analytics
      </h2>

      {/* Stat cards */}
      <StatsOverview
        totalUsers={stats.totalUsers || 0}
        clients={stats.clients}
        tenants={stats.tenants}
        inquiries={stats.pendingInquiries}
      />

      {/* Charts + List row */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Bar chart – Tenants per Apartment */}
        <div className={`${cardClass} lg:col-span-3`}>
          <h3 className={headingClass}>Client's Summary</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={barData} barCategoryGap="20%" barGap={4}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={isDark ? '#1E293B' : '#e5e7eb'}
                vertical={false}
                fill="none"
              />
              <XAxis
                dataKey="name"
                tick={{ fill: isDark ? '#94a3b8' : '#6b7280', fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                padding={barData.length <= 1 ? { left: 30, right: 700 } : undefined}
              />
              <YAxis
                tick={{ fill: isDark ? '#94a3b8' : '#6b7280', fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                cursor={false}
                active={!!hoveredBar}
                isAnimationActive={false}
                allowEscapeViewBox={{ x: false, y: false }}
                content={({ payload }) => {
                  if (!hoveredBar || !payload?.length) return null
                  const d = payload[0].payload
                  if (d.name !== hoveredBar) return null
                  return (
                    <div
                      className={`rounded-lg border px-4 py-3 text-sm shadow-lg ${
                        isDark
                          ? 'bg-[#111D32] border-[#1E293B] text-white'
                          : 'bg-white border-gray-200 text-gray-900'
                      }`}
                    >
                      <p className="font-semibold mb-1">{d.owner}</p>
                      <p className={isDark ? 'text-gray-400' : 'text-gray-500'}>Address: <span className={isDark ? 'text-white' : 'text-gray-900'}>{d.location || '—'}</span></p>
                      <p className={isDark ? 'text-gray-400' : 'text-gray-500'}>Units: <span className={isDark ? 'text-white' : 'text-gray-900'}>{d.apartments}</span></p>
                      <p className={isDark ? 'text-gray-400' : 'text-gray-500'}>Active Units: <span className={isDark ? 'text-emerald-400' : 'text-emerald-600'}>{d.activeUnits}</span></p>
                      <p className={isDark ? 'text-gray-400' : 'text-gray-500'}>Active Tenants: <span className="text-emerald-500 font-medium">{d.tenants}</span></p>
                      <p className={isDark ? 'text-gray-400' : 'text-gray-500'}>Managers: <span className={isDark ? 'text-white' : 'text-gray-900'}>{d.managers}</span></p>
                    </div>
                  )
                }}
              />
              <Bar
                dataKey="tenants"
                name="Tenants"
                fill="#3B82F6"
                radius={[0, 0, 0, 0]}
                maxBarSize={50}
                stackId="client"
                onMouseEnter={(data: any) => setHoveredBar(data?.name)}
                onMouseLeave={() => setHoveredBar(null)}
              />
              <Bar
                dataKey="managers"
                name="Managers"
                fill="#8B5CF6"
                radius={[4, 4, 0, 0]}
                maxBarSize={50}
                stackId="client"
                onMouseEnter={(data: any) => setHoveredBar(data?.name)}
                onMouseLeave={() => setHoveredBar(null)}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Active Clients List */}
        <div className={`${cardClass} lg:col-span-2 max-h-[420px] flex flex-col`}>
          <h3 className={headingClass}>Active Clients</h3>
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {barData.map((client, idx) => (
              <div
                key={idx}
                className={`p-3 rounded-lg border flex items-center justify-between ${
                  isDark
                    ? 'bg-[#0A1628]/60 border-[#1E293B] hover:border-primary/30'
                    : 'bg-gray-50 border-gray-200 hover:border-primary/40'
                } transition-colors`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: BAR_COLORS[idx % BAR_COLORS.length] }}
                  />
                  <div className="min-w-0">
                    <p
                      className={`text-sm font-medium truncate ${
                        isDark ? 'text-white' : 'text-gray-900'
                      }`}
                    >
                      {client.fullName || client.name}
                    </p>
                    <p
                      className={`text-xs truncate ${
                        isDark ? 'text-gray-500' : 'text-gray-400'
                      }`}
                    >
                      {client.location || 'No location'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleViewClient({ id: client.id, name: client.fullName || client.name })}
                  className="flex-shrink-0 ml-2 flex items-center gap-1.5 px-3 py-1.5 bg-primary/15 text-primary hover:bg-primary/25 rounded-lg text-sm font-medium transition-colors"
                  title="View client details"
                >
                  <Eye className="w-3.5 h-3.5" />
                  View
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
