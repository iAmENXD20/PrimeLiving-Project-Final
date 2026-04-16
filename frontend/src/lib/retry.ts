import { ApiError } from './apiClient'

function isTransientError(err: unknown): boolean {
  if (err instanceof ApiError) {
    return err.status >= 500 || err.status === 0 || err.status === 408 || err.status === 429
  }
  if (err instanceof TypeError && String(err.message).toLowerCase().includes('fetch')) {
    return true
  }
  if (err instanceof DOMException && err.name === 'AbortError') {
    return true
  }
  if (err instanceof Error && /network|timeout|abort|econnrefused|econnreset/i.test(err.message)) {
    return true
  }
  return false
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 2,
  baseDelayMs = 500,
): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      if (attempt < retries && isTransientError(err)) {
        await new Promise((r) => setTimeout(r, baseDelayMs * 2 ** attempt))
        continue
      }
      throw err
    }
  }
  throw lastError
}
