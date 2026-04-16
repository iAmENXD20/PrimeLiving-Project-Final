import { useState, useEffect } from 'react'
import { Sun, Moon, User, Menu, Clock, RefreshCw } from 'lucide-react'
import { useTheme } from '../../context/ThemeContext'

interface OwnerTopBarProps {
  onMenuToggle: () => void
  ownerName?: string
  onRefresh?: () => void
}

export default function OwnerTopBar({ onMenuToggle, ownerName, onRefresh }: OwnerTopBarProps) {
  const { isDark, toggleTheme } = useTheme()
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

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
        <div className={`flex items-center gap-1.5 text-xs font-medium tabular-nums ${
          isDark ? 'text-gray-400' : 'text-gray-500'
        }`}>
          <Clock className="w-3.5 h-3.5" />
          <span>{now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
          <span className="mx-0.5">·</span>
          <span>{now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
        </div>
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
        {onRefresh && (
          <button
            onClick={onRefresh}
            title="Refresh data"
            className={`p-2 rounded-lg transition-colors ${
              isDark ? 'text-gray-400 hover:bg-white/10 hover:text-white' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
            }`}
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        )}
      </div>
    </header>
  )
}
