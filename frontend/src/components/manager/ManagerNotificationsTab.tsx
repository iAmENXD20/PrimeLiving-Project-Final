import { useEffect, useState } from 'react'
import { Bell, Trash2, CheckCircle2 } from 'lucide-react'
import { useTheme } from '../../context/ThemeContext'
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription'
import {
  getManagerNotifications,
  markManagerNotificationRead,
  markAllManagerNotificationsRead,
  deleteManagerNotification,
  deleteAllManagerNotifications,
  type ManagerNotification,
} from '../../lib/managerApi'
import ConfirmationModal from '@/components/ui/ConfirmationModal'
import { TableSkeleton } from '@/components/ui/skeleton'

interface ManagerNotificationsTabProps {
  managerId: string
  ownerId: string
  onRead?: () => void
}

export default function ManagerNotificationsTab({ managerId, ownerId, onRead }: ManagerNotificationsTabProps) {
  const { isDark } = useTheme()
  const [notifications, setNotifications] = useState<ManagerNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [confirmAction, setConfirmAction] = useState<{ type: 'one'; id: string } | { type: 'all' } | null>(null)
  const [confirming, setConfirming] = useState(false)

  const loadNotifications = async () => {
    try {
      const data = await getManagerNotifications(managerId, ownerId)
      setNotifications(data)
    } catch (error) {
      console.error('Failed to load manager notifications:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!managerId || !ownerId) return
    let mounted = true

    const load = async () => {
      try {
        const data = await getManagerNotifications(managerId, ownerId)
        if (mounted) setNotifications(data)
      } catch (error) {
        console.error('Failed to load manager notifications:', error)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    load()

    return () => {
      mounted = false
    }
  }, [managerId, ownerId])

  // Real-time: auto-refresh when notifications change
  useRealtimeSubscription(`mgr-notifications-${managerId}`, [
    { table: 'notifications', filter: `recipient_id=eq.${managerId}`, onChanged: () => loadNotifications() },
  ])

  const unreadCount = notifications.filter((notification) => !notification.is_read).length

  const handleMarkRead = async (notification: ManagerNotification) => {
    if (notification.is_read) return
    try {
      await markManagerNotificationRead(notification.id)
      setNotifications((prev) => prev.map((item) => (
        item.id === notification.id ? { ...item, is_read: true } : item
      )))
      onRead?.()
    } catch (error) {
      console.error('Failed to mark notification as read:', error)
    }
  }

  const handleMarkAllRead = async () => {
    try {
      await markAllManagerNotificationsRead(managerId)
      setNotifications((prev) => prev.map((item) => ({ ...item, is_read: true })))
      onRead?.()
    } catch (error) {
      console.error('Failed to mark all as read:', error)
    }
  }

  const handleDeleteOne = async (id: string) => {
    try {
      setConfirming(true)
      await deleteManagerNotification(id)
      await loadNotifications()
      onRead?.()
    } catch (error) {
      console.error('Failed to delete notification:', error)
    } finally {
      setConfirming(false)
      setConfirmAction(null)
    }
  }

  const handleDeleteAll = async () => {
    try {
      setConfirming(true)
      await deleteAllManagerNotifications(managerId, ownerId)
      await loadNotifications()
      onRead?.()
    } catch (error) {
      console.error('Failed to delete all notifications:', error)
    } finally {
      setConfirming(false)
      setConfirmAction(null)
    }
  }

  const cardClass = `rounded-xl border ${isDark ? 'bg-navy-card border-[#1E293B]' : 'bg-white border-gray-200 shadow-sm'}`

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h2 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Notifications</h2>
          <p className={`text-base mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            View and manage your manager notifications
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleMarkAllRead}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              isDark ? 'bg-primary/15 text-primary hover:bg-primary/25' : 'bg-primary/10 text-primary hover:bg-primary/20'
            }`}
          >
            Mark all read
          </button>
          <button
            onClick={() => setConfirmAction({ type: 'all' })}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              isDark ? 'bg-red-500/15 text-red-300 hover:bg-red-500/25' : 'bg-red-50 text-red-600 hover:bg-red-100'
            }`}
          >
            Delete all
          </button>
        </div>
      </div>

      {loading && (
        <TableSkeleton rows={6} />
      )}

      {!loading && (
        <div className={`${cardClass} overflow-hidden`}>
          <div className={`px-4 py-3 border-b text-sm ${isDark ? 'border-[#1E293B] text-gray-400' : 'border-gray-200 text-gray-500'}`}>
            Unread: <span className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{unreadCount}</span>
          </div>

          {notifications.length === 0 ? (
            <div className="py-12 text-center">
              <Bell className={`w-10 h-10 mx-auto mb-3 ${isDark ? 'text-gray-600' : 'text-gray-300'}`} />
              <p className={`text-base font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>No notifications yet</p>
            </div>
          ) : (
            <div className={`divide-y ${isDark ? 'divide-[#1E293B]' : 'divide-gray-100'}`}>
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`px-4 py-4 ${!notification.is_read ? (isDark ? 'bg-primary/10' : 'bg-primary/5') : ''}`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{notification.title}</p>
                      <p className={`text-sm mt-1 whitespace-pre-wrap ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{notification.message}</p>
                      <p className={`text-xs mt-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                        {new Date(notification.created_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 sm:ml-3">
                      {!notification.is_read && (
                        <button
                          onClick={() => handleMarkRead(notification)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-medium ${
                            isDark ? 'bg-primary/20 text-primary hover:bg-primary/30' : 'bg-primary/10 text-primary hover:bg-primary/20'
                          }`}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Mark read
                        </button>
                      )}
                      <button
                        onClick={() => setConfirmAction({ type: 'one', id: notification.id })}
                        className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-medium ${
                          isDark ? 'bg-red-500/20 text-red-300 hover:bg-red-500/30' : 'bg-red-50 text-red-600 hover:bg-red-100'
                        }`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!loading && notifications.length > 0 && (
        <button
          onClick={loadNotifications}
          className={`text-sm font-medium ${isDark ? 'text-primary hover:text-primary/80' : 'text-primary hover:text-primary/80'}`}
        >
          Refresh notifications
        </button>
      )}

      <ConfirmationModal
        open={Boolean(confirmAction)}
        isDark={isDark}
        title={confirmAction?.type === 'all' ? 'Delete all notifications?' : 'Delete notification?'}
        description={
          confirmAction?.type === 'all'
            ? 'This will remove all notifications from your list.'
            : 'This will remove this notification from your list.'
        }
        confirmText="Delete"
        loading={confirming}
        onCancel={() => setConfirmAction(null)}
        onConfirm={() => {
          if (!confirmAction) return
          if (confirmAction.type === 'all') {
            handleDeleteAll()
            return
          }
          handleDeleteOne(confirmAction.id)
        }}
      />
    </div>
  )
}
