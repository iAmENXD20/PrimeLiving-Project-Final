import { useEffect, useState } from 'react'
import { Plus, Trash2, Megaphone } from 'lucide-react'
import { useTheme } from '../../context/ThemeContext'
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription'
import {
  getOwnerAnnouncements,
  createOwnerAnnouncement,
  deleteOwnerAnnouncement,
  type Announcement,
} from '../../lib/ownerApi'
import { toast } from 'sonner'
import ConfirmationModal from '@/components/ui/ConfirmationModal'
import { TableSkeleton } from '@/components/ui/skeleton'

interface OwnerAnnouncementsTabProps {
  ownerId: string
  ownerName: string
}

export default function OwnerAnnouncementsTab({ ownerId, ownerName }: OwnerAnnouncementsTabProps) {
  const { isDark } = useTheme()
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [announcementToDelete, setAnnouncementToDelete] = useState<Announcement | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function load() {
    try {
      const data = await getOwnerAnnouncements(ownerId)
      setAnnouncements(data)
    } catch (err) {
      console.error('Failed to load announcements:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [ownerId])

  // Real-time: auto-refresh when announcements change
  useRealtimeSubscription(`owner-announcements-${ownerId}`, [
    { table: 'announcements', filter: `apartmentowner_id=eq.${ownerId}`, onChanged: () => load() },
  ])

  const handleCreate = async () => {
    if (!title.trim() || !message.trim()) return
    setSubmitting(true)
    try {
      const createdAnnouncement = await createOwnerAnnouncement(ownerId, title.trim(), message.trim(), ownerName)
      toast.success('Announcement created')
      await load()
      setTitle('')
      setMessage('')
      setShowForm(false)
    } catch {
      toast.error('Failed to create announcement')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      setDeleting(true)
      await deleteOwnerAnnouncement(id)
      toast.success('Announcement deleted')
      await load()
    } catch {
      toast.error('Failed to delete announcement')
    } finally {
      setDeleting(false)
      setAnnouncementToDelete(null)
    }
  }

  const cardClass = `rounded-xl border ${isDark ? 'bg-navy-card border-[#1E293B]' : 'bg-white border-gray-200 shadow-sm'}`

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Announcements</h2>
          <p className={`text-base mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            Create and manage announcements for tenants
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Announcement
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
          {(title.trim() || message.trim()) && (() => {
            const smsLength = `${title}\n\n${message}`.length
            const isOver = smsLength > 160
            return (
              <p className={`text-xs mt-1 ${isOver ? 'text-amber-500' : isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                SMS preview: {smsLength}/160 characters{isOver && ' (will be truncated)'}
              </p>
            )
          })()}
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
              disabled={submitting || !title.trim() || !message.trim()}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              {submitting && (
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                  <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" className="opacity-90" />
                </svg>
              )}
              {submitting ? 'Posting...' : 'Post Announcement'}
            </button>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <TableSkeleton rows={5} />
      )}

      {/* Empty state */}
      {!loading && announcements.length === 0 && (
        <div className={`${cardClass} p-12 text-center`}>
          <Megaphone className={`w-12 h-12 mx-auto mb-3 ${isDark ? 'text-gray-600' : 'text-gray-300'}`} />
          <p className={`text-lg font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>No announcements yet</p>
          <p className={`text-sm mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Create one to notify tenants</p>
        </div>
      )}

      {/* List */}
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
              onClick={() => setAnnouncementToDelete(a)}
              className={`p-2 rounded-lg transition-colors ${
                isDark ? 'text-gray-500 hover:text-red-400 hover:bg-red-500/10' : 'text-gray-400 hover:text-red-500 hover:bg-red-50'
              }`}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}

      <ConfirmationModal
        open={Boolean(announcementToDelete)}
        isDark={isDark}
        title="Delete Announcement?"
        description={announcementToDelete ? `This will permanently delete “${announcementToDelete.title}”.` : 'This action cannot be undone.'}
        confirmText="Delete"
        loading={deleting}
        onCancel={() => setAnnouncementToDelete(null)}
        onConfirm={() => {
          if (announcementToDelete) handleDelete(announcementToDelete.id)
        }}
      />
    </div>
  )
}
