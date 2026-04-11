import { useNavigate } from 'react-router-dom'
import { ArrowRight, Building2, Sun, Moon } from 'lucide-react'
import { useTheme } from '@/context/ThemeContext'

export default function WelcomePage() {
  const navigate = useNavigate()
  const { isDark, toggleTheme } = useTheme()

  return (
    <div
      className={`min-h-screen flex flex-col items-center justify-center transition-colors relative ${
        isDark ? 'bg-[#0A1628] text-white' : 'bg-gray-50 text-gray-900'
      }`}
    >
      {/* Theme toggle */}
      <button
        onClick={toggleTheme}
        className={`absolute top-6 right-6 p-2 rounded-lg transition-colors duration-200 ${
          isDark
            ? 'text-gray-400 hover:text-white hover:bg-white/5'
            : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
        }`}
        aria-label="Toggle theme"
      >
        {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
      </button>
      <div className="flex items-center gap-4 mb-6">
        <div className="w-16 h-16 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
          <Building2 className="w-9 h-9 text-white" />
        </div>
      </div>

      <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight text-center">
        Welcome to <span className="text-primary">E-AMS</span>
      </h1>

      <p className={`mt-4 text-xl ${isDark ? 'text-gray-400' : 'text-gray-500'} text-center max-w-md`}>
        An Enhanced Apartment Management System
      </p>

      <button
        onClick={() => navigate('/login')}
        className="mt-10 flex items-center gap-2 px-8 py-3 bg-primary hover:bg-primary-700 text-white font-semibold rounded-xl transition-colors shadow-lg shadow-primary/20"
      >
        Get Started
        <ArrowRight className="w-5 h-5" />
      </button>
    </div>
  )
}
