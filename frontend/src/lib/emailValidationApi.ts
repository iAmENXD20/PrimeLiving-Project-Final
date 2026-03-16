import api from './apiClient'

export interface EmailValidationResult {
  valid: boolean
  reason?: string
}

export async function validateEmailForAccountCreation(email: string): Promise<EmailValidationResult> {
  const encodedEmail = encodeURIComponent(email.trim().toLowerCase())
  return api.get<EmailValidationResult>(`/auth/validate-email?email=${encodedEmail}`, {
    skipCache: true,
  })
}
