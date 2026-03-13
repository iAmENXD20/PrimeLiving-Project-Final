import { Link } from 'react-router-dom'
import { Building2 } from 'lucide-react'
import { useTheme } from '@/context/ThemeContext'

export default function Footer() {
  const { isDark } = useTheme()

  return (
    <footer className={`py-8 ${isDark ? 'border-t border-white/5' : 'border-t border-gray-200'}`}>
      <div className="max-w-[1600px] mx-auto px-6 sm:px-8 lg:px-16">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Building2 className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-bold">
              <span className={isDark ? 'text-white' : 'text-gray-900'}>Prime</span>
              <span className="text-primary">Living</span>
            </span>
          </Link>

          {/* Copyright */}
          <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
            &copy; {new Date().getFullYear()} PrimeLiving. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}
