/**
 * Module-level cooldown to suppress realtime-triggered refetches
 * immediately after optimistic mutations.
 *
 * Problem: After an optimistic update, Supabase Realtime fires an event
 * which triggers a refetch. That refetch may return stale data (the write
 * hasn't propagated to the read path yet), overwriting the optimistic state.
 *
 * Solution: Call suppressRealtime() before each optimistic mutation.
 * The realtime hook checks isRealtimeSuppressed() and skips the callback
 * during the cooldown window.
 */

let _suppressUntil = 0

/** Suppress realtime refetches for `durationMs` (default 3s). */
export function suppressRealtime(durationMs = 3000) {
  _suppressUntil = Date.now() + durationMs
}

/** Returns true if realtime refetches should be skipped. */
export function isRealtimeSuppressed(): boolean {
  return Date.now() < _suppressUntil
}
