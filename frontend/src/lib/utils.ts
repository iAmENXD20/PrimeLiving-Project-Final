import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Format a phone number as +63 9XX XXX XXXX */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return ''
  const digits = phone.replace(/\D/g, '')
  let local: string
  if (digits.startsWith('63') && digits.length >= 12) {
    local = digits.slice(2)
  } else if (digits.startsWith('0') && digits.length >= 11) {
    local = digits.slice(1)
  } else if (digits.startsWith('9') && digits.length === 10) {
    local = digits
  } else {
    return phone // unrecognized format, return as-is
  }
  // local is now 10 digits: 9XXXXXXXXX
  return `+63 ${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`
}
