import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Shield, ShieldCheck, ShieldOff, Smartphone } from 'lucide-react'
import { useTheme } from '@/context/ThemeContext'

export default function TwoFactorSetup({ onEnrolled }: { onEnrolled?: () => void } = {}) {
  const { isDark } = useTheme()

  const [loading, setLoading] = useState(true)
  const [enrolled, setEnrolled] = useState(false)
  const [factorId, setFactorId] = useState<string | null>(null)

  // Enrollment flow
  const [enrolling, setEnrolling] = useState(false)
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [secret, setSecret] = useState<string | null>(null)
  const [pendingFactorId, setPendingFactorId] = useState<string | null>(null)
  const [verifyCode, setVerifyCode] = useState('')
  const [verifying, setVerifying] = useState(false)

  // Unenroll flow
  const [showUnenroll, setShowUnenroll] = useState(false)
  const [unenrollCode, setUnenrollCode] = useState('')
  const [unenrolling, setUnenrolling] = useState(false)

  useEffect(() => {
    checkEnrollment()
  }, [])

  async function checkEnrollment() {
    setLoading(true)
    try {
      const { data, error } = await supabase.auth.mfa.listFactors()
      if (error) {
        setEnrolled(false)
        setFactorId(null)
        return
      }
      const totp = data?.totp?.find((f) => f.status === 'verified')
      setEnrolled(!!totp)
      setFactorId(totp?.id ?? null)
    } catch {
      setEnrolled(false)
      setFactorId(null)
    } finally {
      setLoading(false)
    }
  }

  async function startEnrollment() {
    setEnrolling(true)
    setQrCode(null)
    setSecret(null)
    setPendingFactorId(null)
    setVerifyCode('')
    try {
      // Cancel any existing unverified factors first
      const { data: existing } = await supabase.auth.mfa.listFactors()
      const unverified = existing?.totp?.filter((f) => f.status === 'unverified') ?? []
      for (const f of unverified) {
        await supabase.auth.mfa.unenroll({ factorId: f.id })
      }

      const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', issuer: 'PrimeLiving' })
      if (error) throw error
      setQrCode(data.totp.qr_code)
      setSecret(data.totp.secret)
      setPendingFactorId(data.id)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to start 2FA setup')
      setEnrolling(false)
    }
  }

  async function verifyEnrollment() {
    if (!pendingFactorId) return
    setVerifying(true)
    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({
        factorId: pendingFactorId,
        code: verifyCode.replace(/\s/g, ''),
      })
      if (error) throw error
      toast.success('Two-factor authentication enabled!')
      setEnrolling(false)
      setQrCode(null)
      setSecret(null)
      setVerifyCode('')
      await checkEnrollment()
      onEnrolled?.()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Invalid code. Please try again.')
    } finally {
      setVerifying(false)
    }
  }

  async function cancelEnrollment() {
    if (pendingFactorId) {
      await supabase.auth.mfa.unenroll({ factorId: pendingFactorId }).catch(() => {})
    }
    setEnrolling(false)
    setQrCode(null)
    setSecret(null)
    setPendingFactorId(null)
    setVerifyCode('')
  }

  async function confirmUnenroll() {
    if (!factorId) return
    setUnenrolling(true)
    try {
      const { data: challengeData, error: challengeErr } = await supabase.auth.mfa.challenge({ factorId })
      if (challengeErr) throw challengeErr

      const { error: verifyErr } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code: unenrollCode.replace(/\s/g, ''),
      })
      if (verifyErr) throw verifyErr

      const { error: unenrollErr } = await supabase.auth.mfa.unenroll({ factorId })
      if (unenrollErr) throw unenrollErr

      toast.success('Two-factor authentication has been disabled.')
      setShowUnenroll(false)
      setUnenrollCode('')
      await checkEnrollment()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Invalid code. Please try again.')
    } finally {
      setUnenrolling(false)
    }
  }

  const cardClass = isDark ? 'bg-[#111C32] border-[#1E293B]' : 'bg-white border-gray-200'
  const inputClass = isDark
    ? 'bg-[#0A1628] border-[#1E293B] text-white placeholder:text-gray-500 focus:border-primary'
    : 'bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-primary'
  const labelClass = isDark ? 'text-gray-300' : 'text-gray-700'
  const mutedClass = isDark ? 'text-gray-400' : 'text-gray-500'
  const textClass = isDark ? 'text-white' : 'text-gray-900'

  if (loading) {
    return (
      <div className={`${cardClass} rounded-2xl border p-6 lg:p-8 shadow-sm`}>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center">
            <Shield className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className={`text-lg font-semibold ${textClass}`}>Two-Factor Authentication</h3>
            <p className={`text-sm ${mutedClass}`}>Loading 2FA status...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`${cardClass} rounded-2xl border p-6 lg:p-8 shadow-sm space-y-5`}>
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${enrolled ? 'bg-green-500/15' : 'bg-primary/15'}`}>
          {enrolled ? (
            <ShieldCheck className="w-5 h-5 text-green-500" />
          ) : (
            <Shield className="w-5 h-5 text-primary" />
          )}
        </div>
        <div>
          <h3 className={`text-lg font-semibold ${textClass}`}>Two-Factor Authentication</h3>
          <p className={`text-sm ${mutedClass}`}>
            {enrolled ? '2FA is currently enabled on your account' : 'Add an extra layer of security to your account'}
          </p>
        </div>
        {enrolled && (
          <span className="ml-auto px-2.5 py-1 rounded-full text-xs font-semibold bg-green-500/15 text-green-500">
            Enabled
          </span>
        )}
      </div>

      {/* Not enrolled — show enable button or enrollment form */}
      {!enrolled && !enrolling && (
        <div className={`rounded-xl border p-4 ${isDark ? 'border-[#1E293B] bg-[#0A1628]/50' : 'border-gray-100 bg-gray-50'}`}>
          <p className={`text-sm mb-4 ${mutedClass}`}>
            Use an authenticator app (Google Authenticator, Authy, etc.) to generate time-based codes when you sign in.
          </p>
          <Button
            onClick={startEnrollment}
            className="bg-primary hover:bg-primary/90 text-white font-semibold px-5"
          >
            <Smartphone className="w-4 h-4 mr-2" />
            Enable 2FA
          </Button>
        </div>
      )}

      {/* Enrollment flow */}
      {enrolling && (
        <div className="space-y-4">
          {qrCode ? (
            <>
              <div className={`rounded-xl border p-4 space-y-3 ${isDark ? 'border-[#1E293B] bg-[#0A1628]/50' : 'border-gray-100 bg-gray-50'}`}>
                <p className={`text-sm font-medium ${textClass}`}>Step 1 — Scan this QR code with your authenticator app</p>
                <div className="flex justify-center">
                  <div className="bg-white p-3 rounded-lg inline-block">
                    <img src={qrCode} alt="2FA QR Code" className="w-44 h-44" />
                  </div>
                </div>
                {secret && (
                  <div>
                    <p className={`text-xs ${mutedClass} mb-1`}>Or enter this key manually:</p>
                    <code className={`block text-xs font-mono tracking-widest px-3 py-2 rounded-lg ${isDark ? 'bg-[#0A1628] text-gray-300' : 'bg-white text-gray-700 border border-gray-200'}`}>
                      {secret}
                    </code>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className={`text-sm ${labelClass}`}>
                  Step 2 — Enter the 6-digit code from your app
                </Label>
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder="000 000"
                  maxLength={7}
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value.replace(/[^0-9\s]/g, ''))}
                  className={`text-lg tracking-[0.3em] text-center font-mono h-12 ${inputClass}`}
                />
              </div>

              <div className="flex gap-3 pt-1">
                <Button
                  onClick={verifyEnrollment}
                  disabled={verifyCode.replace(/\s/g, '').length < 6 || verifying}
                  className="bg-primary hover:bg-primary/90 text-white font-semibold"
                >
                  {verifying ? 'Verifying...' : 'Confirm & Enable 2FA'}
                </Button>
                <Button
                  variant="outline"
                  onClick={cancelEnrollment}
                  className={isDark ? 'border-[#1E293B] text-gray-300 hover:bg-[#1E293B]' : ''}
                >
                  Cancel
                </Button>
              </div>
            </>
          ) : (
            <div className={`flex items-center gap-3 p-4 rounded-xl ${isDark ? 'bg-[#0A1628]/50' : 'bg-gray-50'}`}>
              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span className={`text-sm ${mutedClass}`}>Generating QR code...</span>
            </div>
          )}
        </div>
      )}

      {/* Enrolled — show disable option */}
      {enrolled && !showUnenroll && (
        <div className={`rounded-xl border p-4 ${isDark ? 'border-[#1E293B] bg-[#0A1628]/50' : 'border-gray-100 bg-gray-50'}`}>
          <p className={`text-sm mb-4 ${mutedClass}`}>
            Your account is protected with TOTP two-factor authentication. You'll be asked for a code from your authenticator app each time you sign in.
          </p>
          <Button
            variant="outline"
            onClick={() => { setShowUnenroll(true); setUnenrollCode('') }}
            className={`text-red-500 border-red-500/30 hover:bg-red-500/10 hover:text-red-500 ${isDark ? 'bg-transparent' : ''}`}
          >
            <ShieldOff className="w-4 h-4 mr-2" />
            Disable 2FA
          </Button>
        </div>
      )}

      {/* Unenroll confirmation form */}
      {enrolled && showUnenroll && (
        <div className={`rounded-xl border p-4 space-y-4 ${isDark ? 'border-red-500/20 bg-red-500/5' : 'border-red-200 bg-red-50'}`}>
          <p className={`text-sm font-medium text-red-500`}>
            Enter your current authenticator code to confirm disabling 2FA.
          </p>
          <div className="space-y-1.5">
            <Label className={`text-sm ${labelClass}`}>6-digit code</Label>
            <Input
              type="text"
              inputMode="numeric"
              placeholder="000 000"
              maxLength={7}
              value={unenrollCode}
              onChange={(e) => setUnenrollCode(e.target.value.replace(/[^0-9\s]/g, ''))}
              className={`text-lg tracking-[0.3em] text-center font-mono h-12 ${inputClass}`}
            />
          </div>
          <div className="flex gap-3">
            <Button
              onClick={confirmUnenroll}
              disabled={unenrollCode.replace(/\s/g, '').length < 6 || unenrolling}
              className="bg-red-500 hover:bg-red-600 text-white font-semibold"
            >
              {unenrolling ? 'Disabling...' : 'Confirm Disable'}
            </Button>
            <Button
              variant="outline"
              onClick={() => { setShowUnenroll(false); setUnenrollCode('') }}
              className={isDark ? 'border-[#1E293B] text-gray-300 hover:bg-[#1E293B]' : ''}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
