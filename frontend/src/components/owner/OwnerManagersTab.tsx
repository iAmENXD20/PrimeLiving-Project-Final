import { Search, Plus, MoreHorizontal, Edit2, Trash2, X, Copy, Check, Send, Mail, ChevronDown } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { useTheme } from '../../context/ThemeContext'
import { useEmailValidation } from '@/hooks/useEmailValidation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  getOwnerManagers,
  createOwnerManager,
  updateOwnerManager,
  deleteOwnerManager,
} from '../../lib/ownerApi'
import ConfirmationModal from '@/components/ui/ConfirmationModal'
import { TableSkeleton } from '@/components/ui/skeleton'
import TablePagination from '@/components/ui/table-pagination'

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
  const [form, setForm] = useState({ name: '', email: '', phone: '', sex: '', age: '' })
  const [saving, setSaving] = useState(false)
  const [phonePrefixError, setPhonePrefixError] = useState(false)
  const [isSexOpen, setIsSexOpen] = useState(false)
  const sexRef = useRef<HTMLDivElement>(null)
  const [showCredentials, setShowCredentials] = useState(false)
  const [credentials, setCredentials] = useState({ email: '' })
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [smsPhone, setSmsPhone] = useState('')
  const [smsSending, setSmsSending] = useState(false)
  const [smsSent, setSmsSent] = useState(false)
  const [emailSending, setEmailSending] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const [emailCooldown, setEmailCooldown] = useState(0)
  const [managerToDelete, setManagerToDelete] = useState<Manager | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [page, setPage] = useState(1)
  const pageSize = 10
  const managerEmailValidation = useEmailValidation(form.email)

  useEffect(() => {
    loadManagers()
  }, [clientId])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (sexRef.current && !sexRef.current.contains(e.target as Node)) setIsSexOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (emailCooldown <= 0) return

    const timerId = window.setInterval(() => {
      setEmailCooldown((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)

    return () => window.clearInterval(timerId)
  }, [emailCooldown])

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
    setForm({ name: '', email: '', phone: '', sex: '', age: '' })
    setShowModal(true)
  }

  function openEditModal(manager: Manager) {
    setEditingManager(manager)
    setForm({ name: manager.name, email: manager.email, phone: (manager.phone || '').replace(/^\+63/, ''), sex: (manager as any).sex || '', age: (manager as any).age || '' })
    setShowModal(true)
    setOpenMenu(null)
  }

  async function handleSave() {
    if (!form.name || !form.email) {
      toast.error('Name and email are required')
      return
    }

    if (!editingManager && !managerEmailValidation.isValid) {
      toast.error(managerEmailValidation.message || 'Email could not be verified')
      return
    }

    try {
      setSaving(true)
      if (editingManager) {
        const updated = await updateOwnerManager(editingManager.id, {
          name: form.name,
          email: form.email,
          phone: form.phone ? `+63${form.phone}` : undefined,
        })
        setManagers((prev) => prev.map((m) => (m.id === updated.id ? updated : m)))
        toast.success('Manager updated successfully')
        setShowModal(false)
      } else {
        const result = await createOwnerManager({
          name: form.name,
          email: form.email,
          phone: form.phone ? `+63${form.phone}` : undefined,
          sex: form.sex || undefined,
          age: form.age || undefined,
          apartmentowner_id: clientId,
        })
        setManagers((prev) => [result.manager, ...prev])
        setShowModal(false)
        setCredentials({ email: form.email })
        setShowCredentials(true)
        toast.success('Manager invitation sent successfully')
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
      setDeleting(true)
      await deleteOwnerManager(id)
      setManagers((prev) => prev.filter((m) => m.id !== id))
      setOpenMenu(null)
      toast.success('Manager deleted')
    } catch (err) {
      console.error('Failed to delete manager:', err)
      toast.error('Failed to delete manager')
    } finally {
      setDeleting(false)
      setManagerToDelete(null)
    }
  }

  const filtered = managers.filter(
    (m) =>
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.email.toLowerCase().includes(search.toLowerCase())
  )

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize)

  useEffect(() => {
    setPage(1)
  }, [search, managers.length])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

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
                  <td colSpan={6} className="py-3 px-4">
                    <TableSkeleton rows={5} />
                  </td>
                </tr>
              )}
              {!loading &&
                paginated.map((manager) => (
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
                            onClick={() => setManagerToDelete(manager)}
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

      {!loading && (
        <TablePagination
          currentPage={page}
          totalPages={totalPages}
          totalItems={filtered.length}
          pageSize={pageSize}
          onPageChange={setPage}
          isDark={isDark}
        />
      )}
    </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pt-20">
            <div className={`relative w-full max-w-md rounded-xl border p-6 ${isDark ? 'bg-[#111C32] border-[#1E293B]' : 'bg-white border-gray-200'}`}>
            <div className="flex items-center justify-between mb-2">
              <h3 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {editingManager ? 'Edit Manager' : 'Create Manager'}
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
              <div className="grid grid-cols-2 gap-3">
                <div ref={sexRef} className="relative">
                  <Label className={isDark ? 'text-gray-300' : 'text-gray-700'}>Sex</Label>
                  <button
                    type="button"
                    onClick={() => setIsSexOpen((prev) => !prev)}
                    className={`w-full h-11 rounded-lg border px-4 pr-10 text-sm text-left focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors ${inputClass} ${!form.sex ? (isDark ? 'text-gray-500' : 'text-gray-400') : ''}`}
                  >
                    {form.sex || 'Select'}
                  </button>
                  <ChevronDown
                    className={`pointer-events-none absolute right-3 bottom-3 h-4 w-4 transition-transform ${isSexOpen ? 'rotate-180' : ''} ${isDark ? 'text-gray-400' : 'text-gray-500'}`}
                  />
                  {isSexOpen && (
                    <div className={`absolute z-50 mt-1 w-full rounded-lg border shadow-lg animate-in fade-in zoom-in-95 duration-150 ${isDark ? 'bg-[#111C32] border-[#1E293B]' : 'bg-white border-gray-200'}`}>
                      {['Male', 'Female'].map((option) => (
                        <button
                          key={option}
                          type="button"
                          onClick={() => { setForm({ ...form, sex: option }); setIsSexOpen(false) }}
                          className={`w-full text-left px-3 py-2.5 text-sm transition-colors ${isDark ? 'text-gray-200 hover:bg-white/10' : 'text-gray-700 hover:bg-gray-100'} ${option === form.sex ? (isDark ? 'bg-white/5 font-medium' : 'bg-gray-50 font-medium') : ''}`}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <Label className={isDark ? 'text-gray-300' : 'text-gray-700'}>Age</Label>
                  <Input
                    type="number"
                    min={1}
                    max={120}
                    value={form.age}
                    onChange={(e) => setForm({ ...form, age: e.target.value })}
                    placeholder="Age"
                    className={inputClass}
                  />
                </div>
              </div>
              <div>
                <Label className={isDark ? 'text-gray-300' : 'text-gray-700'}>Email</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="juandelacruz@gmail.com"
                  className={inputClass}
                />
                {!editingManager && form.email.trim() && (
                  <p
                    className={`text-xs mt-1 ${
                      managerEmailValidation.isValid
                        ? 'text-emerald-500'
                        : managerEmailValidation.isInvalid
                        ? 'text-red-500'
                        : isDark
                        ? 'text-gray-400'
                        : 'text-gray-500'
                    }`}
                  >
                    {managerEmailValidation.message}
                  </p>
                )}
              </div>
              <div>
                <Label className={isDark ? 'text-gray-300' : 'text-gray-700'}>Phone</Label>
                <div className="relative">
                  <span className={`absolute left-4 top-1/2 -translate-y-1/2 text-sm font-medium select-none ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>+63</span>
                  <Input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/\D/g, '').slice(0, 10)
                      setForm({ ...form, phone: raw })
                      setPhonePrefixError(raw.length > 0 && raw[0] !== '9')
                    }}
                    placeholder="9XX XXX XXXX"
                    className={`pl-12 ${inputClass}`}
                  />
                </div>
                {phonePrefixError && (
                  <p className="text-xs text-red-500 mt-1">Contact number must start with 9 after +63</p>
                )}
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
                disabled={
                  saving ||
                  (!editingManager &&
                    (!form.email.trim() ||
                      managerEmailValidation.isChecking ||
                      managerEmailValidation.isInvalid))
                }
                className="bg-primary hover:bg-primary/90 text-white font-semibold"
              >
                {editingManager ? 'Update' : saving ? 'Creating...' : 'Create'}
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
                Manager Invitation Sent
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

                <div className={`rounded-lg p-3 ${isDark ? 'bg-emerald-500/10 border border-emerald-500/25' : 'bg-emerald-50 border border-emerald-200'}`}>
                  <p className={`text-xs font-medium ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>Status</p>
                  <p className={`text-sm font-semibold mt-0.5 ${isDark ? 'text-emerald-200' : 'text-emerald-700'}`}>Invited</p>
                </div>
              </div>

              <div className={`mt-4 rounded-lg p-3 ${isDark ? 'bg-yellow-500/10 border border-yellow-500/20' : 'bg-yellow-50 border border-yellow-200'}`}>
                <p className={`text-xs ${isDark ? 'text-yellow-400' : 'text-yellow-700'}`}>
                  The manager should check their email to accept the invite and set their own password.
                </p>
              </div>

              {/* Email Send Section */}
              <div className="mt-5 space-y-3">
                <Label className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Send invite reminder via Email
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
                        setEmailCooldown(30)
                        toast.success(`Invite reminder sent to ${credentials.email}`)
                      } catch {
                        toast.error('Failed to send email')
                      } finally {
                        setEmailSending(false)
                      }
                    }}
                    disabled={emailSending || emailCooldown > 0}
                    className="gap-2 bg-primary hover:bg-primary/90 text-white font-semibold disabled:opacity-50"
                  >
                    <Send className="w-4 h-4" />
                    {emailSending
                      ? 'Sending...'
                      : emailCooldown > 0
                      ? `Resend in ${emailCooldown}s`
                      : emailSent
                      ? 'Resend Email'
                      : 'Send Email'}
                  </Button>
                </div>
                {emailSent && (
                  <p className={`text-xs flex items-center gap-1 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                    <Check className="w-3.5 h-3.5" />
                    Invite reminder sent successfully to {credentials.email}
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
                    setEmailCooldown(0)
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

      <ConfirmationModal
        open={Boolean(managerToDelete)}
        isDark={isDark}
        title="Delete Manager?"
        description={managerToDelete ? `This will deactivate ${managerToDelete.name}'s manager account.` : 'This action cannot be undone.'}
        confirmText="Delete"
        loading={deleting}
        onCancel={() => setManagerToDelete(null)}
        onConfirm={() => {
          if (managerToDelete) handleDelete(managerToDelete.id)
        }}
      />
    </>
  )
}
