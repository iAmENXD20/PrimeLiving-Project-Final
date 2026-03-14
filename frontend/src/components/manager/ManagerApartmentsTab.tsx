import { X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { toast } from 'sonner'
import { useTheme } from '../../context/ThemeContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  getManagerUnits,
  getManagerTenants,
  updateManagerUnit,
  assignExistingTenantToUnit,
  removeTenantFromUnit,
  type UnitWithTenant,
  type TenantAccount,
} from '../../lib/managerApi'

interface ManagerApartmentsTabProps {
  clientId: string
}

export default function ManagerApartmentsTab({ clientId }: ManagerApartmentsTabProps) {
  const { isDark } = useTheme()
  const [units, setUnits] = useState<UnitWithTenant[]>([])
  const [tenants, setTenants] = useState<TenantAccount[]>([])
  const [loading, setLoading] = useState(true)

  // Edit modal
  const [selectedUnit, setSelectedUnit] = useState<UnitWithTenant | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editForm, setEditForm] = useState({ name: '', tenantId: '', monthlyRent: '' })

  useEffect(() => {
    loadUnits()
  }, [clientId])

  async function loadUnits() {
    try {
      setLoading(true)
      const [unitData, tenantData] = await Promise.all([
        getManagerUnits(clientId),
        getManagerTenants(clientId),
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
    setSelectedUnit(unit)
    setEditForm({
      name: unit.name,
      tenantId: unit.tenant_id || '',
      monthlyRent: unit.monthly_rent?.toString() || '',
    })
    setShowEditModal(true)
  }

  async function handleEditUnit() {
    if (!selectedUnit) return
    try {
      // Update apartment name & rent
      await updateManagerUnit(selectedUnit.id, {
        name: editForm.name,
        monthly_rent: Number(editForm.monthlyRent) || 0,
      })

      const hadTenant = !!selectedUnit.tenant_id
      const hasTenantNow = !!editForm.tenantId

      if (hasTenantNow) {
        await assignExistingTenantToUnit(selectedUnit.id, editForm.tenantId, Number(editForm.monthlyRent) || undefined)
      } else if (hadTenant && !hasTenantNow) {
        await removeTenantFromUnit(selectedUnit.id)
      }

      await loadUnits()
      setShowEditModal(false)
      toast.success('Unit updated')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update unit'
      toast.error(message)
    }
  }

  const occupiedCount = units.filter((u) => u.tenant_name).length
  const availableCount = units.length - occupiedCount

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
          </p>
        </div>

        {/* Loading */}
        {loading && (
          <div className={`text-center py-16 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            Loading units...
          </div>
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
          <div className={`rounded-xl border p-4 max-h-[65vh] overflow-y-auto ${isDark ? 'bg-[#111C32] border-[#1E293B]' : 'bg-white border-gray-200'}`}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {units.map((unit) => {
              const isOccupied = !!unit.tenant_name
              return (
                <div
                  key={unit.id}
                  className="relative rounded-lg overflow-hidden cursor-pointer transition-all duration-200 hover:shadow-lg"
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
                  onClick={() => openEditModal(unit)}
                >
                  {/* Header */}
                  <div className={`px-4 py-3 flex items-center justify-between ${isDark ? 'border-b border-white/5' : 'border-b border-gray-100'}`}>
                    <span className={`text-base font-bold tracking-wide ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {unit.name.toUpperCase()}
                    </span>
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: isOccupied ? '#DC2626' : '#059669' }}
                    />
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
        )}
      </div>

      {/* Edit Unit Modal */}
      {showEditModal && selectedUnit && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowEditModal(false)} />
          <div
            className={`relative w-full max-w-md rounded-xl border p-6 shadow-2xl ${
              isDark ? 'bg-[#111C32] border-[#1E293B]' : 'bg-white border-gray-200'
            }`}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Edit Unit
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
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  placeholder="Unit 1"
                  className={`mt-2 ${inputClass}`}
                />
              </div>
              <div>
                <Label className={isDark ? 'text-gray-300' : 'text-gray-700'}>Assign Tenant Account</Label>
                <select
                  value={editForm.tenantId}
                  onChange={(e) => setEditForm({ ...editForm, tenantId: e.target.value })}
                  className={`mt-2 w-full rounded-lg border px-3 py-2.5 text-sm ${inputClass}`}
                >
                  <option value="">— No tenant assigned —</option>
                  {tenants.map((tenant) => (
                    <option key={tenant.id} value={tenant.id}>
                      {tenant.name} ({tenant.email})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label className={isDark ? 'text-gray-300' : 'text-gray-700'}>Monthly Rent (₱)</Label>
                <Input
                  type="number"
                  value={editForm.monthlyRent}
                  onChange={(e) => setEditForm({ ...editForm, monthlyRent: e.target.value })}
                  placeholder="0"
                  className={`mt-2 ${inputClass}`}
                />
              </div>
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
    </>
  )
}
