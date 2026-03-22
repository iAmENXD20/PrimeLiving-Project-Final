import { Sun, Moon, User, Menu } from 'lucide-react'
import { useTheme } from '../../context/ThemeContext'

interface OwnerTopBarProps {
  onMenuToggle: () => void
  ownerName?: string
}

export default function OwnerTopBar({ onMenuToggle, ownerName }: OwnerTopBarProps) {
  const { isDark, toggleTheme } = useTheme()

  return (
    <header
      className={`sticky top-0 z-20 h-14 flex items-center justify-between px-4 sm:px-6 border-b ${
        isDark
          ? 'bg-[#0A1628]/80 backdrop-blur-md border-[#1E293B]'
          : 'bg-white/80 backdrop-blur-md border-gray-200'
      }`}
    >
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuToggle}
          className={`lg:hidden p-2 rounded-lg transition-colors ${
            isDark ? 'text-gray-400 hover:bg-white/10' : 'text-gray-500 hover:bg-gray-100'
          }`}
        >
          <Menu className="w-5 h-5" />
        </button>
        <span
          className={`text-sm font-semibold tracking-widest uppercase ${
            isDark ? 'text-gray-400' : 'text-gray-500'
          }`}
        >
          Apartment Owner Dashboard
        </span>
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={toggleTheme}
          className={`p-2 rounded-lg transition-colors ${
            isDark
              ? 'text-primary hover:bg-white/5'
              : 'text-primary-600 hover:bg-gray-100'
          }`}
        >
          {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>

        <div className="flex items-center gap-2 px-3 py-1.5">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center ${
              isDark ? 'bg-[#1E293B]' : 'bg-gray-100'
            }`}
          >
            <User className={`w-4 h-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
          </div>
          <span
            className={`hidden sm:inline text-base font-medium ${
              isDark ? 'text-white' : 'text-gray-900'
            }`}
          >
            {ownerName || 'Apartment Owner'}
          </span>
        </div>
      </div>
    </header>
  )
}
