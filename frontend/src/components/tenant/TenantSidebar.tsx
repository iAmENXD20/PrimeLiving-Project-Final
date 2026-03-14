import { LayoutDashboard, Wrench, PhilippinePeso, Bell, Settings, LogOut, X, Building2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../../context/ThemeContext'
import { supabase } from '../../lib/supabase'

interface TenantSidebarProps {
  activeTab: string
  onTabChange: (tab: string) => void
  isOpen: boolean
  onClose: () => void
  notificationCount?: number
}

const navItems = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'maintenance', label: 'Maintenance', icon: Wrench },
  { id: 'payments', label: 'Payments', icon: PhilippinePeso },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'account', label: 'Account Settings', icon: Settings },
]

export default function TenantSidebar({ activeTab, onTabChange, isOpen, onClose, notificationCount = 0 }: TenantSidebarProps) {
  const { isDark } = useTheme()
  const navigate = useNavigate()
  const unreadCount = Number.isFinite(notificationCount) ? Math.max(0, Math.floor(notificationCount)) : 0

  const handleLogout = async () => {
    await supabase.auth.signOut({ scope: 'local' })
    navigate('/login')
  }

  return (
    <aside
      className={`fixed left-0 top-0 h-screen w-64 lg:w-56 flex flex-col z-30 border-r transition-transform duration-300 ${
        isDark
          ? 'bg-[#0A1628] border-[#1E293B]'
          : 'bg-white border-gray-200'
      } ${isOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}
    >
      {/* Logo + Close button */}
      <div className="flex items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <span className="text-lg font-bold">
            <span className="text-primary">Prime</span>
            <span className={isDark ? 'text-white' : 'text-gray-900'}>Living</span>
          </span>
        </div>
        <button
          onClick={onClose}
          className={`lg:hidden p-1.5 rounded-lg transition-colors ${
            isDark ? 'text-gray-400 hover:bg-white/10' : 'text-gray-500 hover:bg-gray-100'
          }`}
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 mt-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = activeTab === item.id
          const showBadge = item.id === 'notifications'
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg text-base font-medium transition-all duration-200 ${
                isActive
                  ? isDark
                    ? 'bg-primary/15 text-primary'
                    : 'bg-primary/10 text-primary-700'
                  : isDark
                  ? 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
            >
              <div className="relative">
                <Icon className="w-[18px] h-[18px]" />
                {showBadge && unreadCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </div>
              {item.label}
            </button>
          )
        })}
      </nav>

      {/* Logout at bottom */}
      <div className="px-3 pb-5">
        <button
          onClick={handleLogout}
          className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg text-base font-medium transition-all duration-200 ${
            isDark
              ? 'text-gray-400 hover:text-red-400 hover:bg-red-500/10'
              : 'text-gray-500 hover:text-red-500 hover:bg-red-50'
          }`}
        >
          <LogOut className="w-[18px] h-[18px]" />
          Logout
        </button>
      </div>
    </aside>
  )
}
