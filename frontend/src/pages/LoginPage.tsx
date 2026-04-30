import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Building2, Eye, EyeOff, Sun, Moon, X, Mail, ShieldAlert, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useTheme } from '@/context/ThemeContext'
import { supabase } from '@/lib/supabase'
import api, { ApiError } from '@/lib/apiClient'
import { getMfaPreference, sendEmailOtp, verifyEmailOtp } from '@/lib/mfaApi'

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

type LoginForm = z.infer<typeof loginSchema>

type UserRole = 'owner' | 'manager' | 'tenant'

function normalizeRole(rawRole: unknown): UserRole | null {
  if (typeof rawRole !== 'string') return null

  const normalized = rawRole.toLowerCase().trim()
  if (normalized === 'client' || normalized === 'owner') return 'owner'
  if (normalized === 'manager') return 'manager'
  if (normalized === 'tenant') return 'tenant'

  return null
}

async function resolveRoleFromProfiles(authUserId: string): Promise<UserRole | null> {
  const shouldIgnore = (error: unknown) =>
    error instanceof ApiError && (error.status === 403 || error.status === 404)

  try {
    await api.get(`/tenants/by-auth/${authUserId}`)
    return 'tenant'
  } catch (error: unknown) {
    if (!shouldIgnore(error)) throw error
  }

  try {
    await api.get(`/managers/by-auth/${authUserId}`)
    return 'manager'
  } catch (error: unknown) {
    if (!shouldIgnore(error)) throw error
  }

  try {
    await api.get(`/owners/by-auth/${authUserId}`)
    return 'owner'
  } catch (error: unknown) {
    if (!shouldIgnore(error)) throw error
  }

  return null
}

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [isResetting, setIsResetting] = useState(false)
  const [pendingAlert, setPendingAlert] = useState<string | null>(null)
  const [checkingSetup, setCheckingSetup] = useState(true)
  // TOTP 2FA challenge state
  const [totpState, setTotpState] = useState<{ factorId: string; destination: string } | null>(null)
  const [totpCode, setTotpCode] = useState('')
  const [totpVerifying, setTotpVerifying] = useState(false)
  // Email OTP 2FA state
  const [emailOtpState, setEmailOtpState] = useState<{ destination: string } | null>(null)
  const [emailOtpCode, setEmailOtpCode] = useState('')
  const [emailOtpVerifying, setEmailOtpVerifying] = useState(false)
  const [emailOtpMasked, setEmailOtpMasked] = useState('')
  const { isDark, toggleTheme } = useTheme()
  const navigate = useNavigate()

  // Block rendering until we confirm an owner exists; redirect to /setup if not
  useEffect(() => {
    api.get<{ isSetup: boolean }>('/auth/check-setup')
      .then((res) => {
        if (!res.isSetup) {
          navigate('/setup', { replace: true })
        } else {
          setCheckingSetup(false)
        }
      })
      .catch(() => {
        setCheckingSetup(false)
      })
  }, [navigate])

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    mode: 'onChange',
    reValidateMode: 'onChange',
  })

  const onSubmit = async (data: LoginForm) => {
    // Use backend login endpoint which checks for pending_verification accounts
    try {
      const loginRes = await api.post<{ user: any; session: any }>('/auth/login', {
        email: data.email,
        password: data.password,
      })

      const expectedUserId = typeof loginRes.user?.id === 'string' ? loginRes.user.id : null

      // Always clear any previous local session before applying new credentials.
      await supabase.auth.signOut({ scope: 'local' })

      const session = loginRes.session
      if (session?.access_token && session?.refresh_token) {
        const { error: setSessionError } = await supabase.auth.setSession({
          access_token: session.access_token,
          refresh_token: session.refresh_token,
        })
        if (setSessionError) throw setSessionError
      } else {
        // Fallback: establish session directly when backend payload has no tokens.
        const { error: directSignInError } = await supabase.auth.signInWithPassword({
          email: data.email,
          password: data.password,
        })
        if (directSignInError) throw directSignInError
      }

      localStorage.removeItem('app-remember')

      let { data: sessionData } = await supabase.auth.getSession()
      let activeUserId = sessionData.session?.user?.id || null

      // Ensure the active frontend session matches the authenticated backend user.
      if (expectedUserId && activeUserId && expectedUserId !== activeUserId) {
        const { data: directSignInData, error: directSignInError } = await supabase.auth.signInWithPassword({
          email: data.email,
          password: data.password,
        })

        if (directSignInError || !directSignInData.session?.user?.id) {
          throw new Error('Session mismatch detected. Please try signing in again.')
        }

        activeUserId = directSignInData.session.user.id
        sessionData = { session: directSignInData.session }
      }

      if (!sessionData.session || !activeUserId) {
        throw new Error('Unable to establish a valid login session. Please try again.')
      }

      sessionStorage.setItem('app-session-active', 'true')

      // Route using backend-resolved role to avoid stale metadata redirects.
      let role: UserRole | null = null
      try {
        const me = await api.get<{ user: { role: string } }>('/auth/me')
        role = normalizeRole(me.user?.role)
      } catch (meErr: unknown) {
        // If 403, account is not active — sign out and show message
        if (meErr instanceof ApiError && meErr.status === 403) {
          await supabase.auth.signOut()
          const msg = meErr.response?.data?.error || 'Account is not active yet'
          setPendingAlert(msg)
          return
        }

        await supabase.auth.signOut({ scope: 'local' })
        toast.error(meErr instanceof Error ? meErr.message : 'Failed to determine account role. Please try signing in again.')
        return
      }

      // Fallback to profile-based role resolution (more reliable for mixed metadata cases).
      if (!role) {
        role = await resolveRoleFromProfiles(activeUserId)
      }

      if (!role) {
        await supabase.auth.signOut({ scope: 'local' })
        toast.error('Your account role could not be determined. Please contact support.')
        return
      }

      const destination = role === 'manager' ? '/manager' : role === 'tenant' ? '/tenant' : '/owner'

      // Check if the user has TOTP enrolled and needs to complete AAL2
      const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
      if (aalData?.nextLevel === 'aal2') {
        const { data: factorsData } = await supabase.auth.mfa.listFactors()
        const totp = factorsData?.totp?.find((f) => f.status === 'verified')
        if (totp) {
          setTotpState({ factorId: totp.id, destination })
          return
        }
      }

      // Check if the user has Email OTP as their 2FA method
      const pref = await getMfaPreference().catch(() => ({ mfa_method: null }))
      if (pref.mfa_method === 'email') {
        try {
          const res = await sendEmailOtp()
          setEmailOtpMasked(res.maskedEmail)
          setEmailOtpState({ destination })
          setEmailOtpCode('')
        } catch {
          toast.error('Failed to send email OTP. Please try again.')
        }
        return
      }

      toast.success('Login successful!')
      navigate(destination)
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 403) {
        setPendingAlert(err.message)
      } else {
        toast.error(err instanceof Error ? err.message : 'Login failed')
      }
    }
  }

  const handleTotpVerify = async () => {
    if (!totpState) return
    setTotpVerifying(true)
    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({
        factorId: totpState.factorId,
        code: totpCode.replace(/\s/g, ''),
      })
      if (error) throw error
      toast.success('Login successful!')
      navigate(totpState.destination)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Invalid code. Please try again.')
    } finally {
      setTotpVerifying(false)
    }
  }

  const handleEmailOtpVerify = async () => {
    if (!emailOtpState) return
    setEmailOtpVerifying(true)
    try {
      await verifyEmailOtp(emailOtpCode.replace(/\s/g, ''))
      // Mark as verified in session so enforcement overlay knows
      sessionStorage.setItem('email_otp_verified', 'true')
      toast.success('Login successful!')
      navigate(emailOtpState.destination)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Invalid code. Please try again.')
    } finally {
      setEmailOtpVerifying(false)
    }
  }

  const handleResendEmailOtp = async () => {
    try {
      const res = await sendEmailOtp()
      setEmailOtpMasked(res.maskedEmail)
      toast.success('A new code has been sent to your email.')
    } catch {
      toast.error('Failed to resend code. Please try again.')
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
      redirectTo: `${window.location.origin}/reset-password`,
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

  if (checkingSetup) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-[#0A1628]' : 'bg-gray-50'}`}>
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className={`min-h-screen flex ${isDark ? 'bg-dark' : 'bg-gray-50'}`}>
      {/* Pending Verification Alert Modal */}
      {pendingAlert && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-black/60" onClick={() => setPendingAlert(null)} />
          <div className={`relative w-full max-w-md rounded-2xl border p-6 shadow-2xl animate-in zoom-in-95 fade-in duration-200 ${isDark ? 'bg-[#111C32] border-[#1E293B]' : 'bg-white border-gray-200'}`}>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center flex-shrink-0">
                <ShieldAlert className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Account Under Review</h3>
                <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{pendingAlert}</p>
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <Button
                type="button"
                onClick={() => setPendingAlert(null)}
                className="bg-primary hover:bg-primary/90 text-white px-6"
              >
                OK
              </Button>
            </div>
          </div>
        </div>
      )}
      {/* 2FA TOTP Verification Modal */}
      {totpState && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className={`relative w-full max-w-sm rounded-2xl border p-6 shadow-2xl animate-in zoom-in-95 fade-in duration-200 ${isDark ? 'bg-[#111C32] border-[#1E293B]' : 'bg-white border-gray-200'}`}>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-11 h-11 rounded-xl bg-primary/15 flex items-center justify-center">
                <ShieldCheck className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Two-Factor Authentication</h3>
                <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Enter the code from your authenticator app</p>
              </div>
            </div>

            <div className="space-y-4">
              <Input
                type="text"
                inputMode="numeric"
                placeholder="000 000"
                maxLength={7}
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/[^0-9\s]/g, ''))}
                className={`text-2xl tracking-[0.4em] text-center font-mono h-14 ${isDark ? 'bg-[#0A1628] border-[#1E293B] text-white' : 'bg-gray-50 border-gray-200 text-gray-900'}`}
                autoFocus
                onKeyDown={(e) => { if (e.key === 'Enter' && totpCode.replace(/\s/g, '').length >= 6) handleTotpVerify() }}
              />
              <Button
                onClick={handleTotpVerify}
                disabled={totpCode.replace(/\s/g, '').length < 6 || totpVerifying}
                className="w-full bg-primary hover:bg-primary/90 text-white font-semibold py-2.5"
              >
                {totpVerifying ? 'Verifying...' : 'Verify Code'}
              </Button>
              <button
                type="button"
                onClick={async () => { await supabase.auth.signOut(); setTotpState(null); setTotpCode('') }}
                className={`w-full text-sm text-center ${isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'} transition-colors`}
              >
                Cancel — sign in with a different account
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2FA Email OTP Verification Modal */}
      {emailOtpState && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className={`relative w-full max-w-sm rounded-2xl border p-6 shadow-2xl animate-in zoom-in-95 fade-in duration-200 ${isDark ? 'bg-[#111C32] border-[#1E293B]' : 'bg-white border-gray-200'}`}>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-11 h-11 rounded-xl bg-blue-500/15 flex items-center justify-center">
                <Mail className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Email Verification Code</h3>
                <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Code sent to {emailOtpMasked}</p>
              </div>
            </div>

            <div className="space-y-4">
              <Input
                type="text"
                inputMode="numeric"
                placeholder="000 000"
                maxLength={7}
                value={emailOtpCode}
                onChange={(e) => setEmailOtpCode(e.target.value.replace(/[^0-9\s]/g, ''))}
                className={`text-2xl tracking-[0.4em] text-center font-mono h-14 ${isDark ? 'bg-[#0A1628] border-[#1E293B] text-white' : 'bg-gray-50 border-gray-200 text-gray-900'}`}
                autoFocus
                onKeyDown={(e) => { if (e.key === 'Enter' && emailOtpCode.replace(/\s/g, '').length >= 6) handleEmailOtpVerify() }}
              />
              <Button
                onClick={handleEmailOtpVerify}
                disabled={emailOtpCode.replace(/\s/g, '').length < 6 || emailOtpVerifying}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5"
              >
                {emailOtpVerifying ? 'Verifying...' : 'Verify Code'}
              </Button>
              <button
                type="button"
                onClick={handleResendEmailOtp}
                className={`w-full text-sm text-center ${isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'} transition-colors`}
              >
                Resend code
              </button>
              <button
                type="button"
                onClick={async () => { await supabase.auth.signOut(); setEmailOtpState(null); setEmailOtpCode('') }}
                className={`w-full text-sm text-center ${isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'} transition-colors`}
              >
                Cancel — sign in with a different account
              </button>
            </div>
          </div>
        </div>
      )}

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
            <h1 className="text-5xl xl:text-6xl font-extrabold text-white leading-[1.15] tracking-tight opacity-0 animate-fade-up-delay-1">
              Manage Your Apartment With Ease
            </h1>
            <p className="mt-6 text-lg xl:text-xl text-gray-300 leading-relaxed opacity-0 animate-fade-up-delay-2">
              A centralized platform for apartment management, real-time notifications, and seamless task handling.
            </p>
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
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <div className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center">
              <Building2 className="w-5 h-5 text-white" />
            </div>
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
                placeholder="juandelacruz@gmail.com"
                autoComplete="email"
                {...register('email')}
                className={errors.email ? 'border-red-500/50' : ''}
              />
              <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                Use a valid email format (e.g., juandelacruz@gmail.com)
              </p>
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
                  placeholder="juandelacruz@gmail.com"
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
