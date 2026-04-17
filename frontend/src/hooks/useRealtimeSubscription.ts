import { useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { invalidateCacheForResources, debugLog } from '@/lib/apiClient'
import { isRealtimeSuppressed } from '@/lib/realtimeCooldown'
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js'

export interface RealtimeTableConfig {
  /** Supabase table name to listen for changes on */
  table: string
  /** Postgres filter expression, e.g. "apartmentowner_id=eq.abc123" */
  filter?: string
  /** Callback when any INSERT/UPDATE/DELETE happens on the table */
  onChanged: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void
}

// Map Supabase table names to apiClient resource scopes for targeted invalidation
const TABLE_TO_RESOURCE: Record<string, string[]> = {
  units: ['apartments'],
  apartments: ['apartments'],
  tenants: ['tenants'],
  payments: ['payments'],
  maintenance: ['maintenance'],
  notifications: ['notifications'],
  announcements: ['announcements'],
  documents: ['documents'],
  apartment_managers: ['managers'],
  apartment_logs: ['apartment-logs'],
  expenses: ['expenses'],
  revenues: ['revenues'],
}

/**
 * Enterprise-ready hook for Supabase Realtime subscriptions.
 *
 * Uses a single channel per component to multiplex multiple table listeners,
 * keeping WebSocket connection count minimal (critical for free-tier limits).
 *
 * @param channelName - Unique channel name per component instance
 * @param tables      - Array of table configs to subscribe to
 * @param enabled     - Toggle subscriptions on/off (default: true)
 *
 * @example
 * ```tsx
 * useRealtimeSubscription(`owner-manage-${ownerId}`, [
 *   { table: 'units', filter: `apartmentowner_id=eq.${ownerId}`, onChanged: () => loadUnits() },
 *   { table: 'apartments', filter: `apartmentowner_id=eq.${ownerId}`, onChanged: () => loadProperties() },
 * ])
 * ```
 */
export function useRealtimeSubscription(
  channelName: string,
  tables: RealtimeTableConfig[],
  enabled = true,
) {
  // Stable ref so we always call the latest callbacks without recreating the channel
  const tablesRef = useRef(tables)
  tablesRef.current = tables

  useEffect(() => {
    if (!enabled || tables.length === 0) return

    let channel: RealtimeChannel = supabase.channel(channelName)

    for (const cfg of tablesRef.current) {
      const filterConfig: Record<string, unknown> = {
        event: '*',
        schema: 'public',
        table: cfg.table,
      }
      if (cfg.filter) {
        filterConfig.filter = cfg.filter
      }

      channel = channel.on(
        'postgres_changes' as any,
        filterConfig as any,
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          console.info(`[Realtime] Event on ${cfg.table}: ${payload.eventType}`, payload.new || payload.old)
          // Immediately invalidate cache for this table's resources
          const resources = TABLE_TO_RESOURCE[cfg.table] || [cfg.table]
          invalidateCacheForResources(resources)

          // Skip refetch if a recent optimistic mutation is in cooldown
          if (isRealtimeSuppressed()) {
            console.info(`[Realtime] Suppressed refetch for ${cfg.table} (mutation cooldown active)`)
            return
          }

          // Fire the callback immediately — no debounce
          // The apiClient's in-flight deduplication handles rapid duplicate requests
          cfg.onChanged(payload)
        },
      )
    }

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.info(`[Realtime] ✓ Channel "${channelName}" connected`)
      } else if (status === 'CHANNEL_ERROR') {
        console.warn(`[Realtime] ✗ Channel "${channelName}" error — will auto-reconnect`)
      } else {
        debugLog('Realtime', `Channel "${channelName}" status: ${status}`)
      }
    })

    return () => {
      supabase.removeChannel(channel)
    }
    // Re-subscribe when channel name or enabled flag changes.
    // Table configs are read via ref so they don't trigger re-subscription.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelName, enabled])
}
