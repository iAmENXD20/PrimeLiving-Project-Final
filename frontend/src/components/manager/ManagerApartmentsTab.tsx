import { ChevronDown, ChevronLeft, ChevronRight, UserMinus, X, Users, Eye } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { toast } from 'sonner'
import { useTheme } from '../../context/ThemeContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import ConfirmationModal from '@/components/ui/ConfirmationModal'
import DatePicker from '@/components/ui/DatePicker'
import { formatPhone } from '@/lib/utils'
import { CardsSkeleton } from '@/components/ui/skeleton'
import {
  getManagerUnits,
  getManagerTenants,
  updateManagerUnit,
  updateTenantMoveInDate,
  assignExistingTenantToUnit,
  removeTenantFromUnit,
  getUnitOccupants,
  type UnitWithTenant,
  type TenantAccount,
  type UnitOccupant,
} from '../../lib/managerApi'

interface ManagerApartmentsTabProps {
  managerId: string
}

export default function ManagerApartmentsTab({ managerId }: ManagerApartmentsTabProps) {
  const { isDark } = useTheme()
  const todayDate = new Date().toISOString().split('T')[0]
  const [units, setUnits] = useState<UnitWithTenant[]>([])
  const [tenants, setTenants] = useState<TenantAccount[]>([])
  const [loading, setLoading] = useState(true)

  // Edit modal
  const [selectedUnit, setSelectedUnit] = useState<UnitWithTenant | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editForm, setEditForm] = useState({ name: '', tenantId: '', monthlyRent: '', billingStartAt: todayDate, contractDuration: '', leaseStart: '', leaseEnd: '', moveInDate: '', rentDeadline: '' })
  const [emptyingUnitId, setEmptyingUnitId] = useState<string | null>(null)
  const [unitToEmpty, setUnitToEmpty] = useState<UnitWithTenant | null>(null)
  const [isTenantDropdownOpen, setIsTenantDropdownOpen] = useState(false)
  const tenantDropdownRef = useRef<HTMLDivElement>(null)
  const [occupants, setOccupants] = useState<UnitOccupant[]>([])
  const [loadingOccupants, setLoadingOccupants] = useState(false)
  const [viewingIdPhoto, setViewingIdPhoto] = useState<string | null>(null)

  // Pagination
  const UNITS_PER_PAGE = 6
  const [currentPage, setCurrentPage] = useState(1)
  const totalPages = Math.max(1, Math.ceil(units.length / UNITS_PER_PAGE))
  const paginatedUnits = units.slice((currentPage - 1) * UNITS_PER_PAGE, currentPage * UNITS_PER_PAGE)

  useEffect(() => {
    loadUnits()
  }, [managerId])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (tenantDropdownRef.current && !tenantDropdownRef.current.contains(e.target as Node)) {
        setIsTenantDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    setIsTenantDropdownOpen(false)
  }, [showEditModal])

  async function loadUnits() {
    try {
      setLoading(true)
      const [unitData, tenantData] = await Promise.all([
        getManagerUnits(managerId),
        getManagerTenants(managerId),
      ])
      setUnits(unitData)
      setTenants(tenantData.filter((t) => Boolean(t.email)))
    } catch (err) {
      console.error('Failed to load units:', err)
    } finally {
      setLoading(false)
    }
  }

  function openEditModal(unit: UnitWithTenant) {
    const assignedTenant = unit.tenant_id
      ? tenants.find((tenant) => tenant.id === unit.tenant_id)
      : null

    setSelectedUnit(unit)
    setEditForm({
      name: unit.name,
      tenantId: unit.tenant_id || '',
      monthlyRent: unit.monthly_rent?.toString() || '',
      billingStartAt: assignedTenant?.move_in_date?.slice(0, 10) || todayDate,
      contractDuration: unit.contract_duration?.toString() || '',
      leaseStart: unit.lease_start?.slice(0, 10) || '',
      leaseEnd: unit.lease_end?.slice(0, 10) || '',
      moveInDate: unit.tenant_move_in_date?.slice(0, 10) || '',
      rentDeadline: unit.rent_deadline?.slice(0, 10) || '',
    })
    setShowEditModal(true)

    // Load occupants for this unit
    setOccupants([])
    if (unit.tenant_id) {
      setLoadingOccupants(true)
      getUnitOccupants(unit.id)
        .then(setOccupants)
        .catch(() => setOccupants([]))
        .finally(() => setLoadingOccupants(false))
    }
  }

  async function handleEditUnit() {
    if (!selectedUnit) return
    try {
      // Update apartment name & unit details
      await updateManagerUnit(selectedUnit.id, {
        name: editForm.name,
        contract_duration: editForm.contractDuration ? Number(editForm.contractDuration) : null,
        lease_start: editForm.leaseStart || null,
        lease_end: editForm.leaseEnd || null,
        rent_deadline: editForm.rentDeadline || null,
      })

      const hadTenant = !!selectedUnit.tenant_id
      const hasTenantNow = !!editForm.tenantId

      if (hasTenantNow && !editForm.billingStartAt) {
        toast.error('Please select a billing start date')
        return
      }

      if (hasTenantNow) {
        await assignExistingTenantToUnit(
          selectedUnit.id,
          editForm.tenantId,
          Number(editForm.monthlyRent) || undefined,
          editForm.billingStartAt,
        )
        // Update move-in date if changed
        if (editForm.moveInDate) {
          await updateTenantMoveInDate(editForm.tenantId, editForm.moveInDate)
        }
      } else if (hadTenant && !hasTenantNow) {
        await removeTenantFromUnit(selectedUnit.id, true)
        setUnits((prev) => prev.map((unit) =>
          unit.id === selectedUnit.id
            ? { ...unit, tenant_id: null, tenant_name: null, tenant_phone: null }
            : unit
        ))
        setTenants((prev) => prev.map((tenant) =>
          tenant.id === selectedUnit.tenant_id
            ? { ...tenant, unit_id: null }
            : tenant
        ))
      }

      await loadUnits()
      setShowEditModal(false)
      toast.success(hadTenant && !hasTenantNow ? 'Unit emptied. Tenant account was preserved.' : 'Unit updated')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update unit'
      toast.error(message)
    }
  }

  async function handleEmptyUnit(unit: UnitWithTenant) {
    if (!unit.tenant_id) return
    try {
      setEmptyingUnitId(unit.id)
      await removeTenantFromUnit(unit.id, true)
      setUnits((prev) => prev.map((current) =>
        current.id === unit.id
          ? { ...current, tenant_id: null, tenant_name: null, tenant_phone: null }
          : current
      ))
      setTenants((prev) => prev.map((tenant) =>
        tenant.id === unit.tenant_id
          ? { ...tenant, unit_id: null }
          : tenant
      ))
      await loadUnits()
      toast.success('Unit emptied. Tenant account was preserved.')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to empty unit'
      toast.error(message)
    } finally {
      setEmptyingUnitId(null)
        setUnitToEmpty(null)
    }
  }

  const occupiedCount = units.filter((u) => u.tenant_name && u.status !== 'under_renovation').length
  const renovationCount = units.filter((u) => u.status === 'under_renovation').length
  const availableCount = units.length - occupiedCount - renovationCount

  const selectedTenantDetails = editForm.tenantId
    ? tenants.find((tenant) => tenant.id === editForm.tenantId)
    : null

  const formatDate = (value?: string | null) => {
    if (!value) return '—'
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) return '—'
    return parsed.toLocaleDateString()
  }

  const inputClass = isDark
    ? 'bg-[#0A1628] border-[#1E293B] text-white placeholder:text-gray-500'
    : 'bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400'

  return (
    <>
      <div className="space-y-6 animate-fade-up">
        {/* Header */}
        <div>
          <p className={`text-base ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            {units.length} units &middot;{' '}
            <span className="text-red-400 font-medium">{occupiedCount} occupied</span> &middot;{' '}
            <span className="text-emerald-400 font-medium">{availableCount} vacant</span>
            {renovationCount > 0 && (
              <> &middot; <span className="text-amber-400 font-medium">{renovationCount} under renovation</span></>
            )}
          </p>
        </div>

        {/* Loading */}
        {loading && (
          <CardsSkeleton count={6} />
        )}

        {/* Empty state */}
        {!loading && units.length === 0 && (
          <div className={`text-center py-16 rounded-xl border ${isDark ? 'bg-navy-card border-[#1E293B]' : 'bg-white border-gray-200'}`}>
            <p className={`text-lg font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
              No units assigned
            </p>
            <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
              Your owner hasn't assigned any units to you yet
            </p>
          </div>
        )}

        {/* Unit Cards Grid */}
        {!loading && units.length > 0 && (
          <div className={`rounded-xl border p-4 ${isDark ? 'bg-[#111C32] border-[#1E293B]' : 'bg-white border-gray-200'}`}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {paginatedUnits.map((unit) => {
              const isRenovation = unit.status === 'under_renovation'
              const isOccupied = !isRenovation && !!unit.tenant_name
              const isVacant = !isRenovation && !isOccupied

              const borderColor = isRenovation ? '#D97706' : isOccupied ? '#DC2626' : '#059669'
              const bgColor = isRenovation
                ? (isDark ? 'rgba(217,119,6,0.15)' : '#FEF3C7')
                : isOccupied
                  ? (isDark ? 'rgba(220,38,38,0.15)' : '#FEE2E2')
                  : (isDark ? 'rgba(5,150,105,0.15)' : '#D1FAE5')
              const borderStyleColor = isRenovation
                ? (isDark ? 'rgba(217,119,6,0.3)' : '#FDE68A')
                : isOccupied
                  ? (isDark ? 'rgba(220,38,38,0.3)' : '#FECACA')
                  : (isDark ? 'rgba(5,150,105,0.3)' : '#A7F3D0')

              const statusLabel = isRenovation ? 'Under Renovation' : isOccupied ? 'Occupied' : 'Vacant'
              const statusBadge = isRenovation
                ? 'bg-amber-500/20 text-amber-400'
                : isOccupied
                  ? 'bg-red-500/20 text-red-400'
                  : 'bg-emerald-500/20 text-emerald-400'

              return (
                <div
                  key={unit.id}
                  className="relative rounded-lg overflow-hidden cursor-pointer transition-all duration-200 hover:shadow-lg"
                  style={{
                    borderLeft: `4px solid ${borderColor}`,
                    backgroundColor: bgColor,
                    border: `1px solid ${borderStyleColor}`,
                    borderLeftWidth: '4px',
                    borderLeftColor: borderColor,
                  }}
                  onClick={() => openEditModal(unit)}
                >
                  {/* Header */}
                  <div className={`px-4 py-3 flex items-center justify-between ${isDark ? 'border-b border-white/5' : 'border-b border-gray-100'}`}>
                    <span className={`text-base font-bold tracking-wide ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {unit.name.toUpperCase()}
                    </span>
                    <div className="flex items-center gap-2">
                      {isOccupied && (
                        <button
                          type="button"
                          title="Empty Unit"
                          aria-label="Empty Unit"
                          onClick={(event) => {
                            event.stopPropagation()
                            setUnitToEmpty(unit)
                          }}
                          disabled={emptyingUnitId === unit.id}
                          className={`w-7 h-7 flex items-center justify-center rounded-full border transition-colors ${
                            isDark
                              ? 'border-red-500/30 text-red-400 hover:bg-red-500/15'
                              : 'border-red-500/30 text-red-500 hover:bg-red-500/10'
                          }`}
                        >
                          {emptyingUnitId === unit.id ? (
                            <span className="text-[10px]">...</span>
                          ) : (
                            <UserMinus className="w-3.5 h-3.5" />
                          )}
                        </button>
                      )}
                      <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${statusBadge}`}>
                        {statusLabel}
                      </span>
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
                        {unit.tenant_phone ? formatPhone(unit.tenant_phone) : '—'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className={isDark ? 'text-gray-500' : 'text-gray-400'}>Billing Period</span>
                      <span className={`ml-2 text-xs ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                        {unit.lease_start && unit.lease_end
                          ? `${new Date(unit.lease_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} — ${new Date(unit.lease_end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                          : '—'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className={isDark ? 'text-gray-500' : 'text-gray-400'}>Contract Duration</span>
                      <span className={`ml-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                        {unit.contract_duration ? `${unit.contract_duration} month${unit.contract_duration > 1 ? 's' : ''}` : '—'}
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

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className={`flex items-center justify-between mt-4 pt-4 border-t ${isDark ? 'border-[#1E293B]' : 'border-gray-200'}`}>
              <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                Showing {(currentPage - 1) * UNITS_PER_PAGE + 1}-{Math.min(currentPage * UNITS_PER_PAGE, units.length)} of {units.length}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    currentPage === 1
                      ? (isDark ? 'text-gray-600 cursor-not-allowed' : 'text-gray-300 cursor-not-allowed')
                      : (isDark ? 'text-gray-300 hover:bg-white/10' : 'text-gray-600 hover:bg-gray-100')
                  }`}
                >
                  <ChevronLeft className="w-4 h-4" />
                  Prev
                </button>
                <span className={`px-3 py-1.5 text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    currentPage === totalPages
                      ? (isDark ? 'text-gray-600 cursor-not-allowed' : 'text-gray-300 cursor-not-allowed')
                      : (isDark ? 'text-gray-300 hover:bg-white/10' : 'text-gray-600 hover:bg-gray-100')
                  }`}
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
          </div>
        )}
      </div>

      {/* Edit Unit Modal */}
      {showEditModal && selectedUnit && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/65 animate-in fade-in duration-200" onClick={() => setShowEditModal(false)} />
          <div
            className={`relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl border p-6 shadow-2xl animate-in zoom-in-95 fade-in duration-200 ${
              isDark ? 'bg-[#111C32] border-[#1E293B]' : 'bg-white border-gray-200'
            }`}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Edit Unit Information
              </h3>
              <button
                onClick={() => setShowEditModal(false)}
                className={isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-700'}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <Label className={isDark ? 'text-gray-300' : 'text-gray-700'}>Unit Name</Label>
                <Input
                  value={editForm.name}
                  readOnly
                  disabled
                  className={`mt-2 ${inputClass} opacity-60 cursor-not-allowed`}
                />
              </div>
              <div>
                <Label className={isDark ? 'text-gray-300' : 'text-gray-700'}>Assign Tenant Account</Label>
                <div ref={tenantDropdownRef} className="relative mt-2">
                  <button
                    type="button"
                    onClick={() => setIsTenantDropdownOpen(!isTenantDropdownOpen)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                      isDark
                        ? 'bg-[#111D32] border-[#1E293B] text-white hover:border-primary/40'
                        : 'bg-white border-gray-200 text-gray-900 hover:border-primary/40'
                    }`}
                  >
                    <span className={!editForm.tenantId ? (isDark ? 'text-gray-500' : 'text-gray-400') : ''}>
                      {editForm.tenantId
                        ? (() => { const t = tenants.find((t) => t.id === editForm.tenantId); return t ? `${t.first_name} ${t.last_name}` : '— No tenant assigned —'; })()
                        : '— No tenant assigned —'}
                    </span>
                    <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isTenantDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {isTenantDropdownOpen && (
                  <div
                    className={`absolute left-0 top-full mt-1 z-50 w-full rounded-lg border shadow-lg max-h-60 overflow-y-auto ${
                      isDark ? 'bg-[#111D32] border-[#1E293B]' : 'bg-white border-gray-200'
                    }`}
                  >
                    {tenants
                      .filter((t) => !t.unit_id || t.unit_id === selectedUnit?.id)
                      .map((tenant) => (
                      <button
                        type="button"
                        key={tenant.id}
                        onClick={() => {
                          setEditForm({
                            ...editForm,
                            tenantId: tenant.id,
                            billingStartAt: tenant.move_in_date?.slice(0, 10) || todayDate,
                          })
                          setIsTenantDropdownOpen(false)
                        }}
                        className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                          editForm.tenantId === tenant.id
                            ? 'bg-primary text-white font-medium'
                            : isDark
                              ? 'text-gray-300 hover:bg-white/5'
                              : 'text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {tenant.first_name} {tenant.last_name}
                      </button>
                    ))}
                  </div>
                  )}
                </div>
              </div>
              {selectedTenantDetails && (
                <div className={`rounded-lg border p-3 text-sm space-y-2 ${isDark ? 'border-[#1E293B] bg-[#0A1628]' : 'border-gray-200 bg-gray-50'}`}>
                  <p className={`font-medium ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>Selected Tenant Details</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <p className={isDark ? 'text-gray-400' : 'text-gray-600'}>Email: <span className={isDark ? 'text-gray-200' : 'text-gray-800'}>{selectedTenantDetails.email || '—'}</span></p>
                    <p className={isDark ? 'text-gray-400' : 'text-gray-600'}>Phone: <span className={isDark ? 'text-gray-200' : 'text-gray-800'}>{formatPhone(selectedTenantDetails.phone) || '—'}</span></p>
                    <p className={isDark ? 'text-gray-400' : 'text-gray-600'}>Status: <span className={`capitalize ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{selectedTenantDetails.status || '—'}</span></p>
                  </div>
                </div>
              )}
              <div>
                <Label className={isDark ? 'text-gray-300' : 'text-gray-700'}>Monthly Rent (₱)</Label>
                <div className={`mt-2 px-3 py-2 rounded-md text-sm font-medium ${isDark ? 'bg-[#0A1628] border border-[#1E293B] text-gray-200' : 'bg-gray-100 border border-gray-200 text-gray-800'}`}>
                  {editForm.monthlyRent ? `₱${Number(editForm.monthlyRent).toLocaleString()}` : '—'}
                </div>
              </div>
              <div>
                <Label className={isDark ? 'text-gray-300' : 'text-gray-700'}>Contract Duration (months)</Label>
                <Input
                  type="number"
                  min="1"
                  value={editForm.contractDuration}
                  onChange={(e) => {
                    const months = Number(e.target.value) || 0
                    let to = editForm.leaseEnd
                    if (editForm.leaseStart && months > 0) {
                      const d = new Date(editForm.leaseStart)
                      d.setMonth(d.getMonth() + months)
                      to = d.toISOString().split('T')[0]
                    }
                    setEditForm({ ...editForm, contractDuration: e.target.value, leaseEnd: to })
                  }}
                  placeholder="e.g. 6, 12"
                  className={`mt-2 ${inputClass}`}
                />
              </div>
              <div>
                <Label className={isDark ? 'text-gray-300' : 'text-gray-700'}>Move-in Date</Label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div>
                    <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>From</span>
                    <Input
                      type="date"
                      value={editForm.leaseStart}
                      onChange={(e) => {
                        const from = e.target.value
                        const months = Number(editForm.contractDuration) || 0
                        let to = editForm.leaseEnd
                        if (from && months > 0) {
                          const d = new Date(from)
                          d.setMonth(d.getMonth() + months)
                          to = d.toISOString().split('T')[0]
                        }
                        setEditForm({ ...editForm, leaseStart: from, leaseEnd: to, moveInDate: from })
                      }}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>To</span>
                    <Input
                      type="date"
                      value={editForm.leaseEnd}
                      min={editForm.leaseStart || undefined}
                      onChange={(e) => setEditForm({ ...editForm, leaseEnd: e.target.value })}
                      className={inputClass}
                    />
                  </div>
                </div>
                {editForm.leaseStart && editForm.leaseEnd && (
                  <p className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    Duration: {(() => {
                      const s = new Date(editForm.leaseStart)
                      const e = new Date(editForm.leaseEnd)
                      const months = (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth())
                      return `${months} month${months !== 1 ? 's' : ''}`
                    })()}
                  </p>
                )}
              </div>
              <div>
                <Label className={isDark ? 'text-gray-300' : 'text-gray-700'}>Rent Deadline / Billing Period</Label>
                <Input
                  type="date"
                  value={editForm.rentDeadline}
                  onChange={(e) => setEditForm({ ...editForm, rentDeadline: e.target.value })}
                  className={`mt-2 ${inputClass}`}
                />
              </div>

              {/* Occupants / Co-Residents */}
              {editForm.tenantId && (
                <div>
                  <Label className={`flex items-center gap-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    <Users className="w-4 h-4" />
                    Occupants / Co-Residents
                  </Label>
                  <div className={`mt-2 rounded-lg border p-3 space-y-2 ${isDark ? 'border-[#1E293B] bg-[#0A1628]' : 'border-gray-200 bg-gray-50'}`}>
                    {loadingOccupants ? (
                      <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Loading occupants...</p>
                    ) : occupants.length === 0 ? (
                      <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>No occupants registered by tenant</p>
                    ) : (
                      occupants.map((occ) => (
                        <div
                          key={occ.id}
                          className={`flex items-center justify-between py-2 px-3 rounded-lg ${isDark ? 'bg-[#111C32]' : 'bg-white'}`}
                        >
                          <div className="flex-1 min-w-0">
                            <span className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                              {occ.first_name && occ.last_name
                                ? `${occ.first_name} ${occ.last_name}`
                                : occ.full_name}
                            </span>
                            {(occ.sex || occ.phone || occ.birthdate) && (
                              <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                {[occ.sex, occ.birthdate ? `${Math.floor((Date.now() - new Date(occ.birthdate).getTime()) / (365.25 * 24 * 60 * 60 * 1000))} yrs old` : null, occ.phone ? formatPhone(occ.phone) : null].filter(Boolean).join(' · ')}
                              </p>
                            )}
                          </div>
                          {occ.id_photo_url ? (
                            <button
                              type="button"
                              onClick={() => setViewingIdPhoto(occ.id_photo_url)}
                              className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              View ID
                            </button>
                          ) : (
                            <span className={`text-xs ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>No ID uploaded</span>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <Button
                variant="outline"
                onClick={() => setShowEditModal(false)}
                className={isDark ? 'border-[#1E293B] text-gray-300 hover:bg-white/5' : ''}
              >
                Cancel
              </Button>
              <Button
                onClick={handleEditUnit}
                className="bg-primary hover:bg-primary/90 text-white font-semibold"
              >
                Save Changes
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}

      <ConfirmationModal
        open={Boolean(unitToEmpty)}
        isDark={isDark}
        title={unitToEmpty ? `Empty ${unitToEmpty.name}?` : 'Empty Unit?'}
        description="This will mark the unit as vacant while keeping the tenant account active for future reassignment."
        confirmText="Empty Unit"
        loading={Boolean(unitToEmpty && emptyingUnitId === unitToEmpty.id)}
        onCancel={() => setUnitToEmpty(null)}
        onConfirm={() => {
          if (unitToEmpty) handleEmptyUnit(unitToEmpty)
        }}
      />

      {/* ID Photo Viewer Modal */}
      {viewingIdPhoto && createPortal(
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setViewingIdPhoto(null)} />
          <div className="relative max-w-lg w-full">
            <button
              onClick={() => setViewingIdPhoto(null)}
              className="absolute -top-3 -right-3 z-10 w-8 h-8 rounded-full bg-white text-gray-900 flex items-center justify-center shadow-lg hover:bg-gray-100"
            >
              <X className="w-4 h-4" />
            </button>
            <img
              src={viewingIdPhoto}
              alt="Occupant ID"
              className="w-full rounded-xl shadow-2xl"
            />
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
