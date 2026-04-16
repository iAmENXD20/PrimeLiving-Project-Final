import { useEffect, useRef, useState } from 'react'
import { Plus, Trash2, Megaphone, Send } from 'lucide-react'
import { useTheme } from '../../context/ThemeContext'
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription'
import { formatPhone } from '@/lib/utils'
import {
  getAnnouncements,
  createAnnouncement,
  deleteAnnouncement,
  getActiveTenants,
  getManagedApartments,
  type Announcement,
} from '../../lib/managerApi'
import { toast } from 'sonner'
import ConfirmationModal from '@/components/ui/ConfirmationModal'
import { TableSkeleton } from '@/components/ui/skeleton'

interface ManagerAnnouncementsTabProps {
  managerId: string
  managerName: string
  ownerId?: string
}

export default function ManagerAnnouncementsTab({ managerId, managerName, ownerId }: ManagerAnnouncementsTabProps) {
  const { isDark } = useTheme()
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [smsSending, setSmsSending] = useState(false)
  const [tenants, setTenants] = useState<{ id: string; name: string; phone: string | null; unit_name?: string | null }[]>([])
  const [recipientMode, setRecipientMode] = useState<'all' | 'multiple'>('all')
  const [selectedTenantIds, setSelectedTenantIds] = useState<string[]>([])
  const [announcementToDelete, setAnnouncementToDelete] = useState<Announcement | null>(null)
  const [deleting, setDeleting] = useState(false)
  const ownerIdRef = useRef<string | null>(null)

  async function load() {
    try {
      const [announcementsResult, tenantsResult, apartments] = await Promise.allSettled([
        getAnnouncements(managerId),
        getActiveTenants(managerId),
        getManagedApartments(managerId),
      ])

      if (announcementsResult.status === 'fulfilled') {
        setAnnouncements(announcementsResult.value)
      }

      if (tenantsResult.status === 'fulfilled') {
        setTenants(tenantsResult.value)
      }

      if (apartments.status === 'fulfilled' && apartments.value?.[0]?.apartmentowner_id) {
        ownerIdRef.current = apartments.value[0].apartmentowner_id
      }
    } catch (err) {
      console.error('Failed to load announcements:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [managerId])

  // Real-time: auto-refresh when announcements change
  useRealtimeSubscription(`mgr-announcements-${managerId}`, [
    { table: 'announcements', ...(ownerId ? { filter: `apartmentowner_id=eq.${ownerId}` } : {}), onChanged: () => load() },
  ])

  const handleCreate = async () => {
    if (!title.trim() || !message.trim()) return

    let recipients = tenants

    if (recipientMode === 'multiple') {
      recipients = tenants.filter((t) => selectedTenantIds.includes(t.id))
    }

    if (recipientMode !== 'all' && recipients.length === 0) {
      toast.error('Please select at least one tenant recipient')
      return
    }

    setSubmitting(true)
    try {
      const recipientTenantIds = recipientMode === 'all' ? [] : selectedTenantIds
      const createdAnnouncement = await createAnnouncement(
        ownerIdRef.current || '',
        title.trim(),
        message.trim(),
        managerName,
        recipientTenantIds,
      )

      toast.success('Announcement created and SMS sent to tenants with phone numbers')
      await load()
      setTitle('')
      setMessage('')
      setRecipientMode('all')
      setSelectedTenantIds([])
      setShowForm(false)
    } catch (err) {
      toast.error('Failed to create announcement')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string | null) => {
    if (!id) {
      toast.error('This announcement is not yet persisted. Please refresh and try again.')
      return
    }
    try {
      setDeleting(true)
      await deleteAnnouncement(id)
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

  const getAnnouncementAudienceLabel = (announcement: Announcement) => {
    const recipientIds = announcement.recipient_tenant_ids || []

    if (recipientIds.length === 0) {
      return 'Sent to all tenants'
    }

    const recipientDetails = recipientIds
      .map((recipientId) => tenants.find((tenant) => tenant.id === recipientId))
      .filter(Boolean)
      .map((tenant) => {
        const unitName = tenant?.unit_name?.trim()
        return unitName ? `${tenant?.first_name} ${tenant?.last_name} (${unitName})` : `${tenant?.first_name} ${tenant?.last_name}`
      })

    if (recipientDetails.length === 0) {
      return `Sent to ${recipientIds.length} selected tenant${recipientIds.length > 1 ? 's' : ''}`
    }

    return `Sent to: ${recipientDetails.join(', ')}`
  }

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
          {(title.trim() || message.trim()) && (() => {
            const smsLength = `${title}\n\n${message}`.length
            const isOver = smsLength > 160
            return (
              <p className={`text-xs mt-1 ${isOver ? 'text-amber-500' : isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                SMS preview: {smsLength}/160 characters{isOver && ' (will be truncated)'}
              </p>
            )
          })()}

          <div className="space-y-2">
            <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              Select the tenants to notify
            </label>
            <div className="flex flex-wrap gap-2">
              {(['all', 'multiple'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => {
                    setRecipientMode(mode)
                    setSelectedTenantIds([])
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                    recipientMode === mode
                      ? 'bg-primary text-white'
                      : isDark
                      ? 'bg-[#111D32] text-gray-300 border border-[#1E293B] hover:bg-[#1A2A44]'
                      : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>

            {recipientMode !== 'all' && (
              <div className={`max-h-36 overflow-y-auto rounded-lg border p-2 space-y-2 ${isDark ? 'border-[#1E293B] bg-[#111D32]' : 'border-gray-200 bg-gray-50'}`}>
                {tenants.length === 0 && (
                  <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                    No tenants found.
                  </p>
                )}

                {tenants.map((tenant) => {
                  const checked = selectedTenantIds.includes(tenant.id)
                  return (
                    <label key={tenant.id} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedTenantIds((prev) => [...prev, tenant.id])
                          } else {
                            setSelectedTenantIds((prev) => prev.filter((id) => id !== tenant.id))
                          }
                        }}
                      />
                      <span className={isDark ? 'text-gray-200' : 'text-gray-700'}>{tenant.first_name} {tenant.last_name}</span>
                      {tenant.unit_name && (
                        <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                          ({tenant.unit_name})
                        </span>
                      )}
                      <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        {formatPhone(tenant.phone) || 'No phone'}
                      </span>
                    </label>
                  )
                })}
              </div>
            )}
          </div>

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
        <TableSkeleton rows={5} />
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
              <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                {getAnnouncementAudienceLabel(a)}
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
        description={announcementToDelete ? `This will permanently delete “${announcementToDelete.title}”.` : 'This will permanently delete this announcement.'}
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
