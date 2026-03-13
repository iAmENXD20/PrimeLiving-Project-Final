import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import type { EmailOtpType } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export default function InviteConfirmPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const tokenHash = useMemo(() => searchParams.get('token_hash') || '', [searchParams])
  const type = useMemo(() => searchParams.get('type') || 'invite', [searchParams])

  async function handleActivate() {
    if (!tokenHash) {
      setError('Missing invite token. Please request a new invitation email.')
      return
    }

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

    const { error: verifyError } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as EmailOtpType,
    })

    if (verifyError) {
      setError(verifyError.message)
      setVerifying(false)
      return
    }

    const { error: passwordError } = await supabase.auth.updateUser({
      password,
    })

    if (passwordError) {
      setError(passwordError.message)
      setVerifying(false)
      return
    }

    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
        <div className="mb-5">
          <h1 className="text-2xl font-bold text-slate-900">PrimeLiving Invitation</h1>
          <p className="text-sm text-slate-600 mt-1">Click the button below to verify and activate your owner account.</p>
        </div>

        {error ? (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-red-700 text-sm">
            <span>{error}</span>
          </div>
        ) : (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-emerald-700 text-sm">
            <span>Ready to activate your account.</span>
          </div>
        )}

        <div className="space-y-3 mb-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Create Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              placeholder="At least 8 characters"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              placeholder="Re-enter password"
            />
          </div>
        </div>

        <button
          onClick={handleActivate}
          disabled={verifying}
          className="w-full rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 transition-colors disabled:opacity-60"
        >
          {verifying ? 'Activating...' : 'Verify & Activate Account'}
        </button>
      </div>
    </div>
  )
}
