import api from './apiClient'

export interface MfaPreference {
  mfa_method: 'email' | 'totp' | null
}

export async function getMfaPreference(): Promise<MfaPreference> {
  return api.get<MfaPreference>('/auth/mfa/preference')
}

export async function setMfaPreference(method: 'email' | 'totp'): Promise<void> {
  await api.post('/auth/mfa/preference', { mfa_method: method })
}

export async function removeMfaPreference(): Promise<void> {
  await api.delete('/auth/mfa/preference')
}

export async function sendEmailOtp(): Promise<{ maskedEmail: string }> {
  return api.post<{ maskedEmail: string }>('/auth/mfa/email-otp/send', {})
}

export async function verifyEmailOtp(code: string): Promise<{ verified: boolean }> {
  return api.post<{ verified: boolean }>('/auth/mfa/email-otp/verify', { code })
}
