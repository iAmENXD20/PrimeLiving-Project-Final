import { Search, Plus, MoreHorizontal, Edit2, Trash2, X, Copy, Check, Send, Mail, ChevronDown, Eye } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { toast } from 'sonner'
import { useTheme } from '../../context/ThemeContext'
import { useEmailValidation } from '@/hooks/useEmailValidation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatPhone } from '@/lib/utils'
import {
  getManagerTenants,
  createTenantAccount,
  updateTenantAccount,
  deleteTenantAccount,
  getManagedApartments,
  type TenantAccount,
} from '../../lib/managerApi'
import { getTenantIdPhotos } from '../../lib/ownerApi'
import ConfirmationModal from '@/components/ui/ConfirmationModal'
import TablePagination from '@/components/ui/table-pagination'
import { TableSkeleton } from '@/components/ui/skeleton'

interface ManagerTenantsTabProps {
  managerId: string
}

export default function ManagerTenantsTab({ managerId }: ManagerTenantsTabProps) {
  const { isDark } = useTheme()
  const [search, setSearch] = useState('')
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [tenants, setTenants] = useState<TenantAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingTenant, setEditingTenant] = useState<TenantAccount | null>(null)
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', sex: '', age: '' })
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
  const [tenantToDelete, setTenantToDelete] = useState<TenantAccount | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [viewTenant, setViewTenant] = useState<TenantAccount | null>(null)
  const [unitDataMap, setUnitDataMap] = useState<Map<string, { name: string; monthly_rent: number; branch: string; address: string }>>(new Map())
  const [tenantIdPhotos, setTenantIdPhotos] = useState<{ id_type: string; id_type_other: string | null; front_url: string | null; back_url: string | null } | null>(null)
  const [tenantIdPhotosLoading, setTenantIdPhotosLoading] = useState(false)
  const [page, setPage] = useState(1)
  const pageSize = 10
  const tenantEmailValidation = useEmailValidation(form.email)
  const ownerIdRef = useRef<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'pending' | 'pending_verification' | 'inactive'>('all')
  const [statusFilterOpen, setStatusFilterOpen] = useState(false)
  const statusFilterRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadData()
  }, [managerId])

  // Fetch ID photos when viewing a tenant
  useEffect(() => {
    if (viewTenant && (viewTenant.status === 'pending_verification' || viewTenant.status === 'active')) {
      setTenantIdPhotosLoading(true)
      setTenantIdPhotos(null)
      getTenantIdPhotos(viewTenant.id)
        .then(res => setTenantIdPhotos(res))
        .catch(() => setTenantIdPhotos(null))
        .finally(() => setTenantIdPhotosLoading(false))
    } else {
      setTenantIdPhotos(null)
    }
  }, [viewTenant?.id, viewTenant?.status])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (sexRef.current && !sexRef.current.contains(e.target as Node)) setIsSexOpen(false)
      if (statusFilterRef.current && !statusFilterRef.current.contains(e.target as Node)) setStatusFilterOpen(false)
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

  async function loadData() {
    try {
      setLoading(true)
      const [tenantData, apartments] = await Promise.all([
        getManagerTenants(managerId),
        getManagedApartments(managerId),
      ])
      setTenants(tenantData)
      // Store apartmentowner_id from managed apartments for tenant creation
      if (apartments?.[0]?.apartmentowner_id) {
        ownerIdRef.current = apartments[0].apartmentowner_id
      }
      // Build unit data map for tenant detail view
      const map = new Map<string, { name: string; monthly_rent: number; branch: string; address: string }>()
      for (const u of apartments || []) {
        const addrParts = [u.apartment_address_street, u.apartment_address_barangay, u.apartment_address_city, u.apartment_address_province, u.apartment_address_region].filter(Boolean)
        map.set(u.id, {
          name: u.name || 'Unknown',
          monthly_rent: u.monthly_rent || 0,
          branch: u.apartment_name || 'Unassigned',
          address: addrParts.join(', ') || '—',
        })
      }
      setUnitDataMap(map)
    } catch (err) {
      console.error('Failed to load tenants:', err)
    } finally {
      setLoading(false)
    }
  }

  function openAddModal() {
    setEditingTenant(null)
    setForm({ firstName: '', lastName: '', email: '', phone: '', sex: '', age: '' })
    setShowModal(true)
  }

  function openEditModal(tenant: TenantAccount) {
    setEditingTenant(tenant)
    setForm({
      firstName: tenant.first_name || '',
      lastName: tenant.last_name || '',
      email: tenant.email || '',
      phone: (tenant.phone || '').replace(/^\+63/, ''),
      sex: (tenant as any).sex || '',
      age: (tenant as any).age || '',
    })
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

    if (form.age && (isNaN(Number(form.age)) || Number(form.age) < 18)) {
      return
    }

    if (!editingTenant && !tenantEmailValidation.isValid) {
      toast.error(tenantEmailValidation.message || 'Email could not be verified')
      return
    }

    const fullName = `${form.firstName.trim()} ${form.lastName.trim()}`.trim()
    try {
      setSaving(true)
      if (editingTenant) {
        const updated = await updateTenantAccount(editingTenant.id, {
          first_name: form.firstName.trim(),
          last_name: form.lastName.trim(),
          email: form.email,
          phone: form.phone ? `+63${form.phone}` : undefined,
        })
        await loadData()
        toast.success('Tenant updated successfully')
        setShowModal(false)
      } else {
        const result = await createTenantAccount({
          first_name: form.firstName.trim(),
          last_name: form.lastName.trim(),
          email: form.email,
          phone: form.phone ? `+63${form.phone}` : undefined,
          sex: form.sex || undefined,
          age: form.age || undefined,
          apartmentowner_id: ownerIdRef.current || '',
        })
        setTenants((prev) => [result.tenant, ...prev])
        await loadData()
        setShowModal(false)
        setCredentials({ email: form.email })
        setShowCredentials(true)
        toast.success('Tenant invitation sent successfully')
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
      setDeleting(true)
      await deleteTenantAccount(id)
      await loadData()
      setOpenMenu(null)
      toast.success('Tenant deleted')
    } catch (err) {
      console.error('Failed to delete tenant:', err)
      toast.error('Failed to delete tenant')
    } finally {
      setDeleting(false)
      setTenantToDelete(null)
    }
  }

  const filtered = tenants.filter(
    (t) => {
      // Status filter
      if (statusFilter === 'all' && t.status === 'inactive') return false
      if (statusFilter === 'pending_verification') {
        if (t.status !== 'pending' && t.status !== 'pending_verification') return false
      } else if (statusFilter !== 'all' && t.status !== statusFilter) return false
      // Search filter
      const q = search.toLowerCase()
      return `${t.first_name} ${t.last_name}`.toLowerCase().includes(q) ||
        (t.email || '').toLowerCase().includes(q)
    }
  )

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize)

  useEffect(() => {
    setPage(1)
  }, [search, tenants.length])

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
      <div className="flex flex-col flex-1 min-h-0 gap-6 animate-fade-up">
        {/* Header with Search + Status Filter + Add Button */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-2 flex-1">
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
            {/* Status Filter */}
            <div className="relative" ref={statusFilterRef}>
            <button
              onClick={() => setStatusFilterOpen(!statusFilterOpen)}
              className={`inline-flex items-center gap-2 px-4 py-3 rounded-lg border text-sm font-medium transition-colors ${
                isDark
                  ? 'bg-[#0A1628] border-[#1E293B] text-gray-300 hover:bg-white/5'
                  : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              {statusFilter === 'all' ? 'All Status' : statusFilter === 'pending_verification' ? 'Awaiting Approval' : statusFilter === 'pending' ? 'Pending' : statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)}
              <ChevronDown className={`w-4 h-4 transition-transform ${statusFilterOpen ? 'rotate-180' : ''}`} />
            </button>
            {statusFilterOpen && (
              <div className={`absolute z-30 mt-1 w-48 rounded-lg border shadow-lg py-1 ${
                isDark ? 'bg-[#111C32] border-[#1E293B]' : 'bg-white border-gray-200'
              }`}>
                {([['all', 'All Status'], ['active', 'Active'], ['pending_verification', 'Awaiting Approval'], ['pending', 'Pending'], ['inactive', 'Inactive']] as const).map(([value, label]) => (
                  <button
                    key={value}
                    onClick={() => { setStatusFilter(value); setStatusFilterOpen(false); setPage(1) }}
                    className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                      statusFilter === value
                        ? (isDark ? 'bg-primary/20 text-primary font-medium' : 'bg-primary/10 text-primary font-medium')
                        : (isDark ? 'text-gray-300 hover:bg-white/5' : 'text-gray-700 hover:bg-gray-50')
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
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
                  {['No.', 'Name', 'Email', 'Phone', 'Unit/Room', 'Status', 'Contract', 'Action'].map((h) => (
                    <th key={h} className={`text-left py-3.5 px-4 font-medium ${h === 'No.' ? 'w-16 text-center' : ''} ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={8} className="py-3 px-4">
                      <TableSkeleton rows={5} />
                    </td>
                  </tr>
                )}
                {!loading &&
                  paginated.map((tenant, index) => (
                    <tr
                      key={tenant.id}
                      className={`border-b last:border-0 transition-colors ${
                        isDark
                          ? 'border-[#1E293B] hover:bg-white/[0.02]'
                          : 'border-gray-100 hover:bg-gray-50'
                      }`}
                    >
                      <td className={`py-3.5 px-4 text-center ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        {(page - 1) * pageSize + index + 1}
                      </td>
                      <td className={`py-3.5 px-4 font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {tenant.first_name} {tenant.last_name}
                      </td>
                      <td className={`py-3.5 px-4 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                        {tenant.email || '—'}
                      </td>
                      <td className={`py-3.5 px-4 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                        {formatPhone(tenant.phone) || '—'}
                      </td>
                      <td className={`py-3.5 px-4 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                        {tenant.apartment_name || '—'}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-block px-2.5 py-0.5 text-xs font-medium rounded-full ${
                            tenant.status === 'active'
                              ? 'bg-emerald-500/15 text-emerald-400'
                              : tenant.status === 'pending'
                              ? 'bg-amber-500/15 text-amber-400'
                              : tenant.status === 'pending_verification'
                              ? 'bg-blue-500/15 text-blue-400'
                              : tenant.status === 'inactive'
                              ? 'bg-red-500/15 text-red-400'
                              : 'bg-gray-500/15 text-gray-400'
                          }`}
                        >
                          {tenant.status === 'pending_verification' ? 'Awaiting Approval' : tenant.status === 'pending' ? 'Pending' : tenant.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-block px-2.5 py-0.5 text-xs font-medium rounded-full ${
                            tenant.contract_status === 'renewed'
                              ? 'bg-emerald-500/15 text-emerald-400'
                              : tenant.contract_status === 'expiring'
                              ? 'bg-amber-500/15 text-amber-400'
                              : 'bg-gray-500/15 text-gray-400'
                          }`}
                        >
                          {tenant.contract_status || 'active'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 relative">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setViewTenant(tenant)}
                            title="View tenant details"
                            className={`p-2 rounded-lg transition-colors ${
                              isDark ? 'hover:bg-white/10 text-gray-400 hover:text-primary' : 'hover:bg-gray-100 text-gray-500 hover:text-primary'
                            }`}
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setOpenMenu(openMenu === tenant.id ? null : tenant.id)}
                            className={`p-2 rounded-lg transition-colors ${
                              isDark ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-gray-100 text-gray-500'
                            }`}
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                        </div>
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
                              onClick={() => setTenantToDelete(tenant)}
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
                      colSpan={8}
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
      {showModal && createPortal(
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pt-20">
            <div className={`relative w-full max-w-md rounded-xl border p-6 ${isDark ? 'bg-[#111C32] border-[#1E293B]' : 'bg-white border-gray-200'}`}>
              <div className="flex items-center justify-between mb-2">
                <h3 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {editingTenant ? 'Edit Tenant' : 'Add Tenant'}
                </h3>
                <button onClick={() => setShowModal(false)} className={isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-700'}>
                  <X className="w-5 h-5" />
                </button>
              </div>

              {!editingTenant && (
                <p className={`text-sm mb-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  Enter the tenant's email address. An invitation will be sent for them to set up their account.
                </p>
              )}
              {editingTenant && <div className="mb-4" />}

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className={isDark ? 'text-gray-300' : 'text-gray-700'}>First Name</Label>
                    <Input
                      value={form.firstName}
                      onChange={(e) => setForm({ ...form, firstName: handleNameInput(e.target.value) })}
                      placeholder="First name"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <Label className={isDark ? 'text-gray-300' : 'text-gray-700'}>Last Name</Label>
                    <Input
                      value={form.lastName}
                      onChange={(e) => setForm({ ...form, lastName: handleNameInput(e.target.value) })}
                      placeholder="Last name"
                      className={inputClass}
                    />
                  </div>
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
                      min={18}
                      max={120}
                      value={form.age}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9]/g, '')
                        setForm({ ...form, age: val })
                      }}
                      placeholder="Age"
                      className={`${inputClass} ${form.age && Number(form.age) < 18 ? 'border-red-500 focus:ring-red-500/50' : ''}`}
                    />
                    {form.age && Number(form.age) < 18 && (
                      <p className="text-xs text-red-500 mt-1">Must be at least 18 years old</p>
                    )}
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
                  {!editingTenant && form.email.trim() && (
                    <p
                      className={`text-xs mt-1 ${
                        tenantEmailValidation.isValid
                          ? 'text-emerald-500'
                          : tenantEmailValidation.isInvalid
                          ? 'text-red-500'
                          : isDark
                          ? 'text-gray-400'
                          : 'text-gray-500'
                      }`}
                    >
                      {tenantEmailValidation.message}
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
                  Back
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={
                    saving ||
                    (!editingTenant &&
                      (!form.email.trim() ||
                        tenantEmailValidation.isChecking ||
                        tenantEmailValidation.isInvalid))
                  }
                  className="bg-primary hover:bg-primary/90 text-white font-semibold"
                >
                  {editingTenant ? 'Update' : saving ? 'Adding...' : 'Add'}
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
          <div className="absolute inset-0 bg-black/65 animate-in fade-in duration-200" />
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className={`relative w-full max-w-md rounded-xl border p-6 animate-in zoom-in-95 fade-in duration-200 ${isDark ? 'bg-[#111C32] border-[#1E293B]' : 'bg-white border-gray-200'}`}>
              <h3 className={`text-xl font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Tenant Invitation Sent
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
              </div>

              <div className={`mt-4 rounded-lg p-3 ${isDark ? 'bg-yellow-500/10 border border-yellow-500/20' : 'bg-yellow-50 border border-yellow-200'}`}>
                <p className={`text-xs ${isDark ? 'text-yellow-400' : 'text-yellow-700'}`}>
                  The tenant should check their email to accept the invite and set up their account.
                </p>
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
        </div>,
        document.body
      )}

      <ConfirmationModal
        open={Boolean(tenantToDelete)}
        isDark={isDark}
        title="Delete Tenant?"
        description={tenantToDelete ? `This will deactivate ${tenantToDelete.first_name} ${tenantToDelete.last_name}'s tenant account.` : 'This action cannot be undone.'}
        confirmText="Delete"
        loading={deleting}
        onCancel={() => setTenantToDelete(null)}
        onConfirm={() => {
          if (tenantToDelete) handleDelete(tenantToDelete.id)
        }}
      />

      {/* View Tenant Detail Modal */}
      {viewTenant && (() => {
        const unitInfo = viewTenant.unit_id ? unitDataMap.get(viewTenant.unit_id) : null
        const statusLabel = viewTenant.status === 'pending_verification' ? 'Awaiting Approval' : viewTenant.status === 'pending' ? 'Pending Invite' : viewTenant.status
        return createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4"
            onClick={() => setViewTenant(null)}
          >
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
            <div
              className={`relative w-full max-w-md rounded-xl shadow-2xl max-h-[90vh] flex flex-col ${isDark ? 'bg-[#111D32] border border-white/10' : 'bg-white border border-gray-200'}`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-6 pt-6 pb-3 flex-shrink-0">
                <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  Tenant Details
                </h3>
                <button
                  onClick={() => setViewTenant(null)}
                  className={`p-1 rounded transition-colors ${isDark ? 'text-gray-400 hover:text-white hover:bg-white/10' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'}`}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="overflow-y-auto flex-1 px-6 pb-6">
                <div className="space-y-4">
                  {[
                    { label: 'Name', value: `${viewTenant.first_name} ${viewTenant.last_name}`.trim() },
                    { label: 'Phone', value: formatPhone(viewTenant.phone) || '—' },
                    { label: 'Branch', value: unitInfo?.branch || viewTenant.apartment_name || '—' },
                    { label: 'Address', value: unitInfo?.address || '—' },
                    { label: 'Unit', value: unitInfo?.name || '—' },
                    { label: 'Monthly Rent', value: unitInfo?.monthly_rent ? `₱${unitInfo.monthly_rent.toLocaleString()}` : '—' },
                    { label: 'Status', value: statusLabel },
                  ].map((item) => (
                    <div key={item.label} className={`flex justify-between items-start gap-4 py-2 border-b ${isDark ? 'border-white/5' : 'border-gray-100'}`}>
                      <span className={`text-sm shrink-0 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{item.label}</span>
                      {item.label === 'Status' ? (
                        <span className={`inline-block px-2.5 py-0.5 text-xs font-medium rounded-full ${
                          viewTenant.status === 'active'
                            ? 'bg-emerald-500/15 text-emerald-400'
                            : viewTenant.status === 'pending_verification'
                              ? 'bg-amber-500/15 text-amber-400'
                              : viewTenant.status === 'pending'
                                ? 'bg-red-500/15 text-red-400'
                                : viewTenant.status === 'inactive'
                                  ? 'bg-red-500/15 text-red-400'
                                  : 'bg-gray-500/15 text-gray-400'
                        }`}>
                          {item.value}
                        </span>
                      ) : (
                        <span className={`text-sm font-medium text-right max-w-[60%] break-words ${isDark ? 'text-white' : 'text-gray-900'}`}>{item.value}</span>
                      )}
                    </div>
                  ))}
                </div>

                {/* ID Verification Section */}
                {(viewTenant.status === 'pending_verification' || viewTenant.status === 'active') && (
                  <div className="mt-5">
                    <h4 className={`text-sm font-semibold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      ID Verification
                    </h4>
                    {tenantIdPhotosLoading ? (
                      <div className={`text-sm text-center py-6 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Loading ID photos...</div>
                    ) : tenantIdPhotos ? (
                      <div className="space-y-3">
                        {tenantIdPhotos.id_type && (
                          <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                            <span className={isDark ? 'text-gray-500' : 'text-gray-400'}>ID Type: </span>
                            {tenantIdPhotos.id_type === 'Other' && tenantIdPhotos.id_type_other
                              ? tenantIdPhotos.id_type_other
                              : tenantIdPhotos.id_type}
                          </p>
                        )}
                        <div className="grid grid-cols-2 gap-3">
                          {tenantIdPhotos.front_url && (
                            <div>
                              <p className={`text-xs mb-1.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Front</p>
                              <a href={tenantIdPhotos.front_url} target="_blank" rel="noopener noreferrer">
                                <img
                                  src={tenantIdPhotos.front_url}
                                  alt="ID Front"
                                  className={`w-full rounded-lg border object-cover aspect-[3/2] cursor-pointer hover:opacity-80 transition-opacity ${isDark ? 'border-white/10' : 'border-gray-200'}`}
                                />
                              </a>
                            </div>
                          )}
                          {tenantIdPhotos.back_url && (
                            <div>
                              <p className={`text-xs mb-1.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Back</p>
                              <a href={tenantIdPhotos.back_url} target="_blank" rel="noopener noreferrer">
                                <img
                                  src={tenantIdPhotos.back_url}
                                  alt="ID Back"
                                  className={`w-full rounded-lg border object-cover aspect-[3/2] cursor-pointer hover:opacity-80 transition-opacity ${isDark ? 'border-white/10' : 'border-gray-200'}`}
                                />
                              </a>
                            </div>
                          )}
                        </div>
                        {!tenantIdPhotos.front_url && !tenantIdPhotos.back_url && (
                          <p className={`text-sm text-center py-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>No ID photos uploaded</p>
                        )}
                      </div>
                    ) : (
                      <p className={`text-sm text-center py-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Unable to load ID photos</p>
                    )}
                  </div>
                )}

                <div className="mt-6">
                  <Button variant="outline" className="w-full" onClick={() => setViewTenant(null)}>
                    Close
                  </Button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )
      })()}
    </>
  )
}
