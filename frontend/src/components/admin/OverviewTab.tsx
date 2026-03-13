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
} from 'recharts'
import { useTheme } from '../../context/ThemeContext'
import StatsOverview from './StatsOverview'
import {
  getDashboardStats,
  getUserDistribution,
  getInquiries,
  type Inquiry,
} from '../../lib/api'

const USER_COLORS = ['#22C55E', '#22D3EE', '#059669']

// ── Component ──────────────────────────────────────────────
interface OverviewTabProps {
  onTabChange?: (tab: string) => void
}

export default function OverviewTab({ onTabChange }: OverviewTabProps) {
  const { isDark } = useTheme()
  const [stats, setStats] = useState({ apartments: 0, clients: 0, tenants: 0, managers: 0, totalUsers: 0, pendingInquiries: 0 })
  const [pieData, setPieData] = useState<{ name: string; value: number }[]>([])
  const [recentInquiries, setRecentInquiries] = useState<Inquiry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const [s, pie, inq] = await Promise.all([
          getDashboardStats(),
          getUserDistribution(),
          getInquiries(),
        ])
        setStats(s)
        setPieData(pie)
        setRecentInquiries(inq.slice(0, 5))
      } catch (err) {
        console.error('Failed to load overview data:', err)
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

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Title */}
      <div>
        <h2 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
          Overview
        </h2>
        <p className={`text-base mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          System monitoring, user activity summaries, and key performance insights at a glance
        </p>
      </div>

      {loading && (
        <div className={`text-center py-8 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          Loading dashboard data...
        </div>
      )}

      {/* Stat cards */}
      <StatsOverview
        totalUsers={stats.totalUsers}
        clients={stats.clients}
        tenants={stats.tenants}
        inquiries={stats.pendingInquiries}
        onUsersClick={() => onTabChange?.('users')}
      />

      {/* User Distribution Bar Chart – full width */}
      <div className={cardClass}>
        <h3 className={headingClass}>User Distribution</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={pieData} barCategoryGap="30%">
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={isDark ? '#1E293B' : '#e5e7eb'}
              vertical={false}
            />
            <XAxis
              dataKey="name"
              tick={{ fill: isDark ? '#94a3b8' : '#6b7280', fontSize: 13 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: isDark ? '#94a3b8' : '#6b7280', fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <Tooltip
              cursor={false}
              contentStyle={{
                backgroundColor: isDark ? '#111D32' : '#fff',
                border: `1px solid ${isDark ? '#1E293B' : '#e5e7eb'}`,
                borderRadius: 8,
                color: isDark ? '#fff' : '#1e293b',
              }}
            />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {pieData.map((_, index) => (
                <Cell key={`cell-${index}`} fill={USER_COLORS[index % USER_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Recent Inquiries */}
      <div className={cardClass}>
        <h3 className={headingClass}>Recent Inquiries</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-base">
            <thead>
              <tr
                className={`border-b ${
                  isDark ? 'border-[#1E293B]' : 'border-gray-200'
                }`}
              >
                {['Name', 'Email', 'Message', 'Status', 'Date'].map((h) => (
                  <th
                    key={h}
                    className={`text-left py-3 px-4 font-medium ${
                      isDark ? 'text-gray-400' : 'text-gray-500'
                    }`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recentInquiries.map((inq) => (
                <tr
                  key={inq.id}
                  className={`border-b last:border-0 ${
                    isDark ? 'border-[#1E293B]' : 'border-gray-100'
                  }`}
                >
                  <td
                    className={`py-3 px-4 font-medium ${
                      isDark ? 'text-white' : 'text-gray-900'
                    }`}
                  >
                    {inq.name}
                  </td>
                  <td
                    className={`py-3 px-4 ${
                      isDark ? 'text-gray-300' : 'text-gray-600'
                    }`}
                  >
                    {inq.email}
                  </td>
                  <td
                    className={`py-3 px-4 max-w-xs truncate ${
                      isDark ? 'text-gray-300' : 'text-gray-600'
                    }`}
                  >
                    {inq.message}
                  </td>
                  <td className="py-3 px-4">
                    <span className="inline-block px-2.5 py-0.5 text-xs font-medium rounded-full bg-yellow-500/15 text-yellow-500">
                      {inq.status}
                    </span>
                  </td>
                  <td
                    className={`py-3 px-4 ${
                      isDark ? 'text-gray-400' : 'text-gray-500'
                    }`}
                  >
                    {new Date(inq.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
              {recentInquiries.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className={`py-8 text-center ${
                      isDark ? 'text-gray-500' : 'text-gray-400'
                    }`}
                  >
                    No recent inquiries
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
