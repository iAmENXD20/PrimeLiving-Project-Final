import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Building2, Eye, EyeOff, Sun, Moon, CheckCircle2, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import DatePicker from '@/components/ui/DatePicker'
import { useTheme } from '@/context/ThemeContext'
import api from '@/lib/apiClient'

const setupSchema = z.object({
  first_name: z.string().min(1, 'First name is required').max(50),
  last_name: z.string().max(50).optional(),
  email: z.string().email('Please enter a valid email address'),
  phone: z.string().regex(/^9\d{9}$/, 'Must be 10 digits starting with 9').optional().or(z.literal('')),
  sex: z.enum(['Male', 'Female'], { required_error: 'Please select your sex' }),
  birthdate: z.string().min(1, 'Birthdate is required'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[a-zA-Z]/, 'Must contain at least one letter')
    .regex(/[0-9]/, 'Must contain at least one number')
    .regex(/[^a-zA-Z0-9]/, 'Must contain at least one special character'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})

type SetupForm = z.infer<typeof setupSchema>

export default function SetupPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [success, setSuccess] = useState(false)
  const [checking, setChecking] = useState(true)
  const { isDark, toggleTheme } = useTheme()
  const navigate = useNavigate()

  // If owner already exists, redirect to login (setup is one-time only)
  useEffect(() => {
    api.get<{ isSetup: boolean }>('/auth/check-setup')
      .then((res) => {
        if (res.isSetup) {
          navigate('/login', { replace: true })
        } else {
          setChecking(false)
        }
      })
      .catch(() => setChecking(false))
  }, [navigate])

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<SetupForm>({
    resolver: zodResolver(setupSchema),
    mode: 'onChange',
    reValidateMode: 'onChange',
  })

  const birthdateValue = watch('birthdate', '')
  const sexValue = watch('sex', '' as any)

  const [sexOpen, setSexOpen] = useState(false)
  const sexRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (sexRef.current && !sexRef.current.contains(e.target as Node)) setSexOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const onSubmit = async (data: SetupForm) => {
    try {
      await api.post('/auth/setup', {
        first_name: data.first_name.trim(),
        last_name: (data.last_name || '').trim(),
        email: data.email.trim().toLowerCase(),
        phone: data.phone?.trim() || null,
        sex: data.sex,
        birthdate: data.birthdate,
        password: data.password,
      })

      setSuccess(true)
      toast.success('Account created successfully!')

      setTimeout(() => {
        navigate('/login')
      }, 3000)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Setup failed. Please try again.')
    }
  }

  // Success screen
  if (checking) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-[#0A1628]' : 'bg-gray-50'}`}>
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (success) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-dark text-white' : 'bg-gray-50 text-gray-900'}`}>
        <div className="text-center max-w-md px-6">
          <div className="w-16 h-16 bg-green-500/15 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-8 h-8 text-green-400" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Account Created!</h2>
          <p className={`${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            Your owner account has been set up successfully. Redirecting you to login...
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={`min-h-screen flex ${isDark ? 'bg-dark' : 'bg-gray-50'}`}>
      {/* Left side - Branding (same as LoginPage) */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <img
          src="https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=1200&h=1600&fit=crop&q=80"
          alt="Apartment building"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-dark/70" />

        <div className="relative z-10 flex flex-col items-center justify-center px-12 lg:px-16 xl:px-20 w-full">
          <div className="max-w-lg w-full">
            <h1 className="text-5xl xl:text-6xl font-extrabold text-white leading-[1.15] tracking-tight opacity-0 animate-fade-up-delay-1 whitespace-nowrap">
              Welcome to E-AMS
            </h1>
            <p className="mt-6 text-lg xl:text-xl text-gray-300 leading-relaxed opacity-0 animate-fade-up-delay-2">
              Set up your owner account to get started managing your apartment.
            </p>
          </div>
        </div>
      </div>

      {/* Right side - Setup Form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 relative overflow-y-auto">
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className={`absolute top-6 right-6 p-2 rounded-lg transition-colors duration-200 z-10 ${
            isDark
              ? 'text-gray-400 hover:text-white hover:bg-white/5'
              : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
          }`}
          aria-label="Toggle theme"
        >
          {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>

        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <div className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center">
              <Building2 className="w-5 h-5 text-white" />
            </div>
          </div>

          {/* Form header */}
          <div className="mb-8 opacity-0 animate-fade-up">
            <h2 className={`text-2xl sm:text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Create Owner Account
            </h2>
            <p className={`mt-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              Set up your administrator account to start managing your apartment
            </p>
          </div>

          {/* Setup form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 opacity-0 animate-fade-up-delay-1">
            {/* Name row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="first_name">First Name *</Label>
                <Input
                  id="first_name"
                  type="text"
                  placeholder="Juan"
                  autoComplete="given-name"
                  {...register('first_name')}
                  className={errors.first_name ? 'border-red-500/50' : ''}
                />
                {errors.first_name && (
                  <p className="text-red-400 text-xs">{errors.first_name.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name">Last Name</Label>
                <Input
                  id="last_name"
                  type="text"
                  placeholder="Dela Cruz"
                  autoComplete="family-name"
                  {...register('last_name')}
                />
              </div>
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email">Email Address *</Label>
              <Input
                id="email"
                type="email"
                placeholder="juandelacruz@gmail.com"
                autoComplete="email"
                {...register('email')}
                className={errors.email ? 'border-red-500/50' : ''}
              />
              {errors.email && (
                <p className="text-red-400 text-xs">{errors.email.message}</p>
              )}
            </div>

            {/* Phone */}
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium select-none text-gray-400">+63</span>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="9XX XXX XXXX"
                  autoComplete="tel"
                  maxLength={10}
                  {...register('phone')}
                  onInput={(e) => {
                    const input = e.currentTarget
                    input.value = input.value.replace(/\D/g, '').slice(0, 10)
                  }}
                  className={`pl-12 ${errors.phone ? 'border-red-500/50' : ''}`}
                />
              </div>
              {errors.phone && (
                <p className="text-red-400 text-xs">{errors.phone.message}</p>
              )}
            </div>

            {/* Sex & Birthdate row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="sex">Sex *</Label>
                <div className="relative" ref={sexRef}>
                  <button
                    type="button"
                    onClick={() => setSexOpen(!sexOpen)}
                    className={`w-full h-10 rounded-lg border px-3 text-sm transition-colors text-left flex items-center justify-between ${
                      isDark
                        ? 'bg-[#0F1A2E] border-white/10 text-white hover:border-white/20'
                        : 'bg-white border-gray-300 text-gray-900 hover:border-gray-400'
                    } ${errors.sex ? 'border-red-500/50' : ''}`}
                  >
                    <span className={sexValue ? '' : (isDark ? 'text-gray-500' : 'text-gray-400')}>
                      {sexValue || 'Select'}
                    </span>
                    <ChevronDown className={`w-4 h-4 transition-transform ${sexOpen ? 'rotate-180' : ''} ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
                  </button>
                  {sexOpen && (
                    <div className={`absolute z-50 mt-1 w-full rounded-lg border shadow-lg overflow-hidden ${
                      isDark ? 'bg-[#0F1A2E] border-white/10' : 'bg-white border-gray-200'
                    }`}>
                      {['Male', 'Female'].map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => {
                            setValue('sex', opt as 'Male' | 'Female', { shouldValidate: true })
                            setSexOpen(false)
                          }}
                          className={`w-full text-left px-3 py-2.5 text-sm transition-colors ${
                            sexValue === opt
                              ? isDark ? 'bg-primary/20 text-primary' : 'bg-primary/10 text-primary'
                              : isDark ? 'text-gray-200 hover:bg-white/5' : 'text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {errors.sex && (
                  <p className="text-red-400 text-xs">{errors.sex.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="birthdate">Birthdate *</Label>
                <DatePicker
                  value={birthdateValue}
                  onChange={(date) => setValue('birthdate', date, { shouldValidate: true })}
                  isDark={isDark}
                  placeholder="Select birthdate"
                />
                {errors.birthdate && (
                  <p className="text-red-400 text-xs">{errors.birthdate.message}</p>
                )}
              </div>
            </div>

            {/* Password */}
            <div className="space-y-2">
              <Label htmlFor="password">Password *</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Create a strong password"
                  autoComplete="new-password"
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
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password ? (
                <p className="text-red-400 text-xs">{errors.password.message}</p>
              ) : (
                <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                  Min 8 characters with a letter, number, and special character
                </p>
              )}
            </div>

            {/* Confirm Password */}
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password *</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirm ? 'text' : 'password'}
                  placeholder="Confirm your password"
                  autoComplete="new-password"
                  {...register('confirmPassword')}
                  className={errors.confirmPassword ? 'border-red-500/50 pr-10' : 'pr-10'}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className={`absolute right-3 top-1/2 -translate-y-1/2 transition-colors ${
                    isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="text-red-400 text-xs">{errors.confirmPassword.message}</p>
              )}
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full text-base font-semibold"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Creating Account...' : 'Create Account'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
