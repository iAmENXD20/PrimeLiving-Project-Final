import { Search, Plus, MoreHorizontal, Edit2, Trash2, X, Copy, Check, Send, Mail, Building2, Users, UserCheck, AlertTriangle } from 'lucide-react'
import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'
import { useTheme } from '../../context/ThemeContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  getOwnerUnits,
  createBulkUnits,
  deleteOwnerApartment,
  getOwnerManagers,
  createOwnerManager,
  updateOwnerManager,
  deleteOwnerManager,
  type UnitWithTenant,
} from '../../lib/ownerApi'

interface OwnerManageApartmentTabProps {
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

export default function OwnerManageApartmentTab({ clientId }: OwnerManageApartmentTabProps) {
  const { isDark } = useTheme()

  // ─── Units state ──────────────────────────────────────────────
  const [units, setUnits] = useState<UnitWithTenant[]>([])
  const [unitsLoading, setUnitsLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [addForm, setAddForm] = useState({ count: '1' })
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null)
  const [deleting, setDeleting] = useState(false)

  // ─── Managers state ───────────────────────────────────────────
  const [managers, setManagers] = useState<Manager[]>([])
  const [managersLoading, setManagersLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [showManagerModal, setShowManagerModal] = useState(false)
  const [editingManager, setEditingManager] = useState<Manager | null>(null)
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

  // ─── Sub-tab state ────────────────────────────────────────────
  const [activeSubTab, setActiveSubTab] = useState<'units' | 'managers' | 'tenants'>('units')

  // ─── Load data ────────────────────────────────────────────────
  useEffect(() => {
    loadUnits()
    loadManagers()
  }, [clientId])

  async function loadUnits() {
    try {
      setUnitsLoading(true)
      const data = await getOwnerUnits(clientId)
      setUnits(data)
    } catch (err) {
      console.error('Failed to load units:', err)
    } finally {
      setUnitsLoading(false)
    }
  }

  async function loadManagers() {
    try {
      setManagersLoading(true)
      const data = await getOwnerManagers(clientId)
      setManagers(data)
    } catch (err) {
      console.error('Failed to load managers:', err)
    } finally {
      setManagersLoading(false)
    }
  }

  // ─── Units handlers ───────────────────────────────────────────
  async function handleAddUnits() {
    const count = Number(addForm.count)
    if (count < 1 || count > 100) {
      toast.error('Please enter 1-100 units')
      return
    }
    const startNumber = units.length + 1
    try {
      await createBulkUnits(clientId, count, startNumber, 0)
      await loadUnits()
      setShowAddModal(false)
      setAddForm({ count: '1' })
      toast.success(`${count} unit${count > 1 ? 's' : ''} added successfully`)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to add units'
      toast.error(message)
    }
  }

  async function handleDeleteUnit(unitId: string, unitName: string) {
    setDeleteConfirm({ id: unitId, name: unitName })
  }

  async function confirmDeleteUnit() {
    if (!deleteConfirm) return
    setDeleting(true)
    try {
      await deleteOwnerApartment(deleteConfirm.id)
      await loadUnits()
      toast.success(`${deleteConfirm.name} deleted successfully`)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete unit'
      toast.error(message)
    } finally {
      setDeleting(false)
      setDeleteConfirm(null)
    }
  }

  const occupiedCount = units.filter((u) => u.tenant_name).length
  const availableCount = units.length - occupiedCount

  const PIE_COLORS = ['#059669', '#EF4444', '#22C55E']
  const occupancyData = [
    { name: 'Occupied', value: occupiedCount },
    { name: 'Vacant', value: availableCount },
  ]
  const OCCUPANCY_COLORS = ['#EF4444', '#22C55E']

  // ─── Managers handlers ────────────────────────────────────────
  function openAddManagerModal() {
    setEditingManager(null)
    setForm({ firstName: '', lastName: '', email: '', phone: '' })
    setShowManagerModal(true)
  }

  function openEditModal(manager: Manager) {
    setEditingManager(manager)
    const nameParts = (manager.name || '').split(' ')
    const firstName = nameParts[0] || ''
    const lastName = nameParts.slice(1).join(' ') || ''
    setForm({ firstName, lastName, email: manager.email, phone: manager.phone || '' })
    setShowManagerModal(true)
    setOpenMenu(null)
  }

  async function handleSaveManager() {
    if (!form.firstName || !form.lastName || !form.email) {
      toast.error('First name, last name, and email are required')
      return
    }
    const fullName = `${form.firstName.trim()} ${form.lastName.trim()}`
    try {
      setSaving(true)
      if (editingManager) {
        const updated = await updateOwnerManager(editingManager.id, {
          name: fullName,
          email: form.email,
          phone: form.phone || undefined,
        })
        setManagers((prev) => prev.map((m) => (m.id === updated.id ? updated : m)))
        toast.success('Manager updated successfully')
        setShowManagerModal(false)
      } else {
        const result = await createOwnerManager({
          name: fullName,
          email: form.email,
          phone: form.phone || undefined,
          client_id: clientId,
        })
        setManagers((prev) => [result.manager, ...prev])
        setShowManagerModal(false)
        setCredentials({ email: form.email, password: result.generatedPassword })
        setShowCredentials(true)
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

  async function handleDeleteManager(id: string) {
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

  // ─── Shared styles ────────────────────────────────────────────
  const cardClass = `rounded-xl border ${
    isDark ? 'bg-navy-card border-[#1E293B]' : 'bg-white border-gray-200 shadow-sm'
  }`

  const inputClass = isDark
    ? 'bg-[#0A1628] border-[#1E293B] text-white placeholder:text-gray-500'
    : 'bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400'

  const tenantsList = units.filter((u) => u.tenant_name).map((u) => ({
    id: u.tenant_id || u.id,
    name: u.tenant_name || '',
    phone: u.tenant_phone || '—',
    unit: u.name,
    rent: u.monthly_rent,
  }))

  const subTabs = [
    { id: 'units' as const, label: 'Units', icon: Building2 },
    { id: 'managers' as const, label: 'Managers', icon: Users },
    { id: 'tenants' as const, label: 'Tenants', icon: UserCheck },
  ]

  // ─── Render ───────────────────────────────────────────────────
  return (
    <>
      <div className="flex flex-col flex-1 min-h-0 gap-6 animate-fade-up">
        {/* Page Header */}
        <div className="shrink-0">
          <h2 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Manage Apartment
          </h2>
          <p className={`text-base mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            Manage your units and managers
          </p>
        </div>

        {/* Sub-Tab Navigation */}
        <div className={`flex gap-2 overflow-x-auto pb-1 shrink-0`}>
          {subTabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeSubTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-primary text-white shadow-md'
                    : isDark
                    ? 'bg-[#111D32] text-gray-400 hover:text-white border border-[#1E293B] hover:border-primary/30'
                    : 'bg-gray-100 text-gray-500 hover:text-gray-700 border border-gray-200 hover:border-primary/40'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* ════════════════════════════════════════════════════════
            UNITS SUB-TAB (includes Property Distribution)
           ════════════════════════════════════════════════════════ */}
        {activeSubTab === 'units' && (
        <section className="space-y-6">
          {/* Unit Summary Chart */}
          <div className={`${cardClass} p-6`}>
              <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Unit Summary
              </h3>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={occupancyData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={100}
                    paddingAngle={3}
                    dataKey="value"
                    animationBegin={0}
                    animationDuration={800}
                    animationEasing="ease-out"
                    label={({ name, value }) => `${name}: ${value}`}
                    labelLine={{ stroke: isDark ? '#475569' : '#cbd5e1', strokeWidth: 1 }}
                  >
                    {occupancyData.map((_, index) => (
                      <Cell
                        key={`occ-${index}`}
                        fill={OCCUPANCY_COLORS[index % OCCUPANCY_COLORS.length]}
                        stroke={isDark ? '#0A1628' : '#fff'}
                        strokeWidth={2}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: isDark ? '#111D32' : '#fff',
                      border: `1px solid ${isDark ? '#1E293B' : '#e5e7eb'}`,
                      borderRadius: 12,
                      padding: '12px 16px',
                      color: isDark ? '#fff' : '#1e293b',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    }}
                    itemStyle={{ color: isDark ? '#fff' : '#1e293b' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              {/* Legend */}
              <div className="flex justify-center gap-6 mt-2">
                {occupancyData.map((item, index) => (
                  <div key={item.name} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: OCCUPANCY_COLORS[index] }} />
                    <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{item.name}</span>
                    <span className={`text-sm font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{item.value}</span>
                  </div>
                ))}
              </div>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div>
              <h3 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Units
              </h3>
              <p className={`text-sm mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                {units.length} total &middot;{' '}
                <span className="text-red-400 font-medium">{occupiedCount} occupied</span> &middot;{' '}
                <span className="text-emerald-400 font-medium">{availableCount} vacant</span>
              </p>
            </div>
            <button
              onClick={() => {
                setAddForm({ count: '1' })
                setShowAddModal(true)
              }}
              className="inline-flex items-center gap-2 px-5 py-3 bg-primary hover:bg-primary-600 text-white font-semibold text-base rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Units
            </button>
          </div>

          {/* Loading */}
          {unitsLoading && (
            <div className={`text-center py-12 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              Loading units...
            </div>
          )}

          {/* Empty state */}
          {!unitsLoading && units.length === 0 && (
            <div className={`text-center py-12 rounded-xl border ${isDark ? 'bg-navy-card border-[#1E293B]' : 'bg-white border-gray-200'}`}>
              <p className={`text-lg font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                No units yet
              </p>
              <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                Click "Add Units" to create your apartment units
              </p>
            </div>
          )}

          {/* Scrollable Unit Cards */}
          {!unitsLoading && units.length > 0 && (
            <div
              className={`rounded-xl border p-4 ${
                isDark ? 'bg-navy-card border-[#1E293B]' : 'bg-white border-gray-200 shadow-sm'
              }`}
            >
              <div className="max-h-[560px] overflow-y-auto pr-1 custom-scrollbar">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {units.map((unit) => {
                    const isOccupied = !!unit.tenant_name
                    return (
                      <div
                        key={unit.id}
                        className="relative rounded-lg overflow-hidden transition-all duration-200"
                        style={{
                          borderLeft: `4px solid ${isOccupied ? '#DC2626' : '#059669'}`,
                          backgroundColor: isOccupied
                            ? (isDark ? 'rgba(220,38,38,0.15)' : '#FEE2E2')
                            : (isDark ? 'rgba(5,150,105,0.15)' : '#D1FAE5'),
                          border: `1px solid ${isOccupied
                            ? (isDark ? 'rgba(220,38,38,0.3)' : '#FECACA')
                            : (isDark ? 'rgba(5,150,105,0.3)' : '#A7F3D0')}`,
                          borderLeftWidth: '4px',
                          borderLeftColor: isOccupied ? '#DC2626' : '#059669',
                        }}
                      >
                        {/* Header */}
                        <div className={`px-4 py-3 flex items-center justify-between ${isDark ? 'border-b border-white/5' : 'border-b border-gray-100'}`}>
                          <span className={`text-base font-bold tracking-wide ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            {unit.name.toUpperCase()}
                          </span>
                          <div className="flex items-center gap-2">
                            <span
                              className="w-2 h-2 rounded-full flex-shrink-0"
                              style={{ backgroundColor: isOccupied ? '#DC2626' : '#059669' }}
                            />
                            <button
                              onClick={() => handleDeleteUnit(unit.id, unit.name)}
                              className={`p-1 rounded transition-colors ${isDark ? 'hover:bg-red-500/20 text-gray-500 hover:text-red-400' : 'hover:bg-red-50 text-gray-400 hover:text-red-500'}`}
                              title="Delete unit"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Body */}
                        <div className="px-4 py-3 space-y-2.5 text-[0.9rem]">
                          <div className="flex justify-between">
                            <span className={isDark ? 'text-gray-500' : 'text-gray-400'}>Tenant Name</span>
                            <span className={`font-medium truncate ml-2 ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                              {unit.tenant_name || '—'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className={isDark ? 'text-gray-500' : 'text-gray-400'}>Contact</span>
                            <span className={`truncate ml-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                              {unit.tenant_phone || '—'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className={isDark ? 'text-gray-500' : 'text-gray-400'}>Rent</span>
                            <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                              {unit.monthly_rent ? `₱${unit.monthly_rent.toLocaleString()}` : '—'}
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </section>
        )}

        {/* ════════════════════════════════════════════════════════
            MANAGERS SUB-TAB
           ════════════════════════════════════════════════════════ */}
        {activeSubTab === 'managers' && (
        <section>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
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
            <button
              onClick={openAddManagerModal}
              className="inline-flex items-center gap-2 px-5 py-3 bg-primary hover:bg-primary-600 text-white font-semibold text-base rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Manager
            </button>
          </div>

          {/* Table */}
          <div className={`${cardClass} overflow-hidden flex flex-col h-[calc(100vh-260px)]`}>
            <div className="overflow-x-auto overflow-y-auto flex-1">
              <table className="w-full text-base table-fixed">
                <thead className="sticky top-0 z-[1]">
                  <tr className={`border-b ${isDark ? 'border-[#1E293B] bg-[#111D32]' : 'border-gray-200 bg-white'}`}>
                    {[
                      { label: 'Name', width: 'w-[18%]' },
                      { label: 'Email', width: 'w-[28%]' },
                      { label: 'Phone', width: 'w-[16%]' },
                      { label: 'Status', width: 'w-[12%]' },
                      { label: 'Date Created', width: 'w-[18%]' },
                      { label: '', width: 'w-[8%]' },
                    ].map((h) => (
                      <th key={h.label} className={`text-left py-3.5 px-4 font-medium ${h.width} ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        {h.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {managersLoading && (
                    <tr>
                      <td colSpan={6} className={`py-8 text-center ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        Loading managers...
                      </td>
                    </tr>
                  )}
                  {!managersLoading &&
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
                                onClick={() => handleDeleteManager(manager.id)}
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
                  {!managersLoading && filtered.length === 0 && (
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
        </section>
        )}

        {/* ════════════════════════════════════════════════════════
            TENANTS SUB-TAB
           ════════════════════════════════════════════════════════ */}
        {activeSubTab === 'tenants' && (
        <section className="flex flex-col flex-1 min-h-0">
          <div className="mb-4">
            <h3 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Tenants
            </h3>
            <p className={`text-sm mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              {tenantsList.length} active tenant{tenantsList.length !== 1 ? 's' : ''}
            </p>
          </div>

          <div className={`${cardClass} overflow-hidden flex flex-col flex-1 min-h-0`}>
            <div className="overflow-auto flex-1">
              <table className="w-full text-base">
                <thead className="sticky top-0 z-[1]">
                  <tr className={`border-b ${isDark ? 'border-[#1E293B] bg-[#111D32]' : 'border-gray-200 bg-white'}`}>
                    {['Name', 'Phone', 'Unit', 'Rent'].map((h) => (
                      <th key={h} className={`text-left py-3.5 px-4 font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {unitsLoading && (
                    <tr>
                      <td colSpan={4} className={`py-8 text-center ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        Loading tenants...
                      </td>
                    </tr>
                  )}
                  {!unitsLoading && tenantsList.map((t) => (
                    <tr
                      key={t.id}
                      className={`border-b last:border-0 transition-colors ${
                        isDark ? 'border-[#1E293B] hover:bg-white/[0.02]' : 'border-gray-100 hover:bg-gray-50'
                      }`}
                    >
                      <td className={`py-3.5 px-4 font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {t.name}
                      </td>
                      <td className={`py-3.5 px-4 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                        {t.phone}
                      </td>
                      <td className={`py-3.5 px-4 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                        {t.unit}
                      </td>
                      <td className={`py-3.5 px-4 font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {t.rent ? `₱${t.rent.toLocaleString()}` : '—'}
                      </td>
                    </tr>
                  ))}
                  {!unitsLoading && tenantsList.length === 0 && (
                    <tr>
                      <td colSpan={4} className={`py-8 text-center ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                        No tenants found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════
          MODALS
         ══════════════════════════════════════════════════════════ */}

      {/* Add Units Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowAddModal(false)} />
          <div
            className={`relative w-full max-w-md mx-4 rounded-xl border p-6 ${
              isDark ? 'bg-[#111C32] border-[#1E293B]' : 'bg-white border-gray-200'
            }`}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Add Units
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className={isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-700'}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <Label className={isDark ? 'text-gray-300' : 'text-gray-700'}>How many units do you have?</Label>
                <Input
                  type="number"
                  value={addForm.count}
                  onChange={(e) => setAddForm({ ...addForm, count: e.target.value })}
                  placeholder="1"
                  min="1"
                  max="100"
                  className={`mt-2 ${inputClass}`}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <Button
                variant="outline"
                onClick={() => setShowAddModal(false)}
                className={isDark ? 'border-[#1E293B] text-gray-300 hover:bg-white/5' : ''}
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddUnits}
                className="bg-primary hover:bg-primary/90 text-white font-semibold"
              >
                Add {addForm.count || 0} Unit{Number(addForm.count) !== 1 ? 's' : ''}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Manager Modal */}
      {showManagerModal && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowManagerModal(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pt-20">
            <div className={`relative w-full max-w-md rounded-xl border p-6 ${isDark ? 'bg-[#111C32] border-[#1E293B]' : 'bg-white border-gray-200'}`}>
              <div className="flex items-center justify-between mb-2">
                <h3 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {editingManager ? 'Edit Manager' : 'Create Account Manager'}
                </h3>
                <button onClick={() => setShowManagerModal(false)} className={isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-700'}>
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
                    placeholder="manager@example.com"
                    className={inputClass}
                  />
                </div>
                <div>
                  <Label className={isDark ? 'text-gray-300' : 'text-gray-700'}>Phone Number</Label>
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
                  onClick={() => setShowManagerModal(false)}
                  className={isDark ? 'border-[#1E293B] text-gray-300 hover:bg-white/5' : ''}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveManager}
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

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => !deleting && setDeleteConfirm(null)} />
          <div
            className={`relative w-full max-w-sm mx-4 rounded-xl border p-6 ${
              isDark ? 'bg-[#111C32] border-[#1E293B]' : 'bg-white border-gray-200'
            }`}
          >
            <div className="flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-full bg-red-500/15 flex items-center justify-center mb-4">
                <AlertTriangle className="w-6 h-6 text-red-500" />
              </div>
              <h3 className={`text-lg font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Delete {deleteConfirm.name}?
              </h3>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                This will permanently delete this unit and remove any tenants assigned to it. This action cannot be undone.
              </p>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setDeleteConfirm(null)}
                disabled={deleting}
                className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isDark
                    ? 'bg-[#1E293B] text-gray-300 hover:bg-[#2a3a50]'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                } disabled:opacity-50`}
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteUnit}
                disabled={deleting}
                className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium bg-red-500 hover:bg-red-600 text-white transition-colors disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
