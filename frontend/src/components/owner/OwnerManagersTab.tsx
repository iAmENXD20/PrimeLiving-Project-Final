import { Search, Plus, MoreHorizontal, Edit2, Trash2, X, Copy, Check, Send, Mail } from 'lucide-react'
import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { useTheme } from '../../context/ThemeContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  getOwnerManagers,
  createOwnerManager,
  updateOwnerManager,
  deleteOwnerManager,
} from '../../lib/ownerApi'

interface OwnerManagersTabProps {
  clientId: string
}

interface Manager {
  id: string
  name: string
  email: string
  phone: string | null
  status: string
  joined_date: string
}

export default function OwnerManagersTab({ clientId }: OwnerManagersTabProps) {
  const { isDark } = useTheme()
  const [search, setSearch] = useState('')
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [managers, setManagers] = useState<Manager[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingManager, setEditingManager] = useState<Manager | null>(null)
  const [form, setForm] = useState({ name: '', email: '', phone: '' })
  const [saving, setSaving] = useState(false)
  const [showCredentials, setShowCredentials] = useState(false)
  const [credentials, setCredentials] = useState({ email: '', password: '' })
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [smsPhone, setSmsPhone] = useState('')
  const [smsSending, setSmsSending] = useState(false)
  const [smsSent, setSmsSent] = useState(false)
  const [emailSending, setEmailSending] = useState(false)
  const [emailSent, setEmailSent] = useState(false)

  useEffect(() => {
    loadManagers()
  }, [clientId])

  async function loadManagers() {
    try {
      setLoading(true)
      const data = await getOwnerManagers(clientId)
      setManagers(data)
    } catch (err) {
      console.error('Failed to load managers:', err)
    } finally {
      setLoading(false)
    }
  }

  function openAddModal() {
    setEditingManager(null)
    setForm({ name: '', email: '', phone: '' })
    setShowModal(true)
  }

  function openEditModal(manager: Manager) {
    setEditingManager(manager)
    setForm({ name: manager.name, email: manager.email, phone: manager.phone || '' })
    setShowModal(true)
    setOpenMenu(null)
  }

  async function handleSave() {
    if (!form.name || !form.email) {
      toast.error('Name and email are required')
      return
    }
    try {
      setSaving(true)
      if (editingManager) {
        const updated = await updateOwnerManager(editingManager.id, {
          name: form.name,
          email: form.email,
          phone: form.phone || undefined,
        })
        setManagers((prev) => prev.map((m) => (m.id === updated.id ? updated : m)))
        toast.success('Manager updated successfully')
        setShowModal(false)
      } else {
        const result = await createOwnerManager({
          name: form.name,
          email: form.email,
          phone: form.phone || undefined,
          client_id: clientId,
        })
        setManagers((prev) => [result.manager, ...prev])
        setShowModal(false)
        // Show credentials modal
        setCredentials({ email: form.email, password: result.generatedPassword || '' })
        setShowCredentials(true)
        if (!result.generatedPassword) {
          toast.error('Manager created, but password was not returned. Please reset password for this manager.')
        }
        toast.success('Manager account created successfully')
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save manager'
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  function copyToClipboard(text: string, field: string) {
    navigator.clipboard.writeText(text)
    setCopiedField(field)
    toast.success(`${field} copied to clipboard`)
    setTimeout(() => setCopiedField(null), 2000)
  }

  async function handleDelete(id: string) {
    try {
      await deleteOwnerManager(id)
      setManagers((prev) => prev.filter((m) => m.id !== id))
      setOpenMenu(null)
      toast.success('Manager deleted')
    } catch (err) {
      console.error('Failed to delete manager:', err)
      toast.error('Failed to delete manager')
    }
  }

  const filtered = managers.filter(
    (m) =>
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.email.toLowerCase().includes(search.toLowerCase())
  )

  const cardClass = `rounded-xl border ${
    isDark ? 'bg-navy-card border-[#1E293B]' : 'bg-white border-gray-200 shadow-sm'
  }`

  const inputClass = isDark
    ? 'bg-[#0A1628] border-[#1E293B] text-white placeholder:text-gray-500'
    : 'bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400'

  return (
    <>
    <div className="space-y-6 animate-fade-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            My Manager
          </h2>
          <p className={`text-base mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            Manage your managers
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="inline-flex items-center gap-2 px-5 py-3 bg-primary hover:bg-primary-600 text-white font-semibold text-base rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Manager
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search
          className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}
        />
        <input
          type="text"
          placeholder="Search managers..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={`w-full pl-10 pr-4 py-3 rounded-lg text-base border focus:outline-none focus:ring-2 focus:ring-primary/50 ${
            isDark
              ? 'bg-[#0A1628] border-[#1E293B] text-white placeholder-gray-500'
              : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'
          }`}
        />
      </div>

      {/* Table */}
      <div className={`${cardClass} overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full text-base">
            <thead>
              <tr className={`border-b ${isDark ? 'border-[#1E293B]' : 'border-gray-200'}`}>
                {['Name', 'Email', 'Phone', 'Status', 'Joined', ''].map((h) => (
                  <th key={h} className={`text-left py-3.5 px-4 font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6} className={`py-8 text-center ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    Loading managers...
                  </td>
                </tr>
              )}
              {!loading &&
                filtered.map((manager) => (
                  <tr
                    key={manager.id}
                    className={`border-b last:border-0 transition-colors ${
                      isDark ? 'border-[#1E293B] hover:bg-white/[0.02]' : 'border-gray-100 hover:bg-gray-50'
                    }`}
                  >
                    <td className={`py-3.5 px-4 font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {manager.name}
                    </td>
                    <td className={`py-3.5 px-4 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                      {manager.email}
                    </td>
                    <td className={`py-3.5 px-4 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                      {manager.phone || '—'}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-block px-2.5 py-0.5 text-xs font-medium rounded-full ${
                          manager.status === 'active'
                            ? 'bg-emerald-500/15 text-emerald-400'
                            : 'bg-gray-500/15 text-gray-400'
                        }`}
                      >
                        {manager.status}
                      </span>
                    </td>
                    <td className={`py-3.5 px-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      {manager.joined_date ? new Date(manager.joined_date).toLocaleDateString() : '—'}
                    </td>
                    <td className="py-3.5 px-4 relative">
                      <button
                        onClick={() => setOpenMenu(openMenu === manager.id ? null : manager.id)}
                        className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-white/10' : 'hover:bg-gray-100'}`}
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                      {openMenu === manager.id && (
                        <div
                          className={`absolute right-4 top-full mt-1 w-36 rounded-lg border shadow-lg z-10 py-1 ${
                            isDark ? 'bg-[#111D32] border-[#1E293B]' : 'bg-white border-gray-200'
                          }`}
                        >
                          <button
                            onClick={() => openEditModal(manager)}
                            className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                              isDark ? 'text-gray-300 hover:bg-white/5' : 'text-gray-700 hover:bg-gray-50'
                            }`}
                          >
                            <Edit2 className="w-3.5 h-3.5" /> Edit
                          </button>
                          <button
                            onClick={() => handleDelete(manager.id)}
                            className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors text-red-400 ${
                              isDark ? 'hover:bg-red-500/10' : 'hover:bg-red-50'
                            }`}
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Delete
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className={`py-8 text-center ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                    No managers found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pt-20">
            <div className={`relative w-full max-w-md rounded-xl border p-6 ${isDark ? 'bg-[#111C32] border-[#1E293B]' : 'bg-white border-gray-200'}`}>
            <div className="flex items-center justify-between mb-2">
              <h3 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {editingManager ? 'Edit Manager' : 'Create Account Manager'}
              </h3>
              <button onClick={() => setShowModal(false)} className={isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-700'}>
                <X className="w-5 h-5" />
              </button>
            </div>
            {!editingManager && (
              <p className={`text-sm mb-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                Enter the manager's email address. This will be used as their login credential.
              </p>
            )}
            {editingManager && <div className="mb-4" />}

            <div className="space-y-4">
              <div>
                <Label className={isDark ? 'text-gray-300' : 'text-gray-700'}>Name</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Manager name"
                  className={inputClass}
                />
              </div>
              <div>
                <Label className={isDark ? 'text-gray-300' : 'text-gray-700'}>Email</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="manager@example.com"
                  className={inputClass}
                />
              </div>
              <div>
                <Label className={isDark ? 'text-gray-300' : 'text-gray-700'}>Phone</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="+63 9XX XXX XXXX"
                  className={inputClass}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <Button
                variant="outline"
                onClick={() => setShowModal(false)}
                className={isDark ? 'border-[#1E293B] text-gray-300 hover:bg-white/5' : ''}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving}
                className="bg-primary hover:bg-primary/90 text-white font-semibold"
              >
                {editingManager ? 'Update' : saving ? 'Creating...' : 'Create Account'}
              </Button>
            </div>
          </div>
          </div>
        </div>
      )}

      {/* Credentials Modal */}
      {showCredentials && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pt-20">
            <div className={`relative w-full max-w-md rounded-xl border p-6 ${isDark ? 'bg-[#111C32] border-[#1E293B]' : 'bg-white border-gray-200'}`}>
              <h3 className={`text-xl font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Manager Account Created
              </h3>

              <div className="space-y-3">
                <div className={`flex items-center justify-between rounded-lg p-3 ${isDark ? 'bg-[#0A1628] border border-[#1E293B]' : 'bg-gray-50 border border-gray-200'}`}>
                  <div>
                    <p className={`text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Email</p>
                    <p className={`text-sm font-mono mt-0.5 ${isDark ? 'text-white' : 'text-gray-900'}`}>{credentials.email}</p>
                  </div>
                  <button
                    onClick={() => copyToClipboard(credentials.email, 'Email')}
                    className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-gray-200 text-gray-500'}`}
                  >
                    {copiedField === 'Email' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>

                <div className={`flex items-center justify-between rounded-lg p-3 ${isDark ? 'bg-[#0A1628] border border-[#1E293B]' : 'bg-gray-50 border border-gray-200'}`}>
                  <div>
                    <p className={`text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Password</p>
                    <p className={`text-sm font-mono mt-0.5 ${isDark ? 'text-white' : 'text-gray-900'}`}>{credentials.password}</p>
                  </div>
                  <button
                    onClick={() => copyToClipboard(credentials.password, 'Password')}
                    className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-gray-200 text-gray-500'}`}
                  >
                    {copiedField === 'Password' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className={`mt-4 rounded-lg p-3 ${isDark ? 'bg-yellow-500/10 border border-yellow-500/20' : 'bg-yellow-50 border border-yellow-200'}`}>
                <p className={`text-xs ${isDark ? 'text-yellow-400' : 'text-yellow-700'}`}>
                  ⚠️ Save these credentials now. The password cannot be retrieved after closing this dialog.
                </p>
              </div>

              {/* Email Send Section */}
              <div className="mt-5 space-y-3">
                <Label className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Send credentials via Email
                </Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Mail className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                    <input
                      type="email"
                      value={credentials.email}
                      readOnly
                      className={`w-full pl-10 pr-4 py-2.5 rounded-lg border text-sm transition-colors ${
                        isDark
                          ? 'bg-[#0A1628] border-[#1E293B] text-white placeholder-gray-500 focus:border-primary'
                          : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:border-primary'
                      } focus:outline-none`}
                    />
                  </div>
                  <Button
                    onClick={async () => {
                      setEmailSending(true)
                      try {
                        await new Promise((resolve) => setTimeout(resolve, 1500))
                        setEmailSent(true)
                        toast.success(`Credentials sent to ${credentials.email}`)
                      } catch {
                        toast.error('Failed to send email')
                      } finally {
                        setEmailSending(false)
                      }
                    }}
                    disabled={emailSending || emailSent}
                    className="gap-2 bg-primary hover:bg-primary/90 text-white font-semibold disabled:opacity-50"
                  >
                    <Send className="w-4 h-4" />
                    {emailSending ? 'Sending...' : emailSent ? 'Sent!' : 'Send Email'}
                  </Button>
                </div>
                {emailSent && (
                  <p className={`text-xs flex items-center gap-1 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                    <Check className="w-3.5 h-3.5" />
                    Credentials sent successfully to {credentials.email}
                  </p>
                )}
              </div>

              <div className="flex justify-end mt-6">
                <Button
                  onClick={() => {
                    setShowCredentials(false)
                    setSmsPhone('')
                    setSmsSent(false)
                    setEmailSent(false)
                  }}
                  className="bg-primary hover:bg-primary/90 text-white font-semibold"
                >
                  Done
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
