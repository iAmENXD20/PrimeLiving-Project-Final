import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Menu, X, Sun, Moon, Building2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTheme } from '@/context/ThemeContext'

const navLinks = [
  { label: 'Features', href: '#features' },
  { label: 'Benefits', href: '#benefits' },
  { label: 'Contact', href: '#contact' },
]

export default function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const { isDark, toggleTheme } = useTheme()

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? isDark
            ? 'bg-dark/95 backdrop-blur-md border-b border-white/5 shadow-lg'
            : 'bg-white/95 backdrop-blur-md border-b border-gray-200 shadow-sm'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-[1600px] mx-auto px-6 sm:px-8 lg:px-16">
        <div className="flex items-center justify-between h-16 lg:h-20">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center shadow-lg shadow-primary/20 group-hover:shadow-primary/40 transition-shadow duration-300">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold">
              <span className={isDark ? 'text-white' : 'text-gray-900'}>Prime</span>
              <span className="text-primary">Living</span>
            </span>
          </Link>

          {/* Desktop Nav Links */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className={`text-sm font-medium transition-colors duration-200 ${
                  isDark
                    ? 'text-gray-300 hover:text-white'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {link.label}
              </a>
            ))}
          </div>

          {/* Right side actions */}
          <div className="hidden md:flex items-center gap-3">
            <button
              onClick={toggleTheme}
              className={`p-2 rounded-lg transition-colors duration-200 ${
                isDark
                  ? 'text-gray-400 hover:text-white hover:bg-white/5'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
              }`}
              aria-label="Toggle theme"
            >
              {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <Link to="/login">
              <Button variant="outline" size="default">
                Log In
              </Button>
            </Link>
            <a href="#contact">
              <Button variant="default" size="default">
                Get Started
              </Button>
            </a>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className={`p-2 rounded-lg transition-colors duration-200 ${
                isDark
                  ? 'text-gray-400 hover:text-white'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
              aria-label="Toggle theme"
            >
              {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <button
              className={`p-2 ${isDark ? 'text-gray-300 hover:text-white' : 'text-gray-600 hover:text-gray-900'}`}
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {isMobileMenuOpen && (
        <div className={`md:hidden backdrop-blur-md animate-fade-in ${
          isDark
            ? 'bg-dark-100/95 border-t border-white/5'
            : 'bg-white/95 border-t border-gray-200'
        }`}>
          <div className="px-4 py-6 space-y-4">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className={`block py-2 font-medium ${
                  isDark
                    ? 'text-gray-300 hover:text-white'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {link.label}
              </a>
            ))}
            <div className={`pt-4 space-y-3 ${isDark ? 'border-t border-white/10' : 'border-t border-gray-200'}`}>
              <Link to="/login" className="block">
                <Button variant="outline" className="w-full">
                  Log In
                </Button>
              </Link>
              <a href="#contact" className="block" onClick={() => setIsMobileMenuOpen(false)}>
                <Button className="w-full">Get Started</Button>
              </a>
            </div>
          </div>
        </div>
      )}
    </nav>
  )
}
