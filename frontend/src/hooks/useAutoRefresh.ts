import { useEffect, useCallback, useRef } from 'react'

/**
 * Auto-refresh data when the browser tab becomes visible again.
 * Also provides a manual refresh callback for a refresh button.
 * Optionally polls at a configurable interval.
 */
export function useAutoRefresh(
  refreshFn: () => void | Promise<void>,
  options: { pollMs?: number; enabled?: boolean } = {},
) {
  const { pollMs, enabled = true } = options
  const refreshRef = useRef(refreshFn)
  refreshRef.current = refreshFn

  const lastRefreshRef = useRef(Date.now())

  const refresh = useCallback(() => {
    lastRefreshRef.current = Date.now()
    refreshRef.current()
  }, [])

  // Refresh when tab becomes visible (if >30s since last refresh)
  useEffect(() => {
    if (!enabled) return
    function onVisibilityChange() {
      if (document.visibilityState === 'visible' && Date.now() - lastRefreshRef.current > 30_000) {
        refresh()
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [enabled, refresh])

  // Optional polling
  useEffect(() => {
    if (!enabled || !pollMs || pollMs <= 0) return
    const id = setInterval(refresh, pollMs)
    return () => clearInterval(id)
  }, [enabled, pollMs, refresh])

  return refresh
}
