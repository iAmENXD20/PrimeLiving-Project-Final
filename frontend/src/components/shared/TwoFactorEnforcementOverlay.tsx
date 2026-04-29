import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { ShieldCheck } from 'lucide-react'
import { useTheme } from '@/context/ThemeContext'
import TwoFactorSetup from './TwoFactorSetup'

interface TwoFactorEnforcementOverlayProps {
  /** Role label shown in the message (e.g. "Owner", "Manager", "Tenant") */
  role: string
}

export default function TwoFactorEnforcementOverlay({ role }: TwoFactorEnforcementOverlayProps) {
  const { isDark } = useTheme()
  const [checking, setChecking] = useState(true)
  const [required, setRequired] = useState(false)

  async function checkEnrollment() {
    setChecking(true)
    try {
      const { data, error } = await supabase.auth.mfa.listFactors()
      console.log('[2FA Enforcement] listFactors result:', { data, error })
      if (error) {
        console.warn('[2FA] Could not check factors, treating as unenrolled:', error.message)
        setRequired(true)
        return
      }
      const enrolled = data?.totp?.some((f) => f.status === 'verified') ?? false
      console.log('[2FA Enforcement] enrolled:', enrolled, '→ required:', !enrolled)
      setRequired(!enrolled)
    } catch (err) {
      console.warn('[2FA] Unexpected error checking enrollment:', err)
      setRequired(true)
    } finally {
      setChecking(false)
    }
  }

  useEffect(() => {
    checkEnrollment()
  }, [])

  // Not yet checked or not required — render nothing (transparent)
  if (checking || !required) return null

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', backgroundColor: 'rgba(0,0,0,0.65)' }}
    >
      <div className={`w-full max-w-md rounded-2xl border shadow-2xl overflow-hidden animate-in zoom-in-95 fade-in duration-200 ${isDark ? 'bg-[#0D1B2A] border-[#1E293B]' : 'bg-white border-gray-200'}`}>
        {/* Header */}
        <div className={`px-6 pt-6 pb-5 border-b ${isDark ? 'border-[#1E293B]' : 'border-gray-100'}`}>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-primary/15 flex items-center justify-center flex-shrink-0">
              <ShieldCheck className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Secure Your {role} Account
              </h2>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                Two-factor authentication is required to continue
              </p>
            </div>
          </div>
          <p className={`mt-4 text-sm leading-relaxed ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            PrimeLiving requires all <span className="font-medium">{role}</span> accounts to enable 2FA before accessing the dashboard.
            This takes under 2 minutes and keeps your account protected.
          </p>
        </div>

        {/* Embedded setup — hides header/status since it's a forced flow */}
        <div className="px-6 pb-6 pt-4">
          <TwoFactorSetup onEnrolled={() => setRequired(false)} />
        </div>
      </div>
    </div>
  )
}
