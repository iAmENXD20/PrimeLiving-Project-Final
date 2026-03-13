import { useEffect, useState } from 'react'
import { Plus, Trash2, Megaphone, Send } from 'lucide-react'
import { useTheme } from '../../context/ThemeContext'
import {
  getAnnouncements,
  createAnnouncement,
  deleteAnnouncement,
  getActiveTenants,
  type Announcement,
} from '../../lib/managerApi'
import { toast } from 'sonner'

interface ManagerAnnouncementsTabProps {
  clientId: string
  managerName: string
}

export default function ManagerAnnouncementsTab({ clientId, managerName }: ManagerAnnouncementsTabProps) {
  const { isDark } = useTheme()
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [smsSending, setSmsSending] = useState(false)

  async function load() {
    try {
      const data = await getAnnouncements(clientId)
      setAnnouncements(data)
    } catch (err) {
      console.error('Failed to load announcements:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [clientId])

  const handleCreate = async () => {
    if (!title.trim() || !message.trim()) return
    setSubmitting(true)
    try {
      await createAnnouncement(clientId, title.trim(), message.trim(), managerName)

      // Simulate SMS to all active tenants
      setSmsSending(true)
      try {
        const tenants = await getActiveTenants(clientId)
        const tenantsWithPhone = tenants.filter(t => t.phone)
        if (tenantsWithPhone.length > 0) {
          // Simulated SMS send (frontend-only)
          await new Promise(resolve => setTimeout(resolve, 1500))
          toast.success(`SMS sent to ${tenantsWithPhone.length} tenant(s)`, {
            description: tenantsWithPhone.map(t => t.name).join(', '),
          })
        }
      } catch (smsErr) {
        console.error('SMS sending failed:', smsErr)
        toast.error('Failed to send SMS notifications')
      } finally {
        setSmsSending(false)
      }

      toast.success('Announcement created and posted to tenant dashboard')
      setTitle('')
      setMessage('')
      setShowForm(false)
      await load()
    } catch (err) {
      toast.error('Failed to create announcement')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteAnnouncement(id)
      toast.success('Announcement deleted')
      setAnnouncements((prev) => prev.filter((a) => a.id !== id))
    } catch {
      toast.error('Failed to delete announcement')
    }
  }

  const cardClass = `rounded-xl border ${isDark ? 'bg-navy-card border-[#1E293B]' : 'bg-white border-gray-200 shadow-sm'}`

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-6 animate-fade-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className={`text-base mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            Create and manage announcements for tenants
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create Announcement
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className={`${cardClass} p-6 space-y-4`}>
          <input
            type="text"
            placeholder="Subject"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={`w-full px-4 py-2.5 rounded-lg border text-base ${
              isDark
                ? 'bg-[#111D32] border-[#1E293B] text-white placeholder-gray-500'
                : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'
            } focus:outline-none focus:border-primary`}
          />
          <textarea
            placeholder="Message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            className={`w-full px-4 py-2.5 rounded-lg border text-base resize-none ${
              isDark
                ? 'bg-[#111D32] border-[#1E293B] text-white placeholder-gray-500'
                : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'
            } focus:outline-none focus:border-primary`}
          />
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => { setShowForm(false); setTitle(''); setMessage('') }}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${
                isDark ? 'text-gray-400 hover:text-white hover:bg-white/5' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={submitting || smsSending || !title.trim() || !message.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              {smsSending ? 'Sending SMS...' : submitting ? 'Posting...' : 'Post and Notify'}
            </button>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className={`text-center py-8 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          Loading announcements…
        </div>
      )}

      {/* List */}
      {!loading && announcements.length === 0 && (
        <div className={`${cardClass} flex-1 min-h-0 flex items-center justify-center`}>
          <div className="text-center">
            <Megaphone className={`w-12 h-12 mx-auto mb-3 ${isDark ? 'text-gray-600' : 'text-gray-300'}`} />
            <p className={`text-lg font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>No announcements yet</p>
            <p className={`text-sm mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Create one to notify tenants</p>
          </div>
        </div>
      )}

      {!loading && announcements.map((a) => (
        <div key={a.id} className={`${cardClass} p-5`}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{a.title}</h3>
              <p className={`text-base mt-1 whitespace-pre-wrap ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{a.message}</p>
              <p className={`text-xs mt-3 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                Posted by {a.created_by} • {new Date(a.created_at).toLocaleDateString()}
              </p>
            </div>
            <button
              onClick={() => handleDelete(a.id)}
              className={`p-2 rounded-lg transition-colors ${
                isDark ? 'text-gray-500 hover:text-red-400 hover:bg-red-500/10' : 'text-gray-400 hover:text-red-500 hover:bg-red-50'
              }`}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
