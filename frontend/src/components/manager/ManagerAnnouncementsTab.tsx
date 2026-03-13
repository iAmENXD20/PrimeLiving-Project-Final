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
  managerId: string
  managerName: string
}

export default function ManagerAnnouncementsTab({ clientId, managerId, managerName }: ManagerAnnouncementsTabProps) {
  const { isDark } = useTheme()
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [smsSending, setSmsSending] = useState(false)
  const [tenants, setTenants] = useState<{ id: string; name: string; phone: string | null }[]>([])
  const [recipientMode, setRecipientMode] = useState<'all' | 'multiple' | 'specific'>('all')
  const [selectedTenantIds, setSelectedTenantIds] = useState<string[]>([])

  async function load() {
    try {
      const [announcementsResult, tenantsResult] = await Promise.allSettled([
        getAnnouncements(clientId),
        getActiveTenants(clientId, managerId),
      ])

      if (announcementsResult.status === 'fulfilled') {
        setAnnouncements(announcementsResult.value)
      }

      if (tenantsResult.status === 'fulfilled') {
        setTenants(tenantsResult.value)
      }
    } catch (err) {
      console.error('Failed to load announcements:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [clientId])

  const handleCreate = async () => {
    if (!title.trim() || !message.trim()) return

    let recipients = tenants

    if (recipientMode === 'specific') {
      recipients = tenants.filter((t) => selectedTenantIds[0] === t.id)
    }

    if (recipientMode === 'multiple') {
      recipients = tenants.filter((t) => selectedTenantIds.includes(t.id))
    }

    if (recipientMode !== 'all' && recipients.length === 0) {
      toast.error('Please select recipient tenant(s) with valid phone number')
      return
    }

    setSubmitting(true)
    try {
      await createAnnouncement(clientId, title.trim(), message.trim(), managerName)

      // Simulate SMS sending to selected recipients
      setSmsSending(true)
      try {
        const recipientsWithPhone = recipients.filter((r) => r.phone)
        const recipientsWithoutPhone = recipients.filter((r) => !r.phone)

        if (recipientsWithPhone.length > 0) {
          // Simulated SMS send (frontend-only)
          await new Promise(resolve => setTimeout(resolve, 1500))
          toast.success(`SMS sent to ${recipientsWithPhone.length} tenant(s)`, {
            description: recipientsWithPhone.map(t => t.name).join(', '),
          })
        }

        if (recipientsWithoutPhone.length > 0) {
          toast.info(`Skipped ${recipientsWithoutPhone.length} tenant(s) without phone number.`)
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
      setRecipientMode('all')
      setSelectedTenantIds([])
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

          <div className="space-y-2">
            <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              SMS Recipients
            </label>
            <div className="flex flex-wrap gap-2">
              {(['all', 'multiple', 'specific'] as const).map((mode) => (
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
                        type={recipientMode === 'specific' ? 'radio' : 'checkbox'}
                        name="specific-tenant"
                        checked={checked}
                        onChange={(e) => {
                          if (recipientMode === 'specific') {
                            setSelectedTenantIds(e.target.checked ? [tenant.id] : [])
                            return
                          }

                          if (e.target.checked) {
                            setSelectedTenantIds((prev) => [...prev, tenant.id])
                          } else {
                            setSelectedTenantIds((prev) => prev.filter((id) => id !== tenant.id))
                          }
                        }}
                      />
                      <span className={isDark ? 'text-gray-200' : 'text-gray-700'}>{tenant.name}</span>
                      <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        {tenant.phone || 'No phone'}
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
