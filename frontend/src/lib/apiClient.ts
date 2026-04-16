import { supabase } from './supabase'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
const API_CACHE_DEFAULT_TTL_SECONDS = Number(import.meta.env.VITE_API_CACHE_TTL_SECONDS || 0)
const API_CACHE_MAX_ENTRIES = Number(import.meta.env.VITE_API_CACHE_MAX_ENTRIES || 300)
const API_CACHE_CLEANUP_INTERVAL_MS = Number(import.meta.env.VITE_API_CACHE_CLEANUP_INTERVAL_MS || 60000)
const API_REQUEST_TIMEOUT_MS = Number(import.meta.env.VITE_API_REQUEST_TIMEOUT_MS || 15000)

const RESOURCE_INVALIDATION_MAP: Record<string, string[]> = {
  tenants: ['apartments', 'payments', 'analytics', 'maintenance', 'notifications'],
  apartments: ['tenants', 'payments', 'analytics', 'maintenance'],
  payments: ['tenants', 'apartments', 'analytics', 'notifications'],
  maintenance: ['analytics', 'notifications'],
  announcements: ['notifications'],
  documents: ['notifications'],
  notifications: ['analytics'],
}

type RequestOptions = RequestInit & {
  cacheTtlSeconds?: number
  skipCache?: boolean
}

type ApiCacheEntry = {
  expiresAt: number
  lastAccessAt: number
  endpoint: string
  payload: unknown
}

type InFlightGetRequestEntry = {
  promise: Promise<unknown>
}

const apiGetCache = new Map<string, ApiCacheEntry>()
const inFlightGetRequests = new Map<string, InFlightGetRequestEntry>()

function toCacheKey(token: string | null, endpoint: string) {
  return `${token || 'anonymous'}|${endpoint}`
}

function getResourceScope(endpoint: string) {
  const path = endpoint.split('?')[0]
  const parts = path.split('/').filter(Boolean)
  return parts[0] || ''
}

function cleanupExpiredCacheEntries() {
  const now = Date.now()
  for (const [key, entry] of apiGetCache.entries()) {
    if (entry.expiresAt <= now) {
      apiGetCache.delete(key)
      inFlightGetRequests.delete(key)
    }
  }
}

function enforceCacheBounds() {
  if (apiGetCache.size <= API_CACHE_MAX_ENTRIES) return

  const entries = [...apiGetCache.entries()]
  entries.sort((a, b) => a[1].lastAccessAt - b[1].lastAccessAt)

  const removeCount = apiGetCache.size - API_CACHE_MAX_ENTRIES
  for (let index = 0; index < removeCount; index += 1) {
    const [key] = entries[index]
    apiGetCache.delete(key)
    inFlightGetRequests.delete(key)
  }
}

function invalidateCacheForResource(endpoint: string) {
  const resource = getResourceScope(endpoint)

  if (!resource) {
    clearApiCache()
    return
  }

  const resourcesToInvalidate = new Set<string>([
    resource,
    ...(RESOURCE_INVALIDATION_MAP[resource] || []),
  ])

  for (const [key, entry] of apiGetCache.entries()) {
    if (resourcesToInvalidate.has(getResourceScope(entry.endpoint))) {
      apiGetCache.delete(key)
      inFlightGetRequests.delete(key)
    }
  }
}

if (typeof window !== 'undefined' && API_CACHE_CLEANUP_INTERVAL_MS > 0) {
  globalThis.setInterval(cleanupExpiredCacheEntries, API_CACHE_CLEANUP_INTERVAL_MS)
}

export function clearApiCache() {
  apiGetCache.clear()
  inFlightGetRequests.clear()
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
 * Custom error class for API errors that includes HTTP status and response data.
 */
export class ApiError extends Error {
  status: number
  response: { status: number; data: ApiResponse }

  constructor(message: string, status: number, data: ApiResponse) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.response = { status, data }
  }
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
  const cacheKey = toCacheKey(token, endpoint)

  if (shouldUseCache) {
    const cached = apiGetCache.get(cacheKey)
    if (cached && Date.now() < cached.expiresAt) {
      cached.lastAccessAt = Date.now()
      return cached.payload as T
    }

    if (cached && Date.now() >= cached.expiresAt) {
      apiGetCache.delete(cacheKey)
    }

    const inFlight = inFlightGetRequests.get(cacheKey)
    if (inFlight) {
      return inFlight.promise as Promise<T>
    }
  }

  const headers: Record<string, string> = {
    ...((options.headers as Record<string, string>) || {}),
  }

  if (!headers['Content-Type'] && !headers['content-type'] && options.body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const execute = async (): Promise<T> => {
    const timeoutMs = API_REQUEST_TIMEOUT_MS
    const timeoutController = timeoutMs > 0 ? new AbortController() : null
    const timeoutId = timeoutController
      ? globalThis.setTimeout(() => timeoutController.abort('Request timeout'), timeoutMs)
      : null

    if (options.signal && timeoutController) {
      options.signal.addEventListener('abort', () => timeoutController.abort('Aborted'), { once: true })
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      signal: timeoutController?.signal ?? options.signal,
      headers,
    }).finally(() => {
      if (timeoutId !== null) {
        globalThis.clearTimeout(timeoutId)
      }
    })

    let json: ApiResponse<T>

    try {
      json = await response.json()
    } catch {
      throw new Error(`Request failed with status ${response.status}`)
    }

    if (!response.ok || !json.success) {
      throw new ApiError(
        json.error || json.message || `Request failed with status ${response.status}`,
        response.status,
        json,
      )
    }

    const data = json.data as T

    if (shouldUseCache) {
      apiGetCache.set(cacheKey, {
        expiresAt: Date.now() + cacheTtlSeconds * 1000,
        lastAccessAt: Date.now(),
        endpoint,
        payload: data,
      })
      enforceCacheBounds()
    }

    if (method !== 'GET') {
      invalidateCacheForResource(endpoint)
    }

    return data
  }

  if (!shouldUseCache) {
    return execute()
  }

  const promise = execute().finally(() => {
    inFlightGetRequests.delete(cacheKey)
  })

  inFlightGetRequests.set(cacheKey, { promise })
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
