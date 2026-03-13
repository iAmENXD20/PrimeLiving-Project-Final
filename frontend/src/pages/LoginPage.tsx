import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Building2, Eye, EyeOff, ArrowLeft, Sun, Moon, X, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useTheme } from '@/context/ThemeContext'
import { supabase } from '@/lib/supabase'

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

type LoginForm = z.infer<typeof loginSchema>

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [isResetting, setIsResetting] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const { isDark, toggleTheme } = useTheme()
  const navigate = useNavigate()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginForm) => {
    const { data: authData, error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    })

    if (error) {
      toast.error(error.message)
      return
    }

    toast.success('Login successful!')

    // Handle remember me
    if (rememberMe) {
      localStorage.setItem('primeliving-remember', 'true')
    } else {
      localStorage.removeItem('primeliving-remember')
      sessionStorage.setItem('primeliving-session-active', 'true')
    }

    // Route based on user role
    const role = authData.user?.user_metadata?.role
    if (role === 'owner') {
      navigate('/owner')
    } else if (role === 'manager') {
      navigate('/manager')
    } else if (role === 'tenant') {
      navigate('/tenant')
    } else {
      navigate('/admin')
    }
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!resetEmail.trim()) {
      toast.error('Please enter your email address')
      return
    }
    setIsResetting(true)
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${window.location.origin}/login`,
    })
    setIsResetting(false)
    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Password reset link sent! Check your email.')
      setShowForgotPassword(false)
      setResetEmail('')
    }
  }

  return (
    <div className={`min-h-screen flex ${isDark ? 'bg-dark' : 'bg-gray-50'}`}>
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        {/* Background Image */}
        <img
          src="https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=1200&h=1600&fit=crop&q=80"
          alt="Apartment building at night"
          className="absolute inset-0 w-full h-full object-cover"
        />
        {/* Dark overlay */}
        <div className="absolute inset-0 bg-dark/70" />

        <div className="relative z-10 flex flex-col items-center justify-center px-12 lg:px-16 xl:px-20 w-full">
          <div className="max-w-lg w-full">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-3 mb-14 opacity-0 animate-fade-up">
              <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
                <Building2 className="w-7 h-7 text-white" />
              </div>
              <span className="text-3xl font-bold">
                <span className="text-white">Prime</span>
                <span className="text-primary">Living</span>
              </span>
            </Link>

            <h1 className="text-5xl xl:text-6xl font-extrabold text-white leading-[1.15] tracking-tight opacity-0 animate-fade-up-delay-1">
              Manage Your Apartment With Ease
            </h1>
            <p className="mt-6 text-lg xl:text-xl text-gray-300 leading-relaxed opacity-0 animate-fade-up-delay-2">
              A centralized platform for apartment management, real-time notifications, and seamless task handling.
            </p>

            {/* Testimonial card */}
            <div className="mt-12 bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl px-6 py-6 opacity-0 animate-fade-up-delay-3">
              <p className="text-white/90 text-base italic leading-relaxed">
                "PrimeLiving transformed how we manage our apartment building. Communication is instant and payments are tracked effortlessly."
              </p>
              <p className="mt-4 text-primary font-semibold text-sm">
                - Jenny Ramos, Apartment Manager
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Login Form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 relative">
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

        <div className="w-full max-w-md">
          {/* Back to home (mobile) */}
          <Link
            to="/"
            className={`inline-flex items-center gap-1.5 text-sm mb-8 transition-colors duration-200 ${
              isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>

          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <div className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold">
              <span className={isDark ? 'text-white' : 'text-gray-900'}>Prime</span>
              <span className="text-primary">Living</span>
            </span>
          </div>

          {/* Form header */}
          <div className="mb-8 opacity-0 animate-fade-up">
            <h2 className={`text-2xl sm:text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Sign in to your account
            </h2>
            <p className={`mt-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              Enter your credentials to access your dashboard
            </p>
          </div>

          {/* Login form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 opacity-0 animate-fade-up-delay-1">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                {...register('email')}
                className={errors.email ? 'border-red-500/50' : ''}
              />
              {errors.email && (
                <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <button
                  type="button"
                  onClick={() => setShowForgotPassword(true)}
                  className="text-xs text-primary hover:text-primary-400 transition-colors"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  {...register('password')}
                  className={errors.password ? 'border-red-500/50 pr-10' : 'pr-10'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className={`absolute right-3 top-1/2 -translate-y-1/2 transition-colors ${
                    isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="text-red-400 text-xs mt-1">{errors.password.message}</p>
              )}
            </div>

            {/* Remember me */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="remember"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className={`w-4 h-4 rounded text-primary focus:ring-primary/30 cursor-pointer ${
                  isDark ? 'border-white/20 bg-navy-card' : 'border-gray-300 bg-white'
                }`}
              />
              <label htmlFor="remember" className={`text-sm cursor-pointer ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                Remember me
              </label>
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full text-base font-semibold"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>

          {/* Divider */}
          <div className="mt-8 text-center opacity-0 animate-fade-up-delay-2">
            <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
              Don&apos;t have an account?{' '}
              <a
                href="/#contact"
                className="text-primary hover:text-primary-400 font-medium transition-colors"
              >
                Contact us to get started
              </a>
            </p>
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotPassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop with blur */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowForgotPassword(false)}
          />

          {/* Modal */}
          <div className={`relative w-full max-w-md rounded-2xl p-6 lg:p-8 shadow-2xl ${
            isDark
              ? 'bg-navy-card border border-white/10'
              : 'bg-white border border-gray-200'
          }`}>
            {/* Close button */}
            <button
              onClick={() => setShowForgotPassword(false)}
              className={`absolute top-4 right-4 p-1.5 rounded-lg transition-colors ${
                isDark ? 'text-gray-400 hover:text-white hover:bg-white/5' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
              }`}
            >
              <X className="w-5 h-5" />
            </button>

            {/* Icon */}
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-5">
              <Mail className="w-6 h-6 text-primary" />
            </div>

            <h3 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Reset your password
            </h3>
            <p className={`mt-2 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              Enter your email address and we'll send you a link to reset your password.
            </p>

            <form onSubmit={handleResetPassword} className="mt-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reset-email">Email Address</Label>
                <Input
                  id="reset-email"
                  type="email"
                  placeholder="you@example.com"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  autoFocus
                />
              </div>

              <Button
                type="submit"
                size="lg"
                className="w-full text-base font-semibold"
                disabled={isResetting}
              >
                {isResetting ? 'Sending...' : 'Send Reset Link'}
              </Button>

              <button
                type="button"
                onClick={() => setShowForgotPassword(false)}
                className={`w-full text-center text-sm font-medium transition-colors ${
                  isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                Back to Sign In
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
