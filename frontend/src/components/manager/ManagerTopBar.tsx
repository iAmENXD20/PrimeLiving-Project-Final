import { useEffect, useState } from 'react'
import { Sun, Moon, User, Menu, Bell, Trash2 } from 'lucide-react'
import { useTheme } from '../../context/ThemeContext'
import {
  getManagerNotifications,
  markManagerNotificationRead,
  markAllManagerNotificationsRead,
  deleteManagerNotification,
  deleteAllManagerNotifications,
  type ManagerNotification,
} from '../../lib/managerApi'

interface ManagerTopBarProps {
  onMenuToggle: () => void
  managerName?: string
  managerId?: string
  clientId?: string | null
}

export default function ManagerTopBar({ onMenuToggle, managerName, managerId, clientId }: ManagerTopBarProps) {
  const { isDark, toggleTheme } = useTheme()
  const [notifications, setNotifications] = useState<ManagerNotification[]>([])
  const [notifOpen, setNotifOpen] = useState(false)

  useEffect(() => {
    if (!managerId || !clientId) return

    let mounted = true

    const loadNotifications = async () => {
      try {
        const data = await getManagerNotifications(managerId, clientId)
        if (mounted) setNotifications(data)
      } catch (error) {
        console.error('Failed to load manager notifications:', error)
      }
    }

    loadNotifications()
    const interval = setInterval(loadNotifications, 30000)
    return () => {
      mounted = false
      clearInterval(interval)
    }
  }, [managerId, clientId])

  const unreadCount = notifications.filter((notification) => !notification.is_read).length

  const handleOpenNotification = async (notification: ManagerNotification) => {
    if (!notification.is_read) {
      try {
        await markManagerNotificationRead(notification.id)
        setNotifications((prev) => prev.map((item) => (
          item.id === notification.id ? { ...item, is_read: true } : item
        )))
      } catch (error) {
        console.error('Failed to mark notification read:', error)
      }
    }
  }

  const handleMarkAllRead = async () => {
    if (!managerId) return
    try {
      await markAllManagerNotificationsRead(managerId)
      setNotifications((prev) => prev.map((item) => ({ ...item, is_read: true })))
    } catch (error) {
      console.error('Failed to mark all notifications read:', error)
    }
  }

  const handleDeleteNotification = async (id: string) => {
    try {
      await deleteManagerNotification(id)
      setNotifications((prev) => prev.filter((item) => item.id !== id))
    } catch (error) {
      console.error('Failed to delete notification:', error)
    }
  }

  const handleDeleteAll = async () => {
    if (!managerId) return
    try {
      await deleteAllManagerNotifications(managerId, clientId)
      setNotifications([])
    } catch (error) {
      console.error('Failed to delete all notifications:', error)
    }
  }

  return (
    <header
      className={`sticky top-0 z-20 h-14 flex items-center justify-between px-4 sm:px-6 border-b ${
        isDark
          ? 'bg-[#0A1628]/80 backdrop-blur-md border-[#1E293B]'
          : 'bg-white/80 backdrop-blur-md border-gray-200'
      }`}
    >
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuToggle}
          className={`lg:hidden p-2 rounded-lg transition-colors ${
            isDark ? 'text-gray-400 hover:bg-white/10' : 'text-gray-500 hover:bg-gray-100'
          }`}
        >
          <Menu className="w-5 h-5" />
        </button>
        <span
          className={`text-sm font-semibold tracking-widest uppercase ${
            isDark ? 'text-gray-400' : 'text-gray-500'
          }`}
        >
          Manager Dashboard
        </span>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative">
          <button
            onClick={() => setNotifOpen(!notifOpen)}
            className={`relative p-2 rounded-lg transition-colors ${
              isDark ? 'text-gray-300 hover:bg-white/5' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className={`absolute right-0 mt-2 w-80 rounded-xl border shadow-xl z-50 ${
              isDark ? 'bg-[#111D32] border-[#1E293B]' : 'bg-white border-gray-200'
            }`}>
              <div className={`px-4 py-3 border-b flex items-center justify-between ${isDark ? 'border-[#1E293B]' : 'border-gray-200'}`}>
                <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Notifications</p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleMarkAllRead}
                    className={`text-xs font-medium ${isDark ? 'text-primary hover:text-primary/80' : 'text-primary hover:text-primary/80'}`}
                  >
                    Mark all read
                  </button>
                  <button
                    onClick={handleDeleteAll}
                    className={`text-xs font-medium ${isDark ? 'text-red-300 hover:text-red-200' : 'text-red-600 hover:text-red-500'}`}
                  >
                    Delete all
                  </button>
                </div>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <p className={`px-4 py-6 text-sm text-center ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                    No notifications yet
                  </p>
                ) : (
                  notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`w-full text-left px-4 py-3 border-b transition-colors ${
                        isDark ? 'border-[#1E293B] hover:bg-[#0A1628]' : 'border-gray-100 hover:bg-gray-50'
                      } ${!notification.is_read ? (isDark ? 'bg-primary/10' : 'bg-primary/5') : ''}`}
                    >
                      <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{notification.title}</p>
                      <p className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{notification.message}</p>
                      <p className={`text-[11px] mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                        {new Date(notification.created_at).toLocaleString()}
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        {!notification.is_read && (
                          <button
                            onClick={() => handleOpenNotification(notification)}
                            className={`text-[11px] px-2 py-1 rounded ${
                              isDark ? 'bg-primary/20 text-primary hover:bg-primary/30' : 'bg-primary/10 text-primary hover:bg-primary/20'
                            }`}
                          >
                            Mark read
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteNotification(notification.id)}
                          className={`inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded ${
                            isDark ? 'bg-red-500/20 text-red-300 hover:bg-red-500/30' : 'bg-red-50 text-red-600 hover:bg-red-100'
                          }`}
                        >
                          <Trash2 className="w-3 h-3" />
                          Delete
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <button
          onClick={toggleTheme}
          className={`p-2 rounded-lg transition-colors ${
            isDark ? 'text-primary hover:bg-white/5' : 'text-primary-600 hover:bg-gray-100'
          }`}
        >
          {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>

        <div className="flex items-center gap-2 px-3 py-1.5">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center ${
              isDark ? 'bg-[#1E293B]' : 'bg-gray-100'
            }`}
          >
            <User className={`w-4 h-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
          </div>
          <span className={`text-sm font-medium hidden sm:block ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
            {managerName || 'Apartment Manager'}
          </span>
        </div>
      </div>
    </header>
  )
}
