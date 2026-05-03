import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Shield, ShieldCheck, ShieldOff, Smartphone, Mail } from 'lucide-react'
import { useTheme } from '@/context/ThemeContext'
import {
  getMfaPreference,
  setMfaPreference,
  removeMfaPreference,
  sendEmailOtp,
  verifyEmailOtp,
} from '@/lib/mfaApi'

export default function TwoFactorSetup({ onEnrolled }: { onEnrolled?: () => void } = {}) {
  const { isDark } = useTheme()

  const [loading, setLoading] = useState(true)

  // TOTP state
  const [totpEnrolled, setTotpEnrolled] = useState(false)
  const [totpFactorId, setTotpFactorId] = useState<string | null>(null)
  const [enrolling, setEnrolling] = useState(false)
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [secret, setSecret] = useState<string | null>(null)
  const [pendingFactorId, setPendingFactorId] = useState<string | null>(null)
  const [verifyCode, setVerifyCode] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [showUnenroll, setShowUnenroll] = useState(false)
  const [unenrollCode, setUnenrollCode] = useState('')
  const [unenrolling, setUnenrolling] = useState(false)

  // Email OTP state
  const [emailOtpEnabled, setEmailOtpEnabled] = useState(false)
  const [emailOtpStep, setEmailOtpStep] = useState<'idle' | 'sent'>('idle')
  const [emailOtpCode, setEmailOtpCode] = useState('')
  const [emailOtpSending, setEmailOtpSending] = useState(false)
  const [emailOtpVerifying, setEmailOtpVerifying] = useState(false)
  const [emailOtpMasked, setEmailOtpMasked] = useState('')
  const [emailOtpDisabling, setEmailOtpDisabling] = useState(false)

  useEffect(() => {
    loadStatus()
  }, [])

  async function loadStatus() {
    setLoading(true)
    try {
      const [mfaRes, prefRes] = await Promise.all([
        supabase.auth.mfa.listFactors(),
        getMfaPreference().catch(() => ({ mfa_method: null })),
      ])
      const totp = mfaRes.data?.totp?.find((f) => f.status === 'verified')
      setTotpEnrolled(!!totp)
      setTotpFactorId(totp?.id ?? null)
      setEmailOtpEnabled(prefRes.mfa_method === 'email')
    } catch {
      setTotpEnrolled(false)
      setEmailOtpEnabled(false)
    } finally {
      setLoading(false)
    }
  }

  // â”€â”€ TOTP handlers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  async function startEnrollment() {
    setEnrolling(true)
    setQrCode(null)
    setSecret(null)
    setPendingFactorId(null)
    setVerifyCode('')
    try {
      const { data: existing } = await supabase.auth.mfa.listFactors()
      const unverified = existing?.totp?.filter((f) => f.status === 'unverified') ?? []
      for (const f of unverified) {
        await supabase.auth.mfa.unenroll({ factorId: f.id })
      }
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', issuer: 'EAMS' })
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
      const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: pendingFactorId, code: verifyCode.replace(/\s/g, '') })
      if (error) throw error
      toast.success('Authenticator app 2FA enabled!')
      setEnrolling(false)
      setQrCode(null)
      setSecret(null)
      setVerifyCode('')
      await loadStatus()
      onEnrolled?.()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Invalid code. Please try again.')
    } finally {
      setVerifying(false)
    }
  }

  async function cancelEnrollment() {
    if (pendingFactorId) await supabase.auth.mfa.unenroll({ factorId: pendingFactorId }).catch(() => {})
    setEnrolling(false)
    setQrCode(null)
    setSecret(null)
    setPendingFactorId(null)
    setVerifyCode('')
  }

  async function confirmUnenroll() {
    if (!totpFactorId) return
    setUnenrolling(true)
    try {
      const { data: challengeData, error: challengeErr } = await supabase.auth.mfa.challenge({ factorId: totpFactorId })
      if (challengeErr) throw challengeErr
      const { error: verifyErr } = await supabase.auth.mfa.verify({ factorId: totpFactorId, challengeId: challengeData.id, code: unenrollCode.replace(/\s/g, '') })
      if (verifyErr) throw verifyErr
      const { error: unenrollErr } = await supabase.auth.mfa.unenroll({ factorId: totpFactorId })
      if (unenrollErr) throw unenrollErr
      toast.success('Authenticator app 2FA has been disabled.')
      setShowUnenroll(false)
      setUnenrollCode('')
      await loadStatus()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Invalid code. Please try again.')
    } finally {
      setUnenrolling(false)
    }
  }

  // â”€â”€ Email OTP handlers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  async function handleEnableEmailOtp() {
    setEmailOtpSending(true)
    try {
      const res = await sendEmailOtp()
      setEmailOtpMasked(res.maskedEmail)
      setEmailOtpStep('sent')
      setEmailOtpCode('')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to send verification code')
    } finally {
      setEmailOtpSending(false)
    }
  }

  async function handleVerifyEmailOtp() {
    setEmailOtpVerifying(true)
    try {
      await verifyEmailOtp(emailOtpCode.replace(/\s/g, ''))
      await setMfaPreference('email')
      setEmailOtpEnabled(true)
      setEmailOtpStep('idle')
      setEmailOtpCode('')
      toast.success('Email OTP 2FA enabled!')
      onEnrolled?.()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Invalid code. Please try again.')
    } finally {
      setEmailOtpVerifying(false)
    }
  }

  async function handleDisableEmailOtp() {
    setEmailOtpDisabling(true)
    try {
      await removeMfaPreference()
      setEmailOtpEnabled(false)
      toast.success('Email OTP 2FA disabled.')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to disable Email OTP')
    } finally {
      setEmailOtpDisabling(false)
    }
  }

  const cardClass = isDark ? 'bg-[#111C32] border-[#1E293B]' : 'bg-white border-gray-200'
  const inputClass = isDark
    ? 'bg-[#0A1628] border-[#1E293B] text-white placeholder:text-gray-500 focus:border-primary'
    : 'bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-primary'
  const labelClass = isDark ? 'text-gray-300' : 'text-gray-700'
  const mutedClass = isDark ? 'text-gray-400' : 'text-gray-500'
  const textClass = isDark ? 'text-white' : 'text-gray-900'
  const innerCardClass = isDark ? 'border-[#1E293B] bg-[#0A1628]/50' : 'border-gray-100 bg-gray-50'

  const anyEnabled = totpEnrolled || emailOtpEnabled

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
    <div className={`${cardClass} rounded-2xl border p-6 lg:p-8 shadow-sm space-y-6`}>
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${anyEnabled ? 'bg-green-500/15' : 'bg-primary/15'}`}>
          {anyEnabled ? (
            <ShieldCheck className="w-5 h-5 text-green-500" />
          ) : (
            <Shield className="w-5 h-5 text-primary" />
          )}
        </div>
        <div>
          <h3 className={`text-lg font-semibold ${textClass}`}>Two-Factor Authentication</h3>
          <p className={`text-sm ${mutedClass}`}>
            {anyEnabled ? 'Your account has 2FA protection enabled' : 'Add an extra layer of security to your account'}
          </p>
        </div>
        {anyEnabled && (
          <span className="ml-auto px-2.5 py-1 rounded-full text-xs font-semibold bg-green-500/15 text-green-500">
            Enabled
          </span>
        )}
      </div>

      {/* â”€â”€ OPTION 1: Authenticator App (TOTP) â”€â”€ */}
      <div className={`rounded-xl border p-5 space-y-4 ${innerCardClass}`}>
        <div className="flex items-start gap-3">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${totpEnrolled ? 'bg-green-500/15' : 'bg-primary/10'}`}>
            <Smartphone className={`w-4 h-4 ${totpEnrolled ? 'text-green-500' : 'text-primary'}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h4 className={`text-sm font-semibold ${textClass}`}>Authenticator App</h4>
              {totpEnrolled && (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/15 text-green-500">Active</span>
              )}
            </div>
            <p className={`text-xs mt-0.5 ${mutedClass}`}>Use Google Authenticator, Authy, or any TOTP app</p>
          </div>
        </div>

        {/* Not enrolled â€” show enable button or enrollment form */}
        {!totpEnrolled && !enrolling && (
          <Button onClick={startEnrollment} className="bg-primary hover:bg-primary/90 text-white font-semibold px-5 w-full sm:w-auto">
            <Smartphone className="w-4 h-4 mr-2" />
            Enable Authenticator App
          </Button>
        )}

        {/* Enrollment flow */}
        {enrolling && (
          <div className="space-y-4">
            {qrCode ? (
              <>
                <div className={`rounded-xl border p-4 space-y-3 ${isDark ? 'border-[#1E293B] bg-[#0A1628]/70' : 'border-gray-200 bg-white'}`}>
                  <p className={`text-sm font-medium ${textClass}`}>Step 1 â€” Scan this QR code with your authenticator app</p>
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
                  <Label className={`text-sm ${labelClass}`}>Step 2 â€” Enter the 6-digit code from your app</Label>
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
                  <Button onClick={verifyEnrollment} disabled={verifyCode.replace(/\s/g, '').length < 6 || verifying} className="bg-primary hover:bg-primary/90 text-white font-semibold">
                    {verifying ? 'Verifying...' : 'Confirm & Enable'}
                  </Button>
                  <Button variant="outline" onClick={cancelEnrollment} className={isDark ? 'border-[#1E293B] text-gray-300 hover:bg-[#1E293B]' : ''}>
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

        {/* Enrolled â€” disable option */}
        {totpEnrolled && !showUnenroll && (
          <Button variant="outline" onClick={() => { setShowUnenroll(true); setUnenrollCode('') }}
            className={`text-red-500 border-red-500/30 hover:bg-red-500/10 hover:text-red-500 ${isDark ? 'bg-transparent' : ''}`}>
            <ShieldOff className="w-4 h-4 mr-2" />
            Disable Authenticator App
          </Button>
        )}

        {totpEnrolled && showUnenroll && (
          <div className={`rounded-xl border p-4 space-y-4 ${isDark ? 'border-red-500/20 bg-red-500/5' : 'border-red-200 bg-red-50'}`}>
            <p className="text-sm font-medium text-red-500">Enter your current authenticator code to confirm.</p>
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
              <Button onClick={confirmUnenroll} disabled={unenrollCode.replace(/\s/g, '').length < 6 || unenrolling} className="bg-red-500 hover:bg-red-600 text-white font-semibold">
                {unenrolling ? 'Disabling...' : 'Confirm Disable'}
              </Button>
              <Button variant="outline" onClick={() => { setShowUnenroll(false); setUnenrollCode('') }} className={isDark ? 'border-[#1E293B] text-gray-300 hover:bg-[#1E293B]' : ''}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* â”€â”€ OPTION 2: Email OTP â”€â”€ */}
      <div className={`rounded-xl border p-5 space-y-4 ${innerCardClass}`}>
        <div className="flex items-start gap-3">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${emailOtpEnabled ? 'bg-green-500/15' : 'bg-primary/10'}`}>
            <Mail className={`w-4 h-4 ${emailOtpEnabled ? 'text-green-500' : 'text-primary'}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h4 className={`text-sm font-semibold ${textClass}`}>Email One-Time Password</h4>
              {emailOtpEnabled && (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/15 text-green-500">Active</span>
              )}
            </div>
            <p className={`text-xs mt-0.5 ${mutedClass}`}>Receive a 6-digit code to your email address at sign-in</p>
          </div>
        </div>

        {/* Not enabled â€” enable flow */}
        {!emailOtpEnabled && emailOtpStep === 'idle' && (
          <Button onClick={handleEnableEmailOtp} disabled={emailOtpSending}
            className="bg-primary hover:bg-primary/90 text-white font-semibold px-5 w-full sm:w-auto">
            <Mail className="w-4 h-4 mr-2" />
            {emailOtpSending ? 'Sending code...' : 'Enable Email OTP'}
          </Button>
        )}

        {/* Verification step */}
        {emailOtpStep === 'sent' && (
          <div className="space-y-3">
            <p className={`text-sm ${mutedClass}`}>
              A 6-digit code was sent to <strong className={textClass}>{emailOtpMasked}</strong>. Enter it below to confirm.
            </p>
            <div className="space-y-1.5">
              <Label className={`text-sm ${labelClass}`}>Verification code</Label>
              <Input
                type="text"
                inputMode="numeric"
                placeholder="000 000"
                maxLength={7}
                value={emailOtpCode}
                onChange={(e) => setEmailOtpCode(e.target.value.replace(/[^0-9\s]/g, ''))}
                autoFocus
                className={`text-lg tracking-[0.3em] text-center font-mono h-12 ${inputClass}`}
              />
            </div>
            <div className="flex gap-3">
              <Button onClick={handleVerifyEmailOtp} disabled={emailOtpCode.replace(/\s/g, '').length < 6 || emailOtpVerifying}
                className="bg-primary hover:bg-primary/90 text-white font-semibold">
                {emailOtpVerifying ? 'Verifying...' : 'Confirm & Enable'}
              </Button>
              <Button variant="outline" onClick={() => { setEmailOtpStep('idle'); setEmailOtpCode('') }}
                className={isDark ? 'border-[#1E293B] text-gray-300 hover:bg-[#1E293B]' : ''}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Enabled â€” disable option */}
        {emailOtpEnabled && (
          <Button variant="outline" onClick={handleDisableEmailOtp} disabled={emailOtpDisabling}
            className={`text-red-500 border-red-500/30 hover:bg-red-500/10 hover:text-red-500 ${isDark ? 'bg-transparent' : ''}`}>
            <ShieldOff className="w-4 h-4 mr-2" />
            {emailOtpDisabling ? 'Disabling...' : 'Disable Email OTP'}
          </Button>
        )}
      </div>
    </div>
  )
}
