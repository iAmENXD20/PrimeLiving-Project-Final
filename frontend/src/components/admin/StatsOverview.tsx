import { Users2, Users, UserCheck, Mail } from 'lucide-react'
import { useTheme } from '../../context/ThemeContext'

interface StatCardProps {
  label: string
  value: number | string
  icon: React.ReactNode
  iconColor: string
  onClick?: () => void
}

function StatCard({ label, value, icon, iconColor, onClick }: StatCardProps) {
  const { isDark } = useTheme()

  return (
    <div
      onClick={onClick}
      className={`rounded-xl p-6 border transition-colors ${
        isDark
          ? 'bg-navy-card border-[#1E293B] hover:border-primary/30'
          : 'bg-white border-gray-200 hover:border-primary/40 shadow-sm'
      } ${onClick ? 'cursor-pointer' : ''}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p
            className={`text-base ${
              isDark ? 'text-gray-400' : 'text-gray-500'
            }`}
          >
            {label}
          </p>
          <p
            className={`text-4xl font-bold mt-2 ${
              isDark ? 'text-white' : 'text-gray-900'
            }`}
          >
            {value}
          </p>
        </div>
        <div
          className={`w-12 h-12 rounded-lg flex items-center justify-center ${iconColor}`}
        >
          {icon}
        </div>
      </div>
    </div>
  )
}

interface StatsOverviewProps {
  totalUsers: number
  clients: number
  tenants: number
  inquiries: number
  onUsersClick?: () => void
}

export default function StatsOverview({
  totalUsers,
  clients,
  tenants,
  inquiries,
  onUsersClick,
}: StatsOverviewProps) {
  const stats = [
    {
      label: 'Active Users',
      value: totalUsers,
      icon: <Users2 className="w-5 h-5 text-primary" />,
      iconColor: 'bg-primary/15',
      onClick: onUsersClick,
    },
    {
      label: 'Apartment Owners',
      value: clients,
      icon: <Users className="w-5 h-5 text-cyan-400" />,
      iconColor: 'bg-cyan-400/15',
    },
    {
      label: 'Active Tenants',
      value: tenants,
      icon: <UserCheck className="w-5 h-5 text-green-400" />,
      iconColor: 'bg-green-400/15',
    },
    {
      label: 'Pending Inquiries',
      value: inquiries,
      icon: <Mail className="w-5 h-5 text-rose-400" />,
      iconColor: 'bg-rose-400/15',
    },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat) => (
        <StatCard key={stat.label} {...stat} />
      ))}
    </div>
  )
}
