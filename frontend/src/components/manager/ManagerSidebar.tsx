import { LayoutDashboard, Wrench, Building2, PhilippinePeso, FileText, Bell, Settings, LogOut, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../../context/ThemeContext'
import { supabase } from '../../lib/supabase'

interface ManagerSidebarProps {
  activeTab: string
  onTabChange: (tab: string) => void
  isOpen: boolean
  onClose: () => void
  managerName?: string
  pendingMaintenanceCount?: number
  notificationCount?: number
}

const navItems = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'manage-apartment', label: 'Manage Apartment', icon: Building2 },
  { id: 'payments', label: 'Payment History', icon: PhilippinePeso },
  { id: 'maintenance', label: 'Maintenance Request', icon: Wrench },
  { id: 'documents', label: 'Documents', icon: FileText },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'settings', label: 'Account Settings', icon: Settings },
]

export default function ManagerSidebar({ activeTab, onTabChange, isOpen, onClose, managerName, pendingMaintenanceCount = 0, notificationCount = 0 }: ManagerSidebarProps) {
  const { isDark } = useTheme()
  const navigate = useNavigate()
  const unreadCount = Number.isFinite(notificationCount) ? Math.max(0, Math.floor(notificationCount)) : 0

  const initials = managerName
    ? managerName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : ''

  const handleLogout = async () => {
    await supabase.auth.signOut({ scope: 'local' })
    navigate('/login')
  }

  return (
    <aside
      className={`fixed left-0 top-0 h-screen w-64 lg:w-64 flex flex-col z-30 border-r transition-transform duration-300 ${
        isDark
          ? 'bg-[#0A1628] border-[#1E293B]'
          : 'bg-white border-gray-200'
      } ${isOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}
    >
      {/* Profile + Close button */}
      <div className="flex items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center">
            <span className="text-sm font-bold text-white leading-none">{initials}</span>
          </div>
          {managerName && (
            <span className={`text-base font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {managerName}
            </span>
          )}
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
          const showNotificationBadge = item.id === 'notifications' && unreadCount > 0
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`w-full flex items-center justify-between gap-3 px-3 py-3 rounded-lg text-base font-medium transition-all duration-200 ${
                isActive
                  ? isDark
                    ? 'bg-primary/15 text-primary'
                    : 'bg-primary/10 text-primary-700'
                  : isDark
                  ? 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative">
                  <Icon className="w-[18px] h-[18px]" />
                  {showNotificationBadge && (
                    <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </div>
                <span className="truncate">{item.label}</span>
              </div>
              {item.id === 'maintenance' && pendingMaintenanceCount > 0 && (
                <span className="ml-auto bg-red-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] flex items-center justify-center rounded-full px-1">
                  {pendingMaintenanceCount}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      {/* Logout */}
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
