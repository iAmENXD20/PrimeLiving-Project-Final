import { LayoutDashboard, Building2, Wrench, PhilippinePeso, FileText, Settings, LogOut, X, ClipboardList, Users } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../../context/ThemeContext'
import { supabase } from '../../lib/supabase'

interface OwnerSidebarProps {
  activeTab: string
  onTabChange: (tab: string) => void
  isOpen: boolean
  onClose: () => void
  ownerName?: string
  pendingMaintenanceCount?: number
}

const navItems = [
  { id: 'overview', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'manage-apartment', label: 'User Management', icon: Users },
  { id: 'units', label: 'Manage My Apartment', icon: Building2 },
  { id: 'maintenance', label: 'Maintenance', icon: Wrench },
  { id: 'payments', label: 'Payment History', icon: PhilippinePeso },
  { id: 'documents', label: 'Documents', icon: FileText },
  { id: 'audit-reports', label: 'Audit Reports', icon: ClipboardList },
  { id: 'account', label: 'Account Settings', icon: Settings },
]

export default function OwnerSidebar({ activeTab, onTabChange, isOpen, onClose, ownerName, pendingMaintenanceCount }: OwnerSidebarProps) {
  const { isDark } = useTheme()
  const navigate = useNavigate()

  const initials = ownerName
    ? ownerName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : ''

  const handleLogout = async () => {
    await supabase.auth.signOut({ scope: 'local' })
    navigate('/login')
  }

  return (
    <aside
      className={`fixed left-0 top-0 h-screen w-72 lg:w-64 flex flex-col z-30 border-r transition-transform duration-300 ${
        isDark
          ? 'bg-[#0A1628] border-[#1E293B]'
          : 'bg-white border-gray-200'
      } ${isOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}
    >
      {/* Logo + Close button */}
      <div className="flex items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center">
            <span className="text-sm font-bold text-white leading-none">{initials}</span>
          </div>
          {ownerName && (
            <span className={`text-base font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {ownerName}
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
              <Icon className="w-[18px] h-[18px]" />
              {item.label}
              {item.id === 'maintenance' && (pendingMaintenanceCount ?? 0) > 0 && (
                <span className="ml-auto inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[11px] font-bold rounded-full bg-red-500 text-white">
                  {pendingMaintenanceCount}
                </span>
              )}
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
