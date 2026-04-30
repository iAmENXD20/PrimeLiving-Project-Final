import { useEffect, useState, useCallback, useRef } from 'react'
import { Bell, Megaphone, Check, Trash2, MessageSquare, Send } from 'lucide-react'
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription'
import { useTheme } from '../../context/ThemeContext'
import {
  getTenantNotifications,
  markTenantNotificationRead,
  markAllTenantNotificationsRead,
  deleteTenantNotification,
  deleteAllTenantNotifications,
  replyToAnnouncement,
  type TenantNotification,
} from '../../lib/tenantApi'
import ConfirmationModal from '@/components/ui/ConfirmationModal'
import { TableSkeleton } from '@/components/ui/skeleton'

interface TenantNotificationsTabProps {
  tenantId: string
  ownerId: string | null
  onRead?: () => void
}

export default function TenantNotificationsTab({ tenantId, ownerId, onRead }: TenantNotificationsTabProps) {
  const { isDark } = useTheme()
  const [notifications, setNotifications] = useState<TenantNotification[]>([])
  const [loading, setLoading] = useState(true)
  const initialLoadDone = useRef(false)
  const loadVersion = useRef(0)
  const [confirmAction, setConfirmAction] = useState<{ type: 'one'; id: string } | { type: 'all' } | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [replyingToId, setReplyingToId] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [replySubmitting, setReplySubmitting] = useState(false)
  const [replySuccess, setReplySuccess] = useState<string | null>(null)

  const loadNotifications = useCallback(async (skipCache = false) => {
    const version = ++loadVersion.current
    try {
      if (!initialLoadDone.current) setLoading(true)
      const data = await getTenantNotifications(tenantId, ownerId, { skipCache })
      if (loadVersion.current !== version) return // stale response
      setNotifications(data)
      initialLoadDone.current = true
    } catch (err) {
      if (loadVersion.current !== version) return
      console.error('Failed to load notifications:', err)
    } finally {
      if (loadVersion.current === version) setLoading(false)
    }
  }, [tenantId, ownerId])

  useEffect(() => {
    loadNotifications()
  }, [loadNotifications])

  useRealtimeSubscription(`tenant-notifs-${tenantId}`, [
    { table: 'notifications', filter: `recipient_id=eq.${tenantId}`, onChanged: () => loadNotifications(true) },
  ])

  // Auto-mark all as read when notifications tab is opened
  useEffect(() => {
    if (notifications.length > 0 && notifications.some((n) => !n.is_read)) {
      markAllTenantNotificationsRead(tenantId)
        .then(() => {
          setNotifications((prev) => prev.map((item) => ({ ...item, is_read: true })))
          onRead?.()
        })
        .catch(() => {})
    }
  }, [notifications.length > 0 && notifications.some((n) => !n.is_read)])

  const cardClass = `rounded-xl p-6 border ${
    isDark ? 'bg-navy-card border-[#1E293B]' : 'bg-white border-gray-200 shadow-sm'
  }`

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const handleMarkRead = async (id: string) => {
    try {
      await markTenantNotificationRead(id)
      setNotifications((prev) => prev.map((notification) => (
        notification.id === id ? { ...notification, is_read: true } : notification
      )))
      onRead?.()
    } catch (error) {
      console.error('Failed to mark notification as read:', error)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      setConfirming(true)
      await deleteTenantNotification(id)
      await loadNotifications(true)
      onRead?.()
    } catch (error) {
      console.error('Failed to delete notification:', error)
    } finally {
      setConfirming(false)
      setConfirmAction(null)
    }
  }

  const handleMarkAllRead = async () => {
    try {
      await markAllTenantNotificationsRead(tenantId)
      setNotifications((prev) => prev.map((notification) => ({ ...notification, is_read: true })))
      onRead?.()
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error)
    }
  }

  const handleReplySubmit = async (announcementId: string) => {
    if (!replyText.trim()) return
    try {
      setReplySubmitting(true)
      await replyToAnnouncement(announcementId, replyText.trim())
      setReplySuccess(announcementId)
      setReplyText('')
      setReplyingToId(null)
      setTimeout(() => setReplySuccess(null), 3000)
    } catch (err) {
      console.error('Failed to send reply:', err)
    } finally {
      setReplySubmitting(false)
    }
  }

  const handleDeleteAll = async () => {
    try {
      setConfirming(true)
      await deleteAllTenantNotifications(tenantId, ownerId)
      await loadNotifications(true)
      onRead?.()
    } catch (error) {
      console.error('Failed to delete all notifications:', error)
    } finally {
      setConfirming(false)
      setConfirmAction(null)
    }
  }

  return (
    <div className="gap-6 animate-fade-up flex flex-col flex-1 min-h-0">
      <div>
        <h2 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Notifications</h2>
        <p className={`text-base mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          Announcements and status updates from your apartment management
        </p>
      </div>

      {!loading && notifications.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleMarkAllRead}
            className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border ${
              isDark
                ? 'bg-[#111D32] border-[#1E293B] text-gray-200 hover:bg-[#0F1A2F]'
                : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Check className="w-4 h-4" />
            Mark all read
          </button>
          <button
            onClick={() => setConfirmAction({ type: 'all' })}
            className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border ${
              isDark
                ? 'bg-[#111D32] border-[#1E293B] text-red-300 hover:bg-[#0F1A2F]'
                : 'bg-white border-gray-200 text-red-600 hover:bg-red-50'
            }`}
          >
            <Trash2 className="w-4 h-4" />
            Delete all
          </button>
        </div>
      )}

      {loading && (
        <TableSkeleton rows={6} />
      )}

      {!loading && notifications.length === 0 && (
        <div className={`${cardClass} flex-1 flex flex-col min-h-0`}>
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Bell className="w-8 h-8 text-primary" />
            </div>
            <p className={`text-lg font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              No notifications yet
            </p>
            <p className={`text-sm mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
              You'll see announcements and request/payment updates here
            </p>
          </div>
        </div>
      )}

      {/* Notifications List */}
      <div className="space-y-4">
        {notifications.map((notification) => (
          <div key={notification.id} className={cardClass}>
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Megaphone className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {notification.title}
                </h3>
                <p className={`mt-1 text-base leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                  {notification.message}
                </p>
                <div className={`mt-3 flex items-center gap-3 text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                  <span>{notification.type.replace(/_/g, ' ')}</span>
                  <span>•</span>
                  <span>{formatDate(notification.created_at)}</span>
                </div>
                <div className="mt-3 flex items-center gap-2 flex-wrap">
                  {!notification.is_read && (
                    <button
                      onClick={() => handleMarkRead(notification.id)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium ${
                        isDark
                          ? 'bg-primary/20 text-primary hover:bg-primary/30'
                          : 'bg-primary/10 text-primary hover:bg-primary/20'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5" />
                      Mark read
                    </button>
                  )}
                  {notification.type === 'announcement_created' && notification.entity_id && (
                    <button
                      onClick={() => {
                        if (replyingToId === notification.entity_id) {
                          setReplyingToId(null)
                          setReplyText('')
                        } else {
                          setReplyingToId(notification.entity_id!)
                          setReplyText('')
                        }
                      }}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium ${
                        isDark
                          ? 'bg-blue-500/20 text-blue-300 hover:bg-blue-500/30'
                          : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                      }`}
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      {replyingToId === notification.entity_id ? 'Cancel' : 'Reply'}
                    </button>
                  )}
                  {replySuccess === notification.entity_id && (
                    <span className={`text-xs font-medium ${
                      isDark ? 'text-green-400' : 'text-green-600'
                    }`}>Reply sent!</span>
                  )}
                  <button
                    onClick={() => setConfirmAction({ type: 'one', id: notification.id })}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium ${
                      isDark
                        ? 'bg-red-500/20 text-red-300 hover:bg-red-500/30'
                        : 'bg-red-50 text-red-600 hover:bg-red-100'
                    }`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete
                  </button>
                </div>
                {replyingToId === notification.entity_id && notification.entity_id && (
                  <div className={`mt-3 p-3 rounded-lg border ${
                    isDark ? 'bg-[#0A1525] border-[#1E293B]' : 'bg-gray-50 border-gray-200'
                  }`}>
                    <textarea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value.slice(0, 500))}
                      placeholder="Write your reply to the manager/owner..."
                      rows={3}
                      className={`w-full resize-none rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 ${
                        isDark
                          ? 'bg-[#111D32] border-[#1E293B] text-white placeholder:text-gray-500'
                          : 'bg-white border-gray-300 text-gray-900 placeholder:text-gray-400'
                      }`}
                    />
                    <div className="flex items-center justify-between mt-2">
                      <span className={`text-xs ${
                        isDark ? 'text-gray-500' : 'text-gray-400'
                      }`}>{replyText.length}/500</span>
                      <button
                        onClick={() => handleReplySubmit(notification.entity_id!)}
                        disabled={replySubmitting || !replyText.trim()}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-primary text-white hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Send className="w-3.5 h-3.5" />
                        {replySubmitting ? 'Sending...' : 'Send Reply'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <ConfirmationModal
        open={Boolean(confirmAction)}
        isDark={isDark}
        title={confirmAction?.type === 'all' ? 'Delete all notifications?' : 'Delete notification?'}
        description={
          confirmAction?.type === 'all'
            ? 'This will permanently remove all notifications from your list.'
            : 'This will permanently remove this notification from your list.'
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
          handleDelete(confirmAction.id)
        }}
      />
    </div>
  )
}
