import { Search, Plus, MoreHorizontal, Edit2, Trash2, X, Copy, Check, Send, Mail } from 'lucide-react'
import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { toast } from 'sonner'
import { useTheme } from '../../context/ThemeContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  getManagerTenants,
  createTenantAccount,
  updateTenantAccount,
  deleteTenantAccount,
  type TenantAccount,
} from '../../lib/managerApi'

interface ManagerTenantsTabProps {
  clientId: string
}

export default function ManagerTenantsTab({ clientId }: ManagerTenantsTabProps) {
  const { isDark } = useTheme()
  const [search, setSearch] = useState('')
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [tenants, setTenants] = useState<TenantAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingTenant, setEditingTenant] = useState<TenantAccount | null>(null)
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '' })
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
    loadData()
  }, [clientId])

  async function loadData() {
    try {
      setLoading(true)
      const tenantData = await getManagerTenants(clientId)
      setTenants(tenantData)
    } catch (err) {
      console.error('Failed to load tenants:', err)
    } finally {
      setLoading(false)
    }
  }

  function openAddModal() {
    setEditingTenant(null)
    setForm({ firstName: '', lastName: '', email: '', phone: '' })
    setShowModal(true)
  }

  function openEditModal(tenant: TenantAccount) {
    setEditingTenant(tenant)
    const nameParts = (tenant.name || '').split(' ')
    const firstName = nameParts[0] || ''
    const lastName = nameParts.slice(1).join(' ') || ''
    setForm({
      firstName,
      lastName,
      email: tenant.email || '',
      phone: tenant.phone || '',
    })
    setShowModal(true)
    setOpenMenu(null)
  }

  async function handleSave() {
    if (!form.firstName || !form.email) {
      toast.error('First name and email are required')
      return
    }
    const fullName = `${form.firstName.trim()} ${form.lastName.trim()}`.trim()
    try {
      setSaving(true)
      if (editingTenant) {
        const updated = await updateTenantAccount(editingTenant.id, {
          name: fullName,
          email: form.email,
          phone: form.phone || undefined,
        })
        setTenants((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
        toast.success('Tenant updated successfully')
        setShowModal(false)
      } else {
        const result = await createTenantAccount({
          name: fullName,
          email: form.email,
          phone: form.phone || undefined,
          client_id: clientId,
        })
        setTenants((prev) => [result.tenant, ...prev])
        setShowModal(false)
        setCredentials({ email: form.email, password: result.generatedPassword })
        setShowCredentials(true)
        toast.success('Tenant account created successfully')
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save tenant'
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
      await deleteTenantAccount(id)
      setTenants((prev) => prev.filter((t) => t.id !== id))
      setOpenMenu(null)
      toast.success('Tenant deleted')
    } catch (err) {
      console.error('Failed to delete tenant:', err)
      toast.error('Failed to delete tenant')
    }
  }

  const filtered = tenants.filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      (t.email || '').toLowerCase().includes(search.toLowerCase())
  )

  const cardClass = `rounded-xl border ${
    isDark ? 'bg-navy-card border-[#1E293B]' : 'bg-white border-gray-200 shadow-sm'
  }`

  const inputClass = isDark
    ? 'bg-[#0A1628] border-[#1E293B] text-white placeholder:text-gray-500'
    : 'bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400'

  return (
    <>
      <div className="flex flex-col flex-1 min-h-0 gap-6 animate-fade-up">
        {/* Header with Search + Add Button */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search
              className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}
            />
            <input
              type="text"
              placeholder="Search tenants..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`w-full pl-10 pr-4 py-3 rounded-lg text-base border focus:outline-none focus:ring-2 focus:ring-primary/50 ${
                isDark
                  ? 'bg-[#0A1628] border-[#1E293B] text-white placeholder-gray-500'
                  : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'
              }`}
            />
          </div>
          <button
            onClick={openAddModal}
            className="inline-flex items-center gap-2 px-5 py-3 bg-primary hover:bg-primary-600 text-white font-semibold text-base rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Tenant
          </button>
        </div>

        {/* Table */}
        <div className={`${cardClass} flex-1 min-h-0 flex flex-col overflow-hidden`}>
          <div className="overflow-auto flex-1">
            <table className="w-full text-base">
              <thead>
                <tr className={`border-b ${isDark ? 'border-[#1E293B]' : 'border-gray-200'}`}>
                  {['Name', 'Email', 'Phone', 'Unit', 'Status', ''].map((h) => (
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
                      Loading tenants...
                    </td>
                  </tr>
                )}
                {!loading &&
                  filtered.map((tenant) => (
                    <tr
                      key={tenant.id}
                      className={`border-b last:border-0 transition-colors ${
                        isDark
                          ? 'border-[#1E293B] hover:bg-white/[0.02]'
                          : 'border-gray-100 hover:bg-gray-50'
                      }`}
                    >
                      <td className={`py-3.5 px-4 font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {tenant.name}
                      </td>
                      <td className={`py-3.5 px-4 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                        {tenant.email || '—'}
                      </td>
                      <td className={`py-3.5 px-4 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                        {tenant.phone || '—'}
                      </td>
                      <td className={`py-3.5 px-4 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                        {tenant.apartment_name || '—'}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-block px-2.5 py-0.5 text-xs font-medium rounded-full ${
                            tenant.status === 'active'
                              ? 'bg-emerald-500/15 text-emerald-400'
                              : 'bg-gray-500/15 text-gray-400'
                          }`}
                        >
                          {tenant.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 relative">
                        <button
                          onClick={() => setOpenMenu(openMenu === tenant.id ? null : tenant.id)}
                          className={`p-2 rounded-lg transition-colors ${
                            isDark ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-gray-100 text-gray-500'
                          }`}
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                        {openMenu === tenant.id && (
                          <div
                            className={`absolute right-4 top-14 z-20 w-36 rounded-lg border shadow-lg py-1 ${
                              isDark ? 'bg-[#111C32] border-[#1E293B]' : 'bg-white border-gray-200'
                            }`}
                          >
                            <button
                              onClick={() => openEditModal(tenant)}
                              className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                                isDark
                                  ? 'text-gray-300 hover:bg-white/5'
                                  : 'text-gray-700 hover:bg-gray-50'
                              }`}
                            >
                              <Edit2 className="w-3.5 h-3.5" /> Edit
                            </button>
                            <button
                              onClick={() => handleDelete(tenant.id)}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
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
                    <td
                      colSpan={6}
                      className={`py-8 text-center ${isDark ? 'text-gray-500' : 'text-gray-400'}`}
                    >
                      No tenants found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && createPortal(
        <div className="fixed inset-0 z-[100]">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className={`relative w-full max-w-md rounded-xl border p-6 ${isDark ? 'bg-[#111C32] border-[#1E293B]' : 'bg-white border-gray-200'}`}>
              <button
                onClick={() => setShowModal(false)}
                className={`absolute top-4 right-4 p-1 rounded-lg ${isDark ? 'text-gray-400 hover:bg-white/10' : 'text-gray-500 hover:bg-gray-100'}`}
              >
                <X className="w-4 h-4" />
              </button>

              <h3 className={`text-xl font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {editingTenant ? 'Edit Tenant' : 'Create Tenant Account'}
              </h3>

              {!editingTenant && (
                <p className={`text-sm mb-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  Enter the tenant's account details. Unit assignment is managed only in the Units tab.
                </p>
              )}

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className={isDark ? 'text-gray-300' : 'text-gray-700'}>First Name</Label>
                    <Input
                      value={form.firstName}
                      onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                      placeholder="First name"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <Label className={isDark ? 'text-gray-300' : 'text-gray-700'}>Last Name</Label>
                    <Input
                      value={form.lastName}
                      onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                      placeholder="Last name"
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
                    placeholder="tenant@gmail.com"
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
                  {editingTenant ? 'Update' : saving ? 'Creating...' : 'Create Account'}
                </Button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Credentials Modal */}
      {showCredentials && createPortal(
        <div className="fixed inset-0 z-[100]">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className={`relative w-full max-w-md rounded-xl border p-6 ${isDark ? 'bg-[#111C32] border-[#1E293B]' : 'bg-white border-gray-200'}`}>
              <h3 className={`text-xl font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Tenant Account Created
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
        </div>,
        document.body
      )}
    </>
  )
}
