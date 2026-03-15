import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import type { EmailOtpType } from '@supabase/supabase-js'
import { ArrowLeft, Building2, CheckCircle2, KeyRound, Sun, Moon } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useTheme } from '@/context/ThemeContext'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export default function InviteConfirmPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { isDark, toggleTheme } = useTheme()
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const tokenHash = useMemo(() => searchParams.get('token_hash') || '', [searchParams])
  const type = useMemo(() => searchParams.get('type') || 'invite', [searchParams])

  async function handleActivate() {
    if (!password || password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setVerifying(true)
    setError(null)
    setSuccessMessage(null)

    if (tokenHash) {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: type as EmailOtpType,
      })

      if (verifyError) {
        setError(verifyError.message)
        setVerifying(false)
        return
      }
    } else {
      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData.session) {
        setError('Invalid or expired invite link. Please request a new invitation email.')
        setVerifying(false)
        return
      }
    }

    const { error: passwordError } = await supabase.auth.updateUser({
      password,
    })

    if (passwordError) {
      setError(passwordError.message)
      setVerifying(false)
      return
    }

    setSuccessMessage('Account activated successfully. Redirecting to login...')
    setTimeout(() => {
      navigate('/login')
    }, 1200)
  }

  return (
    <div className={`min-h-screen flex ${isDark ? 'bg-dark' : 'bg-gray-50'}`}>
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <img
          src="https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=1200&h=1600&fit=crop&q=80"
          alt="PrimeLiving building"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-dark/75" />

        <div className="relative z-10 flex flex-col justify-center px-12 xl:px-20">
          <Link to="/" className="flex items-center gap-3 mb-10">
            <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
              <Building2 className="w-7 h-7 text-white" />
            </div>
            <span className="text-3xl font-bold">
              <span className="text-white">Prime</span>
              <span className="text-primary">Living</span>
            </span>
          </Link>

          <h1 className="text-5xl font-extrabold text-white leading-tight">Finish Your Account Setup</h1>
          <p className="mt-5 text-lg text-gray-300 max-w-lg">
            Set your password to activate access to your PrimeLiving dashboard.
          </p>

          <div className="mt-10 rounded-2xl border border-white/20 bg-white/10 backdrop-blur-md p-5 max-w-lg">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-primary mt-0.5" />
              <p className="text-sm text-gray-200">
                You were invited by your apartment administrator. After activation, use your new password to sign in.
              </p>
            </div>
          </div>
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
            className={`inline-flex items-center gap-1.5 text-sm mb-8 transition-colors ${
              isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Login
          </Link>

          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <div className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold">
              <span className={isDark ? 'text-white' : 'text-gray-900'}>Prime</span>
              <span className="text-primary">Living</span>
            </span>
          </div>

          <div className="mb-7">
            <h2 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Verify & Activate</h2>
            <p className={`mt-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              Create your account password to continue.
            </p>
          </div>

          {error ? (
            <div className={`mb-5 rounded-lg border p-3 text-sm ${isDark ? 'border-red-500/40 bg-red-500/10 text-red-300' : 'border-red-200 bg-red-50 text-red-700'}`}>
              {error}
            </div>
          ) : successMessage ? (
            <div className={`mb-5 rounded-lg border p-3 text-sm ${isDark ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
              {successMessage}
            </div>
          ) : (
            <div className={`mb-5 rounded-lg border p-3 text-sm ${isDark ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
              Ready to activate your account.
            </div>
          )}

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="invite-password">Create Password</Label>
              <div className="relative">
                <KeyRound className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                <Input
                  id="invite-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className={`pl-10 ${isDark ? 'bg-[#0A1628] border-[#1E293B] text-white placeholder-gray-500' : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'}`}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="invite-confirm-password">Confirm Password</Label>
              <div className="relative">
                <KeyRound className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                <Input
                  id="invite-confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  className={`pl-10 ${isDark ? 'bg-[#0A1628] border-[#1E293B] text-white placeholder-gray-500' : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'}`}
                />
              </div>
            </div>
          </div>

          <Button
            type="button"
            onClick={handleActivate}
            disabled={verifying}
            className="w-full mt-6 bg-primary hover:bg-primary/90 text-white font-semibold py-3"
          >
            {verifying ? 'Activating...' : 'Verify & Activate Account'}
          </Button>

          <p className={`text-xs mt-4 text-center ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
            After activation, sign in with your email and new password.
          </p>
        </div>
      </div>
    </div>
  )
}
