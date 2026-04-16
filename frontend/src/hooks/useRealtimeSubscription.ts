import { useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js'

export interface RealtimeTableConfig {
  /** Supabase table name to listen for changes on */
  table: string
  /** Postgres filter expression, e.g. "apartmentowner_id=eq.abc123" */
  filter?: string
  /** Callback when any INSERT/UPDATE/DELETE happens on the table */
  onChanged: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void
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
          // Look up the latest callback via ref to avoid stale closures
          const current = tablesRef.current.find((t) => t.table === cfg.table && t.filter === cfg.filter)
          current?.onChanged(payload)
        },
      )
    }

    channel.subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
    // Re-subscribe when channel name or enabled flag changes.
    // Table configs are read via ref so they don't trigger re-subscription.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelName, enabled])
}
