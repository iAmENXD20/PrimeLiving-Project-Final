import { Search, Plus, MoreHorizontal, Edit2, Trash2, Copy, Check, Eye } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { useTheme } from '../../context/ThemeContext'
import { useEmailValidation } from '@/hooks/useEmailValidation'
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription'
import { suppressRealtime, isRealtimeSuppressed } from '@/lib/realtimeCooldown'
import {
  getOwnerManagers,
  createOwnerManager,
  updateOwnerManager,
  deleteOwnerManager,
  getOwnerApartments,
} from '../../lib/ownerApi'
import ConfirmationModal from '@/components/ui/ConfirmationModal'
import { TableSkeleton } from '@/components/ui/skeleton'
import TablePagination from '@/components/ui/table-pagination'

interface OwnerManagersTabProps {
  ownerId: string
}

interface Manager {
  id: string
  first_name: string
  last_name: string
  email: string
  phone: string | null
  status: string
  joined_date: string
  apartment?: { id: string; name: string; address: string } | null
}

export default function OwnerManagersTab({ ownerId }: OwnerManagersTabProps) {
  const { isDark } = useTheme()
  const [search, setSearch] = useState('')
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [managers, setManagers] = useState<Manager[]>([])
  const [loading, setLoading] = useState(true)
  const initialLoadDone = useRef(false)
  const loadVersion = useRef(0)
  const [showModal, setShowModal] = useState(false)
  const [editingManager, setEditingManager] = useState<Manager | null>(null)
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', apartmentId: '' })
  const [saving, setSaving] = useState(false)
  const [phonePrefixError, setPhonePrefixError] = useState(false)
  const [showCredentials, setShowCredentials] = useState(false)
  const [credentials, setCredentials] = useState({ email: '', password: '' })
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [managerToDelete, setManagerToDelete] = useState<Manager | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [page, setPage] = useState(1)
  const pageSize = 10
  const managerEmailValidation = useEmailValidation(form.email)
  const [apartments, setApartments] = useState<{ id: string; name: string }[]>([])

  useEffect(() => {
    loadManagers()
    getOwnerApartments(ownerId).then((data) => setApartments(data || [])).catch(() => {})
  }, [ownerId])

  // Real-time: auto-refresh managers list when any row changes
  useRealtimeSubscription(`owner-managers-${ownerId}`, [
    { table: 'apartment_managers', filter: `apartmentowner_id=eq.${ownerId}`, onChanged: () => loadManagers(true) },
  ])

  async function loadManagers(skipCache = false) {
    if (skipCache && isRealtimeSuppressed()) return
    const version = ++loadVersion.current
    try {
      if (!initialLoadDone.current) setLoading(true)
      const data = await getOwnerManagers(ownerId, { skipCache })
      if (loadVersion.current !== version) return // stale response
      setManagers(data)
      initialLoadDone.current = true
    } catch (err) {
      if (loadVersion.current !== version) return
      console.error('Failed to load managers:', err)
    } finally {
      if (loadVersion.current === version) setLoading(false)
    }
  }

  function openAddModal() {
    setEditingManager(null)
    setForm({ firstName: '', lastName: '', email: '', phone: '', apartmentId: '' })
    setShowModal(true)
  }

  function openEditModal(manager: Manager) {
    setEditingManager(manager)
    setForm({ firstName: manager.first_name || '', lastName: manager.last_name || '', email: manager.email, phone: (manager.phone || '').replace(/^\+63/, ''), apartmentId: manager.apartment?.id || '' })
    setShowModal(true)
    setOpenMenu(null)
  }

  function handleNameInput(value: string) {
    return value.replace(/[^a-zA-Z\s'-]/g, '')
  }

  async function handleSave() {
    if (!form.firstName || !form.email) {
      toast.error('First name and email are required')
      return
    }

    if (!editingManager && !managerEmailValidation.isValid) {
      toast.error(managerEmailValidation.message || 'Email could not be verified')
      return
    }

    try {
      setSaving(true)
      suppressRealtime()
      if (editingManager) {
        // Optimistic: update in state and close modal BEFORE API call
        loadVersion.current++
        setManagers(prev => prev.map(m => m.id === editingManager.id ? { ...m, first_name: form.firstName, last_name: form.lastName, email: form.email, phone: form.phone ? `+63${form.phone}` : m.phone } : m))
        toast.success('Manager updated successfully')
        setShowModal(false)
        // API call in background
        updateOwnerManager(editingManager.id, {
          first_name: form.firstName,
          last_name: form.lastName,
          email: form.email,
          phone: form.phone ? `+63${form.phone}` : undefined,
          apartment_id: form.apartmentId || null,
        }).then(() => loadManagers(true)).catch(() => {
          toast.error('Failed to save — refreshing data')
          loadManagers(true)
        })
      } else {
        // For create: add placeholder instantly, show credentials when API returns
        const tempId = `temp-${crypto.randomUUID()}`
        loadVersion.current++
        setManagers(prev => [{ id: tempId, first_name: form.firstName, last_name: form.lastName, email: form.email, phone: form.phone ? `+63${form.phone}` : null, status: 'pending', apartment_id: form.apartmentId || null } as any, ...prev])
        setShowModal(false)

        const result = await createOwnerManager({
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          phone: form.phone ? `+63${form.phone}` : undefined,
          apartmentowner_id: ownerId,
          apartment_id: form.apartmentId || undefined,
        })
        // Replace temp with real data
        loadVersion.current++
        setManagers(prev => prev.map(m => m.id === tempId ? result.manager : m))
        setCredentials({ email: form.email, password: result.generatedPassword || '' })
        setShowCredentials(true)
        toast.success('Manager account created successfully')
        // Background refetch
        loadManagers(true).catch(() => {})
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save manager'
      toast.error(message)
      loadManagers(true).catch(() => {})
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
    // Optimistic: remove from state BEFORE API call
    suppressRealtime()
    loadVersion.current++
    setManagers(prev => prev.filter(m => m.id !== id))
    setOpenMenu(null)
    toast.success('Manager deleted')
    setDeleting(true)
    try {
      await deleteOwnerManager(id)
      // Background refetch
      loadManagers(true).catch(() => {})
    } catch (err) {
      console.error('Failed to delete manager:', err)
      toast.error('Failed to delete manager — refreshing data')
      loadManagers(true).catch(() => {})
    } finally {
      setDeleting(false)
      setManagerToDelete(null)
    }
  }

  const filtered = managers.filter(
    (m) =>
      `${m.first_name} ${m.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
      m.email.toLowerCase().includes(search.toLowerCase()) ||
      (m.apartment?.name || '').toLowerCase().includes(search.toLowerCase())
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
                {['No.', 'Name', 'Apartment Code', 'Address', 'Status', 'View'].map((h) => (
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
                paginated.map((manager, idx) => (
                  <tr
                    key={manager.id}
                    className={`border-b last:border-0 transition-colors ${
                      isDark ? 'border-[#1E293B] hover:bg-white/[0.02]' : 'border-gray-100 hover:bg-gray-50'
                    }`}
                  >
                    <td className={`py-3.5 px-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      {(page - 1) * pageSize + idx + 1}
                    </td>
                    <td className={`py-3.5 px-4 font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {manager.first_name} {manager.last_name}
                    </td>
                    <td className={`py-3.5 px-4 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                      {manager.apartment?.name || <span className={isDark ? 'text-gray-500' : 'text-gray-400'}>Unassigned</span>}
                    </td>
                    <td className={`py-3.5 px-4 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                      {manager.apartment?.address || '—'}
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
                    <td className="py-3.5 px-4 relative">
                      <button
                        onClick={() => setOpenMenu(openMenu === manager.id ? null : manager.id)}
                        className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}
                      >
                        <Eye className="w-4 h-4" />
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
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/65 animate-in fade-in duration-200" onClick={() => setShowModal(false)} />
          <div className={`relative w-full max-w-md mx-4 rounded-2xl border overflow-hidden animate-in zoom-in-95 fade-in duration-200 ${isDark ? 'bg-[#111D32] border-[#1E293B]' : 'bg-white border-gray-200 shadow-2xl'}`}>
            {/* Header */}
            <div className={`px-6 py-5 border-b ${isDark ? 'border-[#1E293B]' : 'border-gray-100'}`}>
              <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {editingManager ? 'Edit Manager' : 'Create Manager'}
              </h3>
              {!editingManager && (
                <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  Fill in the manager's details. Password and verification will be sent via email.
                </p>
              )}
            </div>

            {/* Form */}
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  First Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.firstName}
                  onChange={(e) => setForm({ ...form, firstName: handleNameInput(e.target.value) })}
                  placeholder="First name"
                  className={`w-full px-3 py-2.5 rounded-lg border text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50 ${
                    isDark
                      ? 'bg-[#0A1628] border-[#1E293B] text-white placeholder-gray-500'
                      : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'
                  }`}
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Last Name
                </label>
                <input
                  type="text"
                  value={form.lastName}
                  onChange={(e) => setForm({ ...form, lastName: handleNameInput(e.target.value) })}
                  placeholder="Last name"
                  className={`w-full px-3 py-2.5 rounded-lg border text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50 ${
                    isDark
                      ? 'bg-[#0A1628] border-[#1E293B] text-white placeholder-gray-500'
                      : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'
                  }`}
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="juandelacruz@gmail.com"
                  className={`w-full px-3 py-2.5 rounded-lg border text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50 ${
                    isDark
                      ? 'bg-[#0A1628] border-[#1E293B] text-white placeholder-gray-500'
                      : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'
                  }`}
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
                <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Phone
                </label>
                <div className="relative">
                  <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>+63</span>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/\D/g, '').slice(0, 10)
                      setForm({ ...form, phone: raw })
                      setPhonePrefixError(raw.length > 0 && raw[0] !== '9')
                    }}
                    placeholder="9XX XXX XXXX"
                    maxLength={10}
                    className={`w-full pl-12 pr-3 py-2.5 rounded-lg border text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50 ${
                      isDark
                        ? 'bg-[#0A1628] border-[#1E293B] text-white placeholder-gray-500'
                        : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'
                    }`}
                  />
                </div>
                {phonePrefixError && (
                  <p className="text-xs text-red-500 mt-1">Contact number must start with 9 after +63</p>
                )}
              </div>

              <div>
                <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Assign to Apartment
                </label>
                <select
                  value={form.apartmentId}
                  onChange={(e) => setForm({ ...form, apartmentId: e.target.value })}
                  className={`w-full px-3 py-2.5 rounded-lg border text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50 ${
                    isDark
                      ? 'bg-[#0A1628] border-[#1E293B] text-white'
                      : 'bg-white border-gray-200 text-gray-900'
                  }`}
                >
                  <option value="">— Not assigned —</option>
                  {apartments.map((apt) => (
                    <option key={apt.id} value={apt.id}>{apt.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Footer */}
            <div className={`px-6 py-4 border-t flex gap-3 justify-end ${isDark ? 'border-[#1E293B] bg-[#0D1526]' : 'border-gray-100 bg-gray-50/50'}`}>
              <button
                onClick={() => setShowModal(false)}
                className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  isDark
                    ? 'bg-white/5 text-gray-300 hover:bg-white/10 border border-[#1E293B]'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200'
                }`}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={
                  saving ||
                  (!editingManager &&
                    (!form.email.trim() ||
                      managerEmailValidation.isChecking ||
                      managerEmailValidation.isInvalid))
                }
                className="px-5 py-2.5 rounded-lg text-sm font-semibold bg-primary hover:bg-primary-600 text-white transition-all disabled:opacity-50"
              >
                {editingManager ? 'Update' : saving ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Credentials Modal */}
      {showCredentials && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div className={`relative w-full max-w-md mx-4 rounded-xl border p-6 ${isDark ? 'bg-[#111C32] border-[#1E293B]' : 'bg-white border-gray-200'}`}>
            <h3 className={`text-xl font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Manager Account Created
            </h3>

            <div className={`rounded-lg p-4 mb-4 ${isDark ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-emerald-50 border border-emerald-200'}`}>
              <p className={`text-sm font-medium ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>
                A verification email has been sent. The manager must verify their email before logging in.
              </p>
            </div>

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

              {credentials.password && (
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
              )}
            </div>

            {credentials.password && (
              <div className={`mt-4 rounded-lg p-3 ${isDark ? 'bg-yellow-500/10 border border-yellow-500/20' : 'bg-yellow-50 border border-yellow-200'}`}>
                <p className={`text-xs ${isDark ? 'text-yellow-400' : 'text-yellow-700'}`}>
                  ⚠️ Save these credentials now. The password cannot be retrieved after closing this dialog.
                </p>
              </div>
            )}

            <div className="flex justify-end mt-6">
              <button
                onClick={() => {
                  setShowCredentials(false)
                }}
                className="px-5 py-2.5 rounded-lg text-sm font-semibold bg-primary hover:bg-primary-600 text-white transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmationModal
        open={Boolean(managerToDelete)}
        isDark={isDark}
        title="Delete Manager?"
        description={managerToDelete ? `This will deactivate ${managerToDelete.first_name} ${managerToDelete.last_name}'s manager account.` : 'This action cannot be undone.'}
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
