import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Building2, Eye, EyeOff, ArrowLeft, Sun, Moon, KeyRound } from 'lucide-react'
import { toast } from 'sonner'
import { useTheme } from '@/context/ThemeContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'

export default function ResetPasswordPage() {
  const { isDark, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    async function initRecoverySession() {
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))
      const type = hashParams.get('type')

      if (type !== 'recovery') {
        toast.error('Invalid reset link. Please request a new one.')
        navigate('/login', { replace: true })
        return
      }

      const { data, error } = await supabase.auth.getSession()
      if (error || !data.session) {
        toast.error('Reset link is invalid or expired. Please request a new one.')
        navigate('/login', { replace: true })
        return
      }

      setReady(true)
    }

    initRecoverySession()
  }, [navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (password.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }

    if (password !== confirmPassword) {
      toast.error('Passwords do not match')
      return
    }

    setSubmitting(true)
    const { error } = await supabase.auth.updateUser({ password })
    setSubmitting(false)

    if (error) {
      toast.error(error.message)
      return
    }

    toast.success('Password updated successfully. Please sign in.')
    await supabase.auth.signOut()
    navigate('/login', { replace: true })
  }

  if (!ready) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-dark' : 'bg-gray-50'}`}>
        <div className={`w-80 h-36 rounded-xl border p-6 ${isDark ? 'bg-navy-card border-[#1E293B]' : 'bg-white border-gray-200 shadow-sm'}`}>
          <div className={`h-4 w-40 rounded ${isDark ? 'bg-white/10' : 'bg-gray-200'} animate-pulse mb-4`} />
          <div className={`h-3 w-full rounded ${isDark ? 'bg-white/10' : 'bg-gray-200'} animate-pulse mb-2`} />
          <div className={`h-3 w-3/4 rounded ${isDark ? 'bg-white/10' : 'bg-gray-200'} animate-pulse`} />
        </div>
      </div>
    )
  }

  return (
    <div className={`min-h-screen flex ${isDark ? 'bg-dark' : 'bg-gray-50'}`}>
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <img
          src="https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=1200&h=1600&fit=crop&q=80"
          alt="Apartment building"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-dark/70" />
        <div className="relative z-10 flex flex-col items-center justify-center px-12 w-full">
          <Link to="/login" className="flex items-center gap-3 mb-10">
            <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center">
              <Building2 className="w-7 h-7 text-white" />
            </div>
          </Link>
          <h1 className="text-5xl font-extrabold text-white leading-tight">Set a new password</h1>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 relative">
        <button
          onClick={toggleTheme}
          className={`absolute top-6 right-6 p-2 rounded-lg transition-colors ${
            isDark ? 'text-gray-400 hover:text-white hover:bg-white/5' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
          }`}
          aria-label="Toggle theme"
        >
          {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>

        <div className="w-full max-w-md">
          <Link
            to="/login"
            className={`inline-flex items-center gap-1.5 text-sm mb-8 ${isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'}`}
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Sign In
          </Link>

          <div className="mb-8">
            <h2 className={`text-2xl sm:text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Reset Password
            </h2>
            <p className={`mt-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              Enter your new password below.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter new password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className={`absolute right-3 top-1/2 -translate-y-1/2 ${isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <div className="relative">
                <Input
                  id="confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  className={`absolute right-3 top-1/2 -translate-y-1/2 ${isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" size="lg" className="w-full text-base font-semibold" disabled={submitting}>
              <KeyRound className="w-4 h-4 mr-2" />
              {submitting ? 'Updating password...' : 'Update Password'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
