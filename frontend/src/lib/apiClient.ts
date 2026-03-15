import { supabase } from './supabase'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
const API_CACHE_DEFAULT_TTL_SECONDS = Number(import.meta.env.VITE_API_CACHE_TTL_SECONDS || 20)

type RequestOptions = RequestInit & {
  cacheTtlSeconds?: number
  skipCache?: boolean
}

type ApiCacheEntry = {
  expiresAt: number
  payload: unknown
}

const apiGetCache = new Map<string, ApiCacheEntry>()
const inFlightGetRequests = new Map<string, Promise<unknown>>()

export function clearApiCache() {
  apiGetCache.clear()
}

/**
 * Generic API response from the Express backend.
 * All backend endpoints return { success, data?, message?, error? }
 */
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  message?: string
  error?: string
}

/**
 * Get the current Supabase session access token.
 * Returns null if the user is not authenticated.
 */
async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession()
  if (data.session?.access_token) {
    return data.session.access_token
  }

  const { data: refreshed } = await supabase.auth.refreshSession()
  return refreshed.session?.access_token ?? null
}

/**
 * Core fetch wrapper that:
 * 1. Automatically injects the Authorization: Bearer <token> header
 * 2. Handles JSON parsing
 * 3. Throws on non-success responses with the backend error message
 */
async function request<T>(
  endpoint: string,
  options: RequestOptions = {},
): Promise<T> {
  const token = await getAccessToken()
  const method = (options.method || 'GET').toUpperCase()
  const cacheTtlSeconds = options.cacheTtlSeconds ?? API_CACHE_DEFAULT_TTL_SECONDS
  const shouldUseCache = method === 'GET' && cacheTtlSeconds > 0 && !options.skipCache
  const cacheKey = `${token || 'anonymous'}:${endpoint}`

  if (shouldUseCache) {
    const cached = apiGetCache.get(cacheKey)
    if (cached && Date.now() < cached.expiresAt) {
      return cached.payload as T
    }

    const inFlight = inFlightGetRequests.get(cacheKey)
    if (inFlight) {
      return inFlight as Promise<T>
    }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const execute = async (): Promise<T> => {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
    })

    const json: ApiResponse<T> = await response.json()

    if (!response.ok || !json.success) {
      throw new Error(json.error || json.message || `Request failed with status ${response.status}`)
    }

    const data = json.data as T

    if (shouldUseCache) {
      apiGetCache.set(cacheKey, {
        expiresAt: Date.now() + cacheTtlSeconds * 1000,
        payload: data,
      })
    }

    if (method !== 'GET') {
      clearApiCache()
    }

    return data
  }

  if (!shouldUseCache) {
    return execute()
  }

  const promise = execute().finally(() => {
    inFlightGetRequests.delete(cacheKey)
  })

  inFlightGetRequests.set(cacheKey, promise)
  return promise
}

/**
 * Convenience methods for each HTTP verb.
 * All return the unwrapped `data` field from the backend ApiResponse.
 */
export const api = {
  get<T>(endpoint: string, options?: { cacheTtlSeconds?: number; skipCache?: boolean }): Promise<T> {
    return request<T>(endpoint, {
      method: 'GET',
      cacheTtlSeconds: options?.cacheTtlSeconds,
      skipCache: options?.skipCache,
    })
  },

  post<T>(endpoint: string, body?: unknown): Promise<T> {
    return request<T>(endpoint, {
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  },

  put<T>(endpoint: string, body?: unknown): Promise<T> {
    return request<T>(endpoint, {
      method: 'PUT',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  },

  delete<T>(endpoint: string, body?: unknown): Promise<T> {
    return request<T>(endpoint, {
      method: 'DELETE',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  },
}

export default api
