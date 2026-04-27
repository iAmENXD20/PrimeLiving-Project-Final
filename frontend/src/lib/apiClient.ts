import { supabase } from './supabase'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
const API_CACHE_DEFAULT_TTL_SECONDS = 0 // Disabled for instant data updates
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
 * Invalidate cache entries matching specific resource scopes.
 * Preferred over clearApiCache() for targeted invalidation.
 */
export function invalidateCacheForResources(resources: string[]) {
  const scopes = new Set<string>()
  for (const r of resources) {
    scopes.add(r)
    const related = RESOURCE_INVALIDATION_MAP[r]
    if (related) {
      for (const rel of related) scopes.add(rel)
    }
  }
  for (const [key, entry] of apiGetCache.entries()) {
    if (scopes.has(getResourceScope(entry.endpoint))) {
      apiGetCache.delete(key)
      inFlightGetRequests.delete(key)
    }
  }
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

// Debug logging — enable via browser console: localStorage.setItem('DEBUG_REALTIME', '1')
const isDebug = () => typeof window !== 'undefined' && localStorage.getItem('DEBUG_REALTIME') === '1'
export function debugLog(tag: string, ...args: unknown[]) {
  if (isDebug()) console.log(`%c[${tag}]`, 'color:#00bcd4;font-weight:bold', ...args)
}

// Cache the current session token metadata for cache keying and quick reuse.
let _cachedToken: string | null = null
let _tokenExpiresAt = 0

function setCachedToken(token: string | null, expiresAt?: number | null) {
  _cachedToken = token

  if (!token) {
    _tokenExpiresAt = 0
    return
  }

  const expiresAtMs = (expiresAt || 0) * 1000
  _tokenExpiresAt = expiresAtMs
    ? Math.min(expiresAtMs - 60_000, Date.now() + 300_000)
    : Date.now() + 300_000
}

if (typeof window !== 'undefined') {
  supabase.auth.onAuthStateChange((event, session) => {
    setCachedToken(session?.access_token ?? null, session?.expires_at)

    if (event === 'SIGNED_OUT') {
      clearApiCache()
    }
  })
}

/**
 * Get the current Supabase session access token.
 * Returns null if the user is not authenticated.
 */
async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession()
  if (data.session?.access_token) {
    setCachedToken(data.session.access_token, data.session.expires_at)
    return data.session.access_token
  }

  // Session is missing (e.g. just signed out) so stale tokens must not be reused.
  setCachedToken(null)

  // If a refresh token exists, this restores a valid access token.
  const { data: refreshed } = await supabase.auth.refreshSession()
  if (refreshed.session?.access_token) {
    setCachedToken(refreshed.session.access_token, refreshed.session.expires_at)
    return refreshed.session.access_token
  }

  setCachedToken(null)
  return null
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
  const _reqStart = Date.now()
  const token = await getAccessToken()
  const method = (options.method || 'GET').toUpperCase()
  const cacheTtlSeconds = options.cacheTtlSeconds ?? API_CACHE_DEFAULT_TTL_SECONDS
  const shouldUseCache = method === 'GET' && cacheTtlSeconds > 0 && !options.skipCache
  const cacheKey = toCacheKey(token, endpoint)

  debugLog('API', `${method} ${endpoint}`, { skipCache: !!options.skipCache, shouldUseCache, cacheTtlSeconds })

  if (shouldUseCache) {
    const cached = apiGetCache.get(cacheKey)
    if (cached && Date.now() < cached.expiresAt) {
      debugLog('API', `CACHE HIT ${endpoint} (expires in ${cached.expiresAt - Date.now()}ms)`)
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
      cache: options.skipCache ? 'no-store' : undefined,
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

    debugLog('API', `${method} ${endpoint} completed in ${Date.now() - _reqStart}ms`, { status: response.status, dataSize: Array.isArray(data) ? data.length : typeof data })

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
      debugLog('API', `Invalidating cache for resource: ${getResourceScope(endpoint)}`)
      invalidateCacheForResource(endpoint)
    }

    return data
  }

  // Deduplicate in-flight GET requests to prevent redundant network calls.
  // IMPORTANT: skipCache requests always start fresh — they must NOT join a
  // stale in-flight request that was started before a mutation.
  // Only non-skipCache GETs and duplicate skipCache GETs are deduped.
  const freshKey = options.skipCache ? `${cacheKey}|fresh` : cacheKey

  if (method === 'GET') {
    const existing = inFlightGetRequests.get(freshKey)
    if (existing) {
      debugLog('API', `Deduped in-flight request for ${endpoint}`)
      return existing.promise as Promise<T>
    }
  }

  const promise = execute().finally(() => {
    inFlightGetRequests.delete(freshKey)
  })

  if (method === 'GET') {
    inFlightGetRequests.set(freshKey, { promise })
  }

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
