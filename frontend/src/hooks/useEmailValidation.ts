import { useEffect, useMemo, useState } from 'react'
import { validateEmailForAccountCreation } from '@/lib/emailValidationApi'

type EmailValidationStatus = 'idle' | 'checking' | 'valid' | 'invalid'

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function useEmailValidation(email: string) {
  const [status, setStatus] = useState<EmailValidationStatus>('idle')
  const [message, setMessage] = useState('')

  const normalizedEmail = useMemo(() => email.trim().toLowerCase(), [email])

  useEffect(() => {
    let cancelled = false

    if (!normalizedEmail) {
      setStatus('idle')
      setMessage('')
      return
    }

    if (!emailPattern.test(normalizedEmail)) {
      setStatus('invalid')
      setMessage('Please enter a valid email address')
      return
    }

    setStatus('checking')
    setMessage('Checking email...')

    const timeoutId = window.setTimeout(async () => {
      try {
        const result = await validateEmailForAccountCreation(normalizedEmail)
        if (cancelled) return

        if (result.valid) {
          setStatus('valid')
          setMessage('Email verified')
          return
        }

        setStatus('invalid')
        setMessage(result.reason || 'Email could not be verified')
      } catch {
        if (cancelled) return
        setStatus('invalid')
        setMessage('Unable to validate email right now')
      }
    }, 450)

    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
    }
  }, [normalizedEmail])

  return {
    status,
    message,
    isChecking: status === 'checking',
    isValid: status === 'valid',
    isInvalid: status === 'invalid',
  }
}
