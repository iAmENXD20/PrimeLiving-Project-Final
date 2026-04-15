import { useEffect, useRef } from 'react'

interface BrowserNotificationItem {
  id: string
  title: string
  message: string
  is_read: boolean
  created_at: string
}

interface UseBrowserNotificationsOptions {
  enabled: boolean
  storageKey: string
  fetchNotifications: () => Promise<BrowserNotificationItem[]>
  pollMs?: number
  onSync?: () => void
}

export default function useBrowserNotifications({
  enabled,
  storageKey,
  fetchNotifications,
  pollMs = 30000,
  onSync,
}: UseBrowserNotificationsOptions) {
  const initializedRef = useRef(false)
  const seenIdsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!enabled || typeof window === 'undefined' || !('Notification' in window)) return

    let active = true

    const hydrateSeenIds = () => {
      try {
        const raw = localStorage.getItem(storageKey)
        if (!raw) return
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) {
          seenIdsRef.current = new Set(parsed.filter((value) => typeof value === 'string'))
        }
      } catch {
        // ignore storage parse issues
      }
    }

    const persistSeenIds = () => {
      try {
        const values = Array.from(seenIdsRef.current)
        localStorage.setItem(storageKey, JSON.stringify(values.slice(-500)))
      } catch {
        // ignore storage write issues
      }
    }

    const maybeRequestPermission = async () => {
      if (Notification.permission === 'default') {
        try {
          await Notification.requestPermission()
        } catch {
          // ignore permission errors
        }
      }
    }

    const showNotification = (item: BrowserNotificationItem) => {
      if (Notification.permission !== 'granted') return

      const notification = new Notification(item.title || 'Notification', {
        body: item.message,
        tag: item.id,
        silent: false,
      })

      notification.onclick = () => {
        window.focus()
        notification.close()
      }
    }

    const syncNotifications = async () => {
      try {
        const notifications = await fetchNotifications()
        if (!active) return

        const unread = notifications.filter((notification) => !notification.is_read)

        if (!initializedRef.current) {
          unread.forEach((notification) => seenIdsRef.current.add(notification.id))
          initializedRef.current = true
          persistSeenIds()
          return
        }

        const unseenUnread = unread
          .filter((notification) => !seenIdsRef.current.has(notification.id))
          .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

        unseenUnread.forEach((notification) => {
          showNotification(notification)
          seenIdsRef.current.add(notification.id)
        })

        if (unseenUnread.length > 0) {
          persistSeenIds()
        }

        // Notify parent to refresh badge count
        onSync?.()
      } catch {
        // silent polling failures
      }
    }

    hydrateSeenIds()
    maybeRequestPermission().finally(() => {
      syncNotifications()
    })

    let interval = window.setInterval(syncNotifications, pollMs)

    const handleVisibilityChange = () => {
      if (document.hidden) {
        window.clearInterval(interval)
      } else {
        syncNotifications()
        interval = window.setInterval(syncNotifications, pollMs)
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      active = false
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [enabled, fetchNotifications, pollMs, storageKey])
}
