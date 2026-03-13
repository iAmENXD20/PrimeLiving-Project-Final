import { useEffect, useState } from 'react'
import { Bell, Megaphone } from 'lucide-react'
import { useTheme } from '../../context/ThemeContext'
import { getTenantAnnouncements, markNotificationsAsRead, type TenantAnnouncement } from '../../lib/tenantApi'

interface TenantNotificationsTabProps {
  clientId: string | null
  onRead?: () => void
}

export default function TenantNotificationsTab({ clientId, onRead }: TenantNotificationsTabProps) {
  const { isDark } = useTheme()
  const [announcements, setAnnouncements] = useState<TenantAnnouncement[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      if (!clientId) {
        setLoading(false)
        return
      }
      try {
        const data = await getTenantAnnouncements(clientId)
        setAnnouncements(data)

        // Mark all as read when viewing
        if (data.length > 0) {
          markNotificationsAsRead(data.map(a => a.id))
          onRead?.()
        }
      } catch (err) {
        console.error('Failed to load notifications:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [clientId])

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

  return (
    <div className="gap-6 animate-fade-up flex flex-col flex-1 min-h-0">
      <div>
        <h2 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Notifications</h2>
        <p className={`text-base mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          Announcements and updates from your apartment management
        </p>
      </div>

      {loading && (
        <div className={`text-center py-8 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          Loading notifications...
        </div>
      )}

      {!loading && announcements.length === 0 && (
        <div className={`${cardClass} flex-1 flex flex-col min-h-0`}>
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Bell className="w-8 h-8 text-primary" />
            </div>
            <p className={`text-lg font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              No notifications yet
            </p>
            <p className={`text-sm mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
              You'll see announcements from your apartment management here
            </p>
          </div>
        </div>
      )}

      {/* Announcements List */}
      <div className="space-y-4">
        {announcements.map((a) => (
          <div key={a.id} className={cardClass}>
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Megaphone className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {a.title}
                </h3>
                <p className={`mt-1 text-base leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                  {a.message}
                </p>
                <div className={`mt-3 flex items-center gap-3 text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                  <span>By {a.created_by}</span>
                  <span>•</span>
                  <span>{formatDate(a.created_at)}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
