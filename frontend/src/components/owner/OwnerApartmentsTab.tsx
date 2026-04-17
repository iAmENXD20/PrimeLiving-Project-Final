import { Plus, X } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { useTheme } from '../../context/ThemeContext'
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription'
import { suppressRealtime, isRealtimeSuppressed } from '@/lib/realtimeCooldown'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CardsSkeleton } from '@/components/ui/skeleton'
import {
  getOwnerUnits,
  createBulkUnits,
  type UnitWithTenant,
} from '../../lib/ownerApi'

interface OwnerApartmentsTabProps {
  ownerId: string
}

export default function OwnerApartmentsTab({ ownerId }: OwnerApartmentsTabProps) {
  const { isDark } = useTheme()
  const [units, setUnits] = useState<UnitWithTenant[]>([])
  const [loading, setLoading] = useState(true)
  const initialLoadDone = useRef(false)
  const loadVersion = useRef(0)

  // Add units modal
  const [showAddModal, setShowAddModal] = useState(false)
  const [addForm, setAddForm] = useState({ count: '1' })

  useEffect(() => {
    loadUnits()
  }, [ownerId])

  // Real-time: auto-refresh when units change
  useRealtimeSubscription(`owner-apartments-${ownerId}`, [
    { table: 'units', filter: `apartmentowner_id=eq.${ownerId}`, onChanged: () => loadUnits(true) },
  ])

  async function loadUnits(skipCache = false) {
    if (skipCache && isRealtimeSuppressed()) return
    const version = ++loadVersion.current
    try {
      // Only show skeleton on initial load, not on refreshes
      if (!initialLoadDone.current) setLoading(true)
      const data = await getOwnerUnits(ownerId, { skipCache })
      if (loadVersion.current !== version) return // stale response
      setUnits(data)
      initialLoadDone.current = true
    } catch (err) {
      if (loadVersion.current !== version) return
      console.error('Failed to load units:', err)
    } finally {
      if (loadVersion.current === version) setLoading(false)
    }
  }

  async function handleAddUnits() {
    const count = Number(addForm.count)

    if (count < 1 || count > 100) {
      toast.error('Please enter 1-100 units')
      return
    }

    const startNumber = units.length + 1

    // Immediately add placeholder units BEFORE API call for instant feedback
    suppressRealtime()
    const tempUnits: UnitWithTenant[] = []
    for (let i = 0; i < count; i++) {
      tempUnits.push({
        id: `temp-${crypto.randomUUID()}`,
        name: `Unit ${startNumber + i}`,
        monthly_rent: 0,
        apartmentowner_id: ownerId,
        apartment_id: null,
        manager_id: null,
        status: 'active',
        created_at: new Date().toISOString(),
        tenant_name: null,
        tenant_phone: null,
        tenant_id: null,
        max_occupancy: null,
        payment_due_day: null,
        contract_duration: null,
        lease_start: null,
        lease_end: null,
        tenant_move_in_date: null,
        rent_deadline: null,
      })
    }
    loadVersion.current++
    setUnits(prev => [...prev, ...tempUnits].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })))
    setShowAddModal(false)
    setAddForm({ count: '1' })
    toast.success(`${count} unit${count > 1 ? 's' : ''} added successfully`)

    try {
      const created = await createBulkUnits(ownerId, count, startNumber, 0)
      // Replace temp units with real data from API
      if (Array.isArray(created) && created.length > 0) {
        loadVersion.current++
        setUnits(prev => {
          // Remove temp units and add real ones
          const withoutTemp = prev.filter(u => !u.id.startsWith('temp-'))
          return [...withoutTemp, ...created.map((u: any) => ({
            id: u.id,
            name: u.name || '',
            monthly_rent: u.monthly_rent ?? 0,
            apartmentowner_id: u.apartmentowner_id || ownerId,
            apartment_id: u.apartment_id || null,
            manager_id: u.manager_id || null,
            status: u.status || 'active',
            created_at: u.created_at || new Date().toISOString(),
            tenant_name: null,
            tenant_phone: null,
            tenant_id: null,
            max_occupancy: u.max_occupancy || null,
            payment_due_day: u.payment_due_day || null,
            contract_duration: null,
            lease_start: null,
            lease_end: null,
            tenant_move_in_date: null,
            rent_deadline: null,
          }))].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
        })
      }
      // Background refetch for full data consistency
      loadUnits(true).catch(() => {})
    } catch (err: unknown) {
      // Remove temp units on error
      loadVersion.current++
      setUnits(prev => prev.filter(u => !u.id.startsWith('temp-')))
      const message = err instanceof Error ? err.message : 'Failed to add units'
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
      <div className="space-y-6 animate-fade-up flex flex-col min-h-full">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              My Units
            </h2>
            <p className={`text-base mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
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
            Update
          </button>
        </div>

        {/* Loading */}
        {loading && (
          <CardsSkeleton count={6} />
        )}

        {/* Empty state */}
        {!loading && units.length === 0 && (
          <div className={`text-center py-16 rounded-xl border ${isDark ? 'bg-navy-card border-[#1E293B]' : 'bg-white border-gray-200'}`}>
            <p className={`text-lg font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
              No units yet
            </p>
            <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
              Click "Update" to manage your apartment units
            </p>
          </div>
        )}

        {/* Unit Cards Grid (read-only) */}
        {!loading && units.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 flex-1">
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
        )}
      </div>

      {/* Add Units Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/65 animate-in fade-in duration-200" onClick={() => setShowAddModal(false)} />
          <div
            className={`relative w-full max-w-md mx-4 rounded-xl border p-6 animate-in zoom-in-95 fade-in duration-200 ${
              isDark ? 'bg-[#111C32] border-[#1E293B]' : 'bg-white border-gray-200'
            }`}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Update Units
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
    </>
  )
}
