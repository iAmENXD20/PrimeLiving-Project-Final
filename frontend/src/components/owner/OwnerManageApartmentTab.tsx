import { Search, Plus, MoreHorizontal, Edit2, Trash2, X, Copy, Check, Send, Mail, Building2, Users, UserCheck, ChevronDown, Eye, ChevronLeft, MapPin, Download } from 'lucide-react'
import { useState, useEffect, useRef, useMemo } from 'react'
import { toast } from 'sonner'
import { useTheme } from '../../context/ThemeContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import ConfirmationModal from '@/components/ui/ConfirmationModal'
import { CardsSkeleton, TableSkeleton } from '@/components/ui/skeleton'
import TablePagination from '@/components/ui/table-pagination'
import AddressSelector, { type StructuredAddress } from '@/components/ui/AddressSelector'
import {
  getOwnerUnits,
  getOwnerTenants,
  deleteOwnerApartment,
  getOwnerManagers,
  createOwnerManager,
  updateOwnerManager,
  deleteOwnerManager,
  resendManagerInvite,
  getManagerIdPhotos,
  approveManager,
  getTenantIdPhotos,
  updateUnit,
  createOwnerApartment,
  approveTenant,
  getOwnerProperties,
  createOwnerProperty,
  type Property,
  type UnitWithTenant,
  type OwnerTenant,
} from '../../lib/ownerApi'

interface OwnerManageApartmentTabProps {
  clientId: string
  mode?: 'units' | 'manage'
}

interface Manager {
  id: string
  first_name: string
  last_name: string
  email: string
  phone: string | null
  status: string
  joined_date: string
  updated_at: string
  apartment_id: string | null
  apartment?: { id: string; name: string; address: string | null } | null
}

export default function OwnerManageApartmentTab({ clientId: ownerId, mode = 'manage' }: OwnerManageApartmentTabProps) {
  const { isDark } = useTheme()

  // ─── Units state ──────────────────────────────────────────────
  const [units, setUnits] = useState<UnitWithTenant[]>([])
  const [unitsLoading, setUnitsLoading] = useState(true)
  const [unitPage, setUnitPage] = useState(1)
  const unitPageSize = 12
  const [confirmAction, setConfirmAction] = useState<
    { type: 'unit'; id: string; name: string } | { type: 'manager'; id: string; name: string } | null
  >(null)
  const [deleting, setDeleting] = useState(false)

  // ─── Unit detail modal state ───────────────────────────────
  const [selectedUnit, setSelectedUnit] = useState<UnitWithTenant | null>(null)
  const [editForm, setEditForm] = useState({ name: '', monthly_rent: '' as string, max_occupancy: '' as string, status: 'active' })
  const [savingUnit, setSavingUnit] = useState(false)
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false)
  const statusDropdownRef = useRef<HTMLDivElement>(null)

  // ─── Add Unit modal state ─────────────────────────────────
  const [showAddUnitModal, setShowAddUnitModal] = useState(false)
  const [addUnitForm, setAddUnitForm] = useState({ monthly_rent: '', max_occupancy: '', count: '1' })
  const [addingUnit, setAddingUnit] = useState(false)

  // ─── Properties (buildings/locations) state ───────────────
  const [properties, setProperties] = useState<Property[]>([])
  const [propertiesLoading, setPropertiesLoading] = useState(true)
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null)
  const [showAddPropertyModal, setShowAddPropertyModal] = useState(false)
  const [addPropertyForm, setAddPropertyForm] = useState<{ name: string; address: StructuredAddress | null; manager_id: string }>({ name: '', address: null, manager_id: '' })
  const [addingProperty, setAddingProperty] = useState(false)
  const [managerDropdownOpen, setManagerDropdownOpen] = useState(false)
  const [managerSearch, setManagerSearch] = useState('')
  const managerDropdownRef = useRef<HTMLDivElement>(null)

  // ─── Managers state ───────────────────────────────────────────
  const [managers, setManagers] = useState<Manager[]>([])
  const [managersLoading, setManagersLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [showManagerModal, setShowManagerModal] = useState(false)
  const [editingManager, setEditingManager] = useState<Manager | null>(null)
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', sex: '', age: '', apartment_id: '' })
  const [phonePrefixError, setPhonePrefixError] = useState(false)
  const [isSexOpen, setIsSexOpen] = useState(false)
  const sexRef = useRef<HTMLDivElement>(null)
  const [saving, setSaving] = useState(false)
  const [showCredentials, setShowCredentials] = useState(false)
  const [credentials, setCredentials] = useState({ name: '', email: '', password: '' })
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [smsPhone, setSmsPhone] = useState('')
  const [smsSending, setSmsSending] = useState(false)
  const [smsSent, setSmsSent] = useState(false)
  const [emailSending, setEmailSending] = useState(false)
  const [emailSent, setEmailSent] = useState(false)

  // ─── Sub-tab state ────────────────────────────────────────────
  const [activeSubTab, setActiveSubTab] = useState<'units' | 'managers' | 'tenants'>(mode === 'units' ? 'units' : 'managers')
  const [ownerTenants, setOwnerTenants] = useState<OwnerTenant[]>([])
  const [tenantsTabLoading, setTenantsTabLoading] = useState(true)
  const [showInactiveTenants, setShowInactiveTenants] = useState(false)
  const [tenantStatusFilter, setTenantStatusFilter] = useState<'all' | 'active' | 'inactive' | 'pending_verification'>('all')
  const [tenantSearch, setTenantSearch] = useState('')
  const [viewTenant, setViewTenant] = useState<{ id: string; name: string; phone: string; unit: string; rent: number; status: string; branch: string; address: string } | null>(null)
  const [viewManager, setViewManager] = useState<Manager | null>(null)
  const [managerIdPhotos, setManagerIdPhotos] = useState<{ id_type: string; id_type_other: string | null; front_url: string | null; back_url: string | null } | null>(null)
  const [idPhotosLoading, setIdPhotosLoading] = useState(false)
  const [approving, setApproving] = useState(false)
  const [tenantIdPhotos, setTenantIdPhotos] = useState<{ id_type: string; id_type_other: string | null; front_url: string | null; back_url: string | null } | null>(null)
  const [tenantIdPhotosLoading, setTenantIdPhotosLoading] = useState(false)
  const [approvingTenant, setApprovingTenant] = useState(false)
  const [managersPage, setManagersPage] = useState(1)
  const [tenantsPage, setTenantsPage] = useState(1)
  const pageSize = 10
  const [managerStatusFilter, setManagerStatusFilter] = useState<'all' | 'active' | 'inactive' | 'pending_verification'>('all')
  const [managerFilterOpen, setManagerFilterOpen] = useState(false)
  const managerFilterRef = useRef<HTMLDivElement>(null)
  const [tenantFilterOpen, setTenantFilterOpen] = useState(false)
  const tenantFilterRef = useRef<HTMLDivElement>(null)

  // ─── Load data ────────────────────────────────────────────────
  useEffect(() => {
    loadProperties()
    loadUnits()
    loadManagers()
    loadTenants()
  }, [ownerId])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (sexRef.current && !sexRef.current.contains(e.target as Node)) setIsSexOpen(false)
      if (managerDropdownRef.current && !managerDropdownRef.current.contains(e.target as Node)) setManagerDropdownOpen(false)
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(e.target as Node)) setStatusDropdownOpen(false)
      if (managerFilterRef.current && !managerFilterRef.current.contains(e.target as Node)) setManagerFilterOpen(false)
      if (tenantFilterRef.current && !tenantFilterRef.current.contains(e.target as Node)) setTenantFilterOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function loadProperties() {
    try {
      setPropertiesLoading(true)
      const data = await getOwnerProperties(ownerId)
      setProperties(data)
    } catch (err) {
      console.error('Failed to load properties:', err)
    } finally {
      setPropertiesLoading(false)
    }
  }

  async function loadUnits() {
    try {
      setUnitsLoading(true)
      const data = await getOwnerUnits(ownerId)
      data.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
      setUnits(data)
    } catch (err) {
      console.error('Failed to load units:', err)
    } finally {
      setUnitsLoading(false)
    }
  }

  // ─── Sample/mock managers for frontend reference ───────────
  const sampleManagers: Manager[] = [
    { id: 'sample-1', first_name: 'Maria', last_name: 'Santos', email: 'maria.santos@example.com', phone: '+639171234567', status: 'active', joined_date: '2026-01-15T08:00:00Z', updated_at: '2026-01-15T08:00:00Z', apartment_id: null, apartment: null },
    { id: 'sample-2', first_name: 'Carlos', last_name: 'Reyes', email: 'carlos.reyes@example.com', phone: '+639182345678', status: 'active', joined_date: '2026-02-10T08:00:00Z', updated_at: '2026-02-10T08:00:00Z', apartment_id: null, apartment: null },
    { id: 'sample-3', first_name: 'Ana', last_name: 'Garcia', email: 'ana.garcia@example.com', phone: '+639193456789', status: 'pending', joined_date: '2026-03-05T08:00:00Z', updated_at: '2026-03-05T08:00:00Z', apartment_id: null, apartment: null },
    { id: 'sample-4', first_name: 'Jose', last_name: 'Cruz', email: 'jose.cruz@example.com', phone: '+639204567890', status: 'pending_verification', joined_date: '2026-03-20T08:00:00Z', updated_at: '2026-03-20T08:00:00Z', apartment_id: null, apartment: null },
    { id: 'sample-5', first_name: 'Liza', last_name: 'Mendoza', email: 'liza.mendoza@example.com', phone: '+639215678901', status: 'active', joined_date: '2026-01-28T08:00:00Z', updated_at: '2026-01-28T08:00:00Z', apartment_id: null, apartment: null },
    { id: 'sample-6', first_name: 'Rafael', last_name: 'Bautista', email: 'rafael.bautista@example.com', phone: '+639226789012', status: 'inactive', joined_date: '2025-11-12T08:00:00Z', updated_at: '2025-11-12T08:00:00Z', apartment_id: null, apartment: null },
    { id: 'sample-7', first_name: 'Patricia', last_name: 'Villanueva', email: 'patricia.v@example.com', phone: '+639237890123', status: 'active', joined_date: '2026-02-22T08:00:00Z', updated_at: '2026-02-22T08:00:00Z', apartment_id: null, apartment: null },
    { id: 'sample-8', first_name: 'Miguel', last_name: 'Aquino', email: 'miguel.aquino@example.com', phone: '+639248901234', status: 'pending_verification', joined_date: '2026-04-01T08:00:00Z', updated_at: '2026-04-01T08:00:00Z', apartment_id: null, apartment: null },
    { id: 'sample-9', first_name: 'Sofia', last_name: 'Ramos', email: 'sofia.ramos@example.com', phone: '+639259012345', status: 'pending', joined_date: '2026-04-08T08:00:00Z', updated_at: '2026-04-08T08:00:00Z', apartment_id: null, apartment: null },
    { id: 'sample-10', first_name: 'Daniel', last_name: 'Torres', email: 'daniel.torres@example.com', phone: '+639260123456', status: 'active', joined_date: '2026-03-15T08:00:00Z', updated_at: '2026-03-15T08:00:00Z', apartment_id: null, apartment: null },
  ]

  async function loadManagers() {
    try {
      setManagersLoading(true)
      const data = await getOwnerManagers(ownerId)
      // Merge real data with sample data for frontend reference
      setManagers([...data, ...sampleManagers])
    } catch (err) {
      console.error('Failed to load managers:', err)
      // Show sample data even if API fails
      setManagers(sampleManagers)
    } finally {
      setManagersLoading(false)
    }
  }

  // ─── Sample/mock tenants for frontend reference ────────────
  const sampleTenants: OwnerTenant[] = [
    { id: 'sample-t1', first_name: 'Elena', last_name: 'Flores', phone: '+639171111111', unit_id: null, status: 'active', monthly_rent: 8500 },
    { id: 'sample-t2', first_name: 'Marco', last_name: 'Pascual', phone: '+639172222222', unit_id: null, status: 'active', monthly_rent: 9000 },
    { id: 'sample-t3', first_name: 'Jasmine', last_name: 'Lopez', phone: '+639173333333', unit_id: null, status: 'pending_verification', monthly_rent: 7500 },
    { id: 'sample-t4', first_name: 'Rico', last_name: 'Dimaculangan', phone: '+639174444444', unit_id: null, status: 'active', monthly_rent: 10000 },
    { id: 'sample-t5', first_name: 'Christine', last_name: 'Tan', phone: '+639175555555', unit_id: null, status: 'pending_verification', monthly_rent: 8000 },
    { id: 'sample-t6', first_name: 'Bryan', last_name: 'Navarro', phone: '+639176666666', unit_id: null, status: 'active', monthly_rent: 9500 },
    { id: 'sample-t7', first_name: 'Angela', last_name: 'De Leon', phone: '+639177777777', unit_id: null, status: 'inactive' as any, monthly_rent: 7000 },
    { id: 'sample-t8', first_name: 'Jerome', last_name: 'Santiago', phone: '+639178888888', unit_id: null, status: 'active', monthly_rent: 11000 },
    { id: 'sample-t9', first_name: 'Katrina', last_name: 'Rivera', phone: '+639179999999', unit_id: null, status: 'active', monthly_rent: 8500 },
    { id: 'sample-t10', first_name: 'Paolo', last_name: 'Gonzales', phone: '+639170000000', unit_id: null, status: 'active', monthly_rent: 9200 },
    { id: 'sample-t11', first_name: 'Diana', last_name: 'Reyes', phone: '+639171010101', unit_id: null, status: 'pending_verification', monthly_rent: 8800 },
  ]

  async function loadTenants() {
    try {
      setTenantsTabLoading(true)
      const data = await getOwnerTenants(ownerId, true)
      setOwnerTenants([...data, ...sampleTenants])
    } catch (err) {
      console.error('Failed to load tenants:', err)
      setOwnerTenants(sampleTenants)
    } finally {
      setTenantsTabLoading(false)
    }
  }

  // Fetch ID photos when viewing a manager that has completed activation
  useEffect(() => {
    if (viewManager && (viewManager.status === 'pending_verification' || viewManager.status === 'active')) {
      setIdPhotosLoading(true)
      setManagerIdPhotos(null)
      // For sample managers, show placeholder ID photos
      if (viewManager.id.startsWith('sample-')) {
        setManagerIdPhotos({
          id_type: 'Philippine National ID',
          id_type_other: null,
          front_url: 'https://placehold.co/600x400/e2e8f0/475569?text=ID+Front',
          back_url: 'https://placehold.co/600x400/e2e8f0/475569?text=ID+Back',
        })
        setIdPhotosLoading(false)
        return
      }
      getManagerIdPhotos(viewManager.id)
        .then(res => setManagerIdPhotos(res))
        .catch(() => setManagerIdPhotos(null))
        .finally(() => setIdPhotosLoading(false))
    } else {
      setManagerIdPhotos(null)
    }
  }, [viewManager?.id, viewManager?.status])

  // Fetch ID photos when viewing a tenant that has completed activation
  useEffect(() => {
    if (viewTenant && (viewTenant.status === 'pending_verification' || viewTenant.status === 'active')) {
      setTenantIdPhotosLoading(true)
      setTenantIdPhotos(null)
      // For sample tenants, show placeholder ID photos
      if (viewTenant.id.startsWith('sample-')) {
        setTenantIdPhotos({
          id_type: 'Philippine National ID',
          id_type_other: null,
          front_url: 'https://placehold.co/600x400/e2e8f0/475569?text=ID+Front',
          back_url: 'https://placehold.co/600x400/e2e8f0/475569?text=ID+Back',
        })
        setTenantIdPhotosLoading(false)
        return
      }
      getTenantIdPhotos(viewTenant.id)
        .then(res => setTenantIdPhotos(res))
        .catch(() => setTenantIdPhotos(null))
        .finally(() => setTenantIdPhotosLoading(false))
    } else {
      setTenantIdPhotos(null)
    }
  }, [viewTenant?.id, viewTenant?.status])

  // ─── Units handlers ───────────────────────────────────────────
  function openUnitModal(unit: UnitWithTenant) {
    setSelectedUnit(unit)
    setEditForm({
      name: unit.name,
      monthly_rent: unit.monthly_rent != null ? String(unit.monthly_rent) : '',
      max_occupancy: unit.max_occupancy != null ? String(unit.max_occupancy) : '',
      status: unit.status || 'active',
    })
  }

  async function saveUnitDetails() {
    if (!selectedUnit) return
    const trimmed = editForm.name.trim()
    if (!trimmed) {
      toast.error('Unit name cannot be empty')
      return
    }
    setSavingUnit(true)
    try {
      const maxOcc = editForm.max_occupancy.trim() === '' ? null : parseInt(editForm.max_occupancy, 10)
      const rent = editForm.monthly_rent.trim() === '' ? 0 : parseFloat(editForm.monthly_rent)
      await updateUnit(selectedUnit.id, {
        name: trimmed,
        monthly_rent: rent,
        max_occupancy: maxOcc,
        status: editForm.status,
      })
      setUnits((prev) =>
        prev.map((u) =>
          u.id === selectedUnit.id
            ? { ...u, name: trimmed, monthly_rent: rent, max_occupancy: maxOcc, status: editForm.status }
            : u
        )
      )
      toast.success('Unit updated successfully')
      setSelectedUnit(null)
    } catch {
      toast.error('Failed to update unit')
    } finally {
      setSavingUnit(false)
    }
  }

  async function handleDeleteUnit(unitId: string, unitName: string) {
    setConfirmAction({ type: 'unit', id: unitId, name: unitName })
  }

  async function handleAddUnit() {
    const count = parseInt(addUnitForm.count, 10) || 1
    // Auto-generate starting number based on existing units (filter to current property)
    const propertyUnits = selectedProperty
      ? units.filter(u => u.apartment_id === selectedProperty.id)
      : units
    const existingNumbers = propertyUnits.map((u) => {
      const match = u.name.match(/(\d+)/)
      return match ? parseInt(match[1], 10) : 0
    })
    const startNum = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1
    setAddingUnit(true)
    try {
      const rent = addUnitForm.monthly_rent ? parseFloat(addUnitForm.monthly_rent) : 0
      for (let i = 0; i < count; i++) {
        await createOwnerApartment({
          name: `Unit ${startNum + i}`,
          address: '-',
          monthly_rent: rent,
          apartmentowner_id: ownerId,
          ...(selectedProperty ? { apartment_id: selectedProperty.id } : {}),
          ...(selectedProperty?.manager_id ? { manager_id: selectedProperty.manager_id } : {}),
        })
      }
      await loadUnits()
      await loadProperties()
      toast.success(count === 1 ? 'Unit added successfully' : `${count} units added successfully`)
      setShowAddUnitModal(false)
      setAddUnitForm({ monthly_rent: '', max_occupancy: '', count: '1' })
    } catch {
      toast.error('Failed to add unit')
    } finally {
      setAddingUnit(false)
    }
  }

  async function handleAddProperty() {
    const trimmedName = addPropertyForm.name.trim()
    if (!trimmedName) {
      toast.error('Property name is required')
      return
    }
    if (!addPropertyForm.manager_id) {
      toast.error('Please assign an apartment manager')
      return
    }
    if (!addPropertyForm.address) {
      toast.error('Please complete the address fields (Region, City/Municipality, Barangay)')
      return
    }
    if (!addPropertyForm.address.street?.trim()) {
      toast.error('Street address is required')
      return
    }
    setAddingProperty(true)
    try {
      await createOwnerProperty({
        name: trimmedName,
        address: addPropertyForm.address.full,
        apartmentowner_id: ownerId,
        manager_id: addPropertyForm.manager_id,
      })
      await loadProperties()
      toast.success('Property added successfully')
      setShowAddPropertyModal(false)
      setAddPropertyForm({ name: '', address: null, manager_id: '' })
    } catch {
      toast.error('Failed to add property')
    } finally {
      setAddingProperty(false)
    }
  }

  async function handleApproveTenant(tenantId: string) {
    try {
      if (!tenantId.startsWith('sample-')) {
        await approveTenant(tenantId)
      }
      setOwnerTenants((prev) => prev.map((t) => t.id === tenantId ? { ...t, status: 'active' as const } : t))
      toast.success('Tenant approved successfully')
    } catch {
      toast.error('Failed to approve tenant')
    }
  }

  async function confirmDeleteAction() {
    if (!confirmAction) return
    setDeleting(true)
    try {
      if (confirmAction.type === 'unit') {
        await deleteOwnerApartment(confirmAction.id)
        await loadUnits()
        toast.success(`${confirmAction.name} deleted successfully`)
      } else {
        await deleteOwnerManager(confirmAction.id)
        setManagers((prev) => prev.filter((m) => m.id !== confirmAction.id))
        setOpenMenu(null)
        toast.success('Manager deleted')
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete item'
      toast.error(message)
    } finally {
      setDeleting(false)
      setConfirmAction(null)
    }
  }

  const { occupiedCount, renovationCount, availableCount, occupancyData } = useMemo(() => {
    const occupiedCount = units.filter((u) => u.tenant_name).length
    const renovationCount = units.filter((u) => u.status === 'under_renovation').length
    const availableCount = units.length - occupiedCount - renovationCount
    const occupancyData = [
      { name: 'Occupied', value: occupiedCount },
      { name: 'Vacant', value: availableCount },
      { name: 'Under Renovation', value: renovationCount },
    ].filter((d) => d.value > 0)
    return { occupiedCount, renovationCount, availableCount, occupancyData }
  }, [units])

  const PIE_COLORS = ['#059669', '#EF4444', '#22C55E']
  const OCCUPANCY_COLORS = ['#EF4444', '#22C55E', '#F59E0B']

  // ─── Managers handlers ────────────────────────────────────────
  function openAddManagerModal() {
    setEditingManager(null)
    setForm({ firstName: '', lastName: '', email: '', phone: '', sex: '', age: '', apartment_id: '' })
    setShowManagerModal(true)
  }

  function openEditModal(manager: Manager) {
    setEditingManager(manager)
    setForm({ firstName: manager.first_name || '', lastName: manager.last_name || '', email: manager.email, phone: (manager.phone || '').replace(/^\+63/, ''), sex: (manager as any).sex || '', age: (manager as any).age || '', apartment_id: manager.apartment_id || '' })
    setShowManagerModal(true)
    setOpenMenu(null)
  }

  function handleNameInput(value: string) {
    return value.replace(/[^a-zA-Z\s'-]/g, '')
  }

  async function handleSaveManager() {
    if (!form.firstName || !form.lastName || !form.email) {
      toast.error('First name, last name, and email are required')
      return
    }

    if (form.age && (isNaN(Number(form.age)) || Number(form.age) < 18)) {
      return
    }
    const fullName = `${form.firstName.trim()} ${form.lastName.trim()}`
    try {
      setSaving(true)
      if (editingManager) {
        const updated = await updateOwnerManager(editingManager.id, {
          first_name: form.firstName.trim(),
          last_name: form.lastName.trim(),
          email: form.email,
          phone: form.phone ? `+63${form.phone}` : undefined,
        })
        setManagers((prev) => prev.map((m) => (m.id === updated.id ? updated : m)))
        toast.success('Manager updated successfully')
        setShowManagerModal(false)
      } else {
        const result = await createOwnerManager({
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          email: form.email,
          phone: form.phone ? `+63${form.phone}` : undefined,
          sex: form.sex || undefined,
          age: form.age || undefined,
          apartmentowner_id: ownerId,
        })
        setManagers((prev) => [result.manager as Manager, ...prev])
        setShowManagerModal(false)
        setCredentials({ name: fullName, email: form.email, password: result.generatedPassword })
        setShowCredentials(true)
        toast.success('Manager added successfully')
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
    const manager = managers.find((item) => item.id === id)
    setConfirmAction({ type: 'manager', id, name: manager ? `${manager.first_name} ${manager.last_name}` : 'this manager' })
    setOpenMenu(null)
  }

  const filtered = useMemo(() => managers.filter(
    (m) => {
      // Hide inactive by default (only show when explicitly filtering for inactive)
      if (managerStatusFilter === 'all' && m.status === 'inactive') return false
      if (managerStatusFilter !== 'all' && m.status !== managerStatusFilter) return false
      const q = search.toLowerCase()
      return `${m.first_name} ${m.last_name}`.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q)
    }
  ), [managers, search, managerStatusFilter])
  const managersTotalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const paginatedManagers = filtered.slice((managersPage - 1) * pageSize, managersPage * pageSize)

  // ─── Shared styles ────────────────────────────────────────────
  const cardClass = `rounded-xl border ${
    isDark ? 'bg-navy-card border-[#1E293B]' : 'bg-white border-gray-200 shadow-sm'
  }`

  const inputClass = isDark
    ? 'bg-[#0A1628] border-[#1E293B] text-white placeholder:text-gray-500'
    : 'bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400'

  const tenantsList = useMemo(() => {
    const unitNameById = new Map(units.map((unit) => [unit.id, unit.name]))
    const unitRentById = new Map(units.map((unit) => [unit.id, unit.monthly_rent]))
    const unitApartmentById = new Map(units.map((unit) => [unit.id, unit.apartment_id]))
    const propertyById = new Map(properties.map((p) => [p.id, p]))
    return ownerTenants
      .filter((tenant) => {
        // Hide inactive by default (only show when explicitly filtering for inactive)
        if (tenantStatusFilter === 'all' && tenant.status === 'inactive') return false
        if (tenantStatusFilter !== 'all' && tenant.status !== tenantStatusFilter) return false
        return true
      })
      .filter((tenant) => {
        if (!tenantSearch) return true
        const q = tenantSearch.toLowerCase()
        return `${tenant.first_name} ${tenant.last_name}`.toLowerCase().includes(q) || (tenant.phone || '').toLowerCase().includes(q)
      })
      .map((tenant) => {
        const aptId = tenant.unit_id ? unitApartmentById.get(tenant.unit_id) : null
        const prop = aptId ? propertyById.get(aptId) : null
        return {
          id: tenant.id,
          name: `${tenant.first_name} ${tenant.last_name}`.trim(),
          phone: tenant.phone || '—',
          unit: tenant.unit_id ? (unitNameById.get(tenant.unit_id) || 'Unassigned') : 'Unassigned',
          rent: tenant.unit_id ? (unitRentById.get(tenant.unit_id) || 0) : 0,
          status: tenant.status,
          branch: prop?.name || 'Unassigned',
          address: prop?.address || '—',
        }
      })
  }, [units, properties, ownerTenants, tenantStatusFilter, tenantSearch])
  const tenantsTotalPages = Math.max(1, Math.ceil(tenantsList.length / pageSize))
  const paginatedTenants = tenantsList.slice((tenantsPage - 1) * pageSize, tenantsPage * pageSize)

  useEffect(() => {
    setManagersPage(1)
  }, [search, managers.length, managerStatusFilter])

  useEffect(() => {
    if (managersPage > managersTotalPages) setManagersPage(managersTotalPages)
  }, [managersPage, managersTotalPages])

  useEffect(() => {
    setTenantsPage(1)
  }, [tenantStatusFilter, ownerTenants.length])

  useEffect(() => {
    if (tenantsPage > tenantsTotalPages) setTenantsPage(tenantsTotalPages)
  }, [tenantsPage, tenantsTotalPages])

  const activeTenantCount = useMemo(() => ownerTenants.filter((tenant) => tenant.status === 'active').length, [ownerTenants])

  const subTabs = [
    { id: 'units' as const, label: 'Units', icon: Building2 },
    { id: 'managers' as const, label: 'My Managers', icon: Users },
    { id: 'tenants' as const, label: 'My Tenants', icon: UserCheck },
  ]

  // ─── Render ───────────────────────────────────────────────────
  return (
    <>
      <div className="flex flex-col flex-1 min-h-0 gap-6 animate-fade-up">
        {/* Page Header */}
        {mode === 'manage' && (
        <div className="shrink-0">
          <h2 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            User Management
          </h2>
          <p className={`text-base mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            Manage your managers and tenants
          </p>
        </div>
        )}

        {/* Sub-Tab Navigation (only in manage mode) */}
        {mode === 'manage' && (
        <div className={`flex gap-2 overflow-x-auto pb-1 shrink-0`}>
          {subTabs.filter(tab => tab.id !== 'units').map((tab) => {
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
        )}

        {/* ════════════════════════════════════════════════════════
            UNITS / PROPERTIES VIEW
           ════════════════════════════════════════════════════════ */}
        {mode === 'units' && !selectedProperty && (
        <section className="space-y-4 flex-1">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h3 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Apartments
              </h3>
              <p className={`text-sm mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                {properties.length} {properties.length === 1 ? 'location' : 'locations'}
              </p>
            </div>
            <button
              onClick={() => { setAddPropertyForm({ name: '', address: null, manager_id: '' }); setShowAddPropertyModal(true) }}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-600 text-white font-semibold text-sm rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Apartment
            </button>
          </div>

          {/* Loading */}
          {propertiesLoading && <CardsSkeleton count={3} />}

          {/* Empty */}
          {!propertiesLoading && properties.length === 0 && (
            <div className={`text-center py-12 rounded-xl border ${isDark ? 'bg-navy-card border-[#1E293B]' : 'bg-white border-gray-200'}`}>
              <Building2 className={`w-12 h-12 mx-auto mb-3 ${isDark ? 'text-gray-600' : 'text-gray-300'}`} />
              <p className={`text-lg font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                No apartments yet
              </p>
              <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                Add your first apartment to get started
              </p>
            </div>
          )}

          {/* Property cards */}
          {!propertiesLoading && properties.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {properties.map((prop, index) => (
                <button
                  key={prop.id}
                  onClick={() => { setSelectedProperty(prop); setUnitPage(1) }}
                  className={`text-left rounded-xl border p-5 transition-all duration-200 hover:shadow-md ${
                    isDark
                      ? 'bg-navy-card border-[#1E293B] hover:border-primary/40'
                      : 'bg-white border-gray-200 hover:border-primary/40 shadow-sm'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-primary" />
                    </div>
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                      isDark ? 'bg-primary/15 text-primary' : 'bg-primary/10 text-primary-700'
                    }`}>
                      {prop.unit_count} {prop.unit_count === 1 ? 'unit' : 'units'}
                    </span>
                  </div>
                  <h4 className={`text-lg font-bold mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    Branch {index + 1}
                  </h4>
                  {prop.address && (
                    <p className={`text-sm flex items-center gap-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="truncate">{prop.address}</span>
                    </p>
                  )}
                </button>
              ))}
            </div>
          )}
        </section>
        )}

        {/* ════════════════════════════════════════════════════════
            UNITS INSIDE A SELECTED PROPERTY
           ════════════════════════════════════════════════════════ */}
        {mode === 'units' && selectedProperty && (() => {
          const propertyUnits = units.filter(u => u.apartment_id === selectedProperty.id)
          const propOccupied = propertyUnits.filter(u => u.tenant_name).length
          const propRenovation = propertyUnits.filter(u => u.status === 'under_renovation').length
          const propAvailable = propertyUnits.length - propOccupied - propRenovation
          const branchIndex = properties.findIndex(p => p.id === selectedProperty.id) + 1
          return (
        <section className="flex flex-col flex-1 min-h-0 gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <button
                onClick={() => setSelectedProperty(null)}
                className={`inline-flex items-center gap-1.5 text-sm font-medium mb-2 transition-colors ${
                  isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                <ChevronLeft className="w-4 h-4" />
                Back to Apartments
              </button>
              <h3 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Branch {branchIndex}
              </h3>
              <p className={`text-sm mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                {propertyUnits.length} total &middot;{' '}
                <span className="text-red-400 font-medium">{propOccupied} occupied</span> &middot;{' '}
                <span className="text-emerald-400 font-medium">{propAvailable} vacant</span>
                {propRenovation > 0 && (
                  <> &middot; <span className="text-amber-400 font-medium">{propRenovation} under renovation</span></>
                )}
              </p>
            </div>
            <button
              onClick={() => { setAddUnitForm({ monthly_rent: '', max_occupancy: '', count: '1' }); setShowAddUnitModal(true) }}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-600 text-white font-semibold text-sm rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Unit
            </button>
          </div>

          {/* Loading */}
          {unitsLoading && <CardsSkeleton count={6} />}

          {/* Empty */}
          {!unitsLoading && propertyUnits.length === 0 && (
            <div className={`text-center py-12 rounded-xl border ${isDark ? 'bg-navy-card border-[#1E293B]' : 'bg-white border-gray-200'}`}>
              <p className={`text-lg font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                No units yet
              </p>
              <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                Add units to this apartment
              </p>
            </div>
          )}

          {/* Unit Cards */}
          {!unitsLoading && propertyUnits.length > 0 && (() => {
            const unitTotalPages = Math.ceil(propertyUnits.length / unitPageSize)
            const paginatedUnits = propertyUnits.slice((unitPage - 1) * unitPageSize, unitPage * unitPageSize)
            return (
            <>
            <div
              className={`rounded-xl border p-4 flex-1 ${
                isDark ? 'bg-navy-card border-[#1E293B]' : 'bg-white border-gray-200 shadow-sm'
              }`}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 h-full auto-rows-fr">
                  {paginatedUnits.map((unit) => {
                    const isOccupied = !!unit.tenant_name
                    const isRenovation = unit.status === 'under_renovation'
                    const borderColor = isRenovation ? '#F59E0B' : isOccupied ? '#DC2626' : '#059669'
                    const bgColor = isRenovation
                      ? (isDark ? 'rgba(245,158,11,0.15)' : '#FEF3C7')
                      : isOccupied
                      ? (isDark ? 'rgba(220,38,38,0.15)' : '#FEE2E2')
                      : (isDark ? 'rgba(5,150,105,0.15)' : '#D1FAE5')
                    const borderSolidColor = isRenovation
                      ? (isDark ? 'rgba(245,158,11,0.3)' : '#FDE68A')
                      : isOccupied
                      ? (isDark ? 'rgba(220,38,38,0.3)' : '#FECACA')
                      : (isDark ? 'rgba(5,150,105,0.3)' : '#A7F3D0')
                    return (
                      <div
                        key={unit.id}
                        className="relative rounded-lg overflow-hidden transition-all duration-200 flex flex-col"
                        style={{
                          borderLeft: `4px solid ${borderColor}`,
                          backgroundColor: bgColor,
                          border: `1px solid ${borderSolidColor}`,
                          borderLeftWidth: '4px',
                          borderLeftColor: borderColor,
                        }}
                      >
                        {/* Header */}
                        <div className={`px-4 py-3 flex items-center justify-between ${isDark ? 'border-b border-white/5' : 'border-b border-gray-100'}`}>
                          <div className="flex items-center gap-2">
                            <span className={`text-base font-bold tracking-wide ${isDark ? 'text-white' : 'text-gray-900'}`}>
                              {unit.name.toUpperCase()}
                            </span>
                            {isRenovation && (
                              <span className="text-[0.65rem] font-semibold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-500 uppercase tracking-wide">
                                Under Renovation
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span
                              className="w-2 h-2 rounded-full flex-shrink-0"
                              style={{ backgroundColor: borderColor }}
                            />
                            <button
                              onClick={() => openUnitModal(unit)}
                              className={`p-1 rounded transition-colors ${isDark ? 'hover:bg-primary/20 text-gray-500 hover:text-primary' : 'hover:bg-primary/10 text-gray-400 hover:text-primary'}`}
                              title="Edit unit"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Body */}
                        <div className="px-4 py-3 space-y-2.5 text-[0.9rem] flex-1 flex flex-col justify-evenly">
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
            <div className="mt-auto">
              <TablePagination
                currentPage={unitPage}
                totalPages={unitTotalPages}
                totalItems={propertyUnits.length}
                pageSize={unitPageSize}
                onPageChange={setUnitPage}
                isDark={isDark}
              />
            </div>
            </>
            )
          })()}
        </section>
          )
        })()}

        {/* ════════════════════════════════════════════════════════
            MANAGERS SUB-TAB
           ════════════════════════════════════════════════════════ */}
        {mode === 'manage' && activeSubTab === 'managers' && (
        <section className="flex flex-col flex-1 min-h-0">
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
            <div className="flex items-center gap-3">
              {/* Status filter dropdown */}
              <div ref={managerFilterRef} className="relative">
                <button
                  type="button"
                  onClick={() => setManagerFilterOpen((prev) => !prev)}
                  className={`h-11 rounded-lg border px-4 pr-10 text-sm text-left focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors ${isDark ? 'bg-[#0A1628] border-[#1E293B] text-white' : 'bg-white border-gray-200 text-gray-900'}`}
                >
                  {managerStatusFilter === 'all' ? 'All Status' : managerStatusFilter === 'active' ? 'Active' : managerStatusFilter === 'inactive' ? 'Inactive' : 'Awaiting Approval'}
                </button>
                <ChevronDown
                  className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 transition-transform ${managerFilterOpen ? 'rotate-180' : ''} ${isDark ? 'text-gray-400' : 'text-gray-500'}`}
                />
                {managerFilterOpen && (
                  <div className={`absolute z-50 mt-1 w-full min-w-[160px] rounded-lg border shadow-lg animate-in fade-in zoom-in-95 duration-150 ${isDark ? 'bg-[#111C32] border-[#1E293B]' : 'bg-white border-gray-200'}`}>
                    {([['all', 'All Status'], ['active', 'Active'], ['inactive', 'Inactive'], ['pending_verification', 'Awaiting Approval']] as const).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => { setManagerStatusFilter(value); setManagerFilterOpen(false) }}
                        className={`w-full text-left px-3 py-2.5 text-sm transition-colors ${isDark ? 'text-gray-200 hover:bg-white/10' : 'text-gray-700 hover:bg-gray-100'} ${value === managerStatusFilter ? (isDark ? 'bg-white/5 font-medium' : 'bg-gray-50 font-medium') : ''}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {/* Download button */}
              <button
                onClick={() => {
                  const headers = ['Name', 'Branch', 'Address', 'Status']
                  const rows = filtered.map((m) => {
                    const prop = m.apartment_id ? properties.find(p => p.id === m.apartment_id) : null
                    const idx = m.apartment_id ? properties.findIndex(p => p.id === m.apartment_id) : -1
                    return [
                      `${m.first_name} ${m.last_name}`,
                      idx >= 0 ? `Branch ${idx + 1}` : 'Unassigned',
                      prop?.address || '—',
                      m.status === 'pending_verification' ? 'Awaiting Approval' : m.status,
                    ]
                  })
                  const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
                  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = `managers-${managerStatusFilter}-${new Date().toISOString().slice(0, 10)}.csv`
                  a.click()
                  URL.revokeObjectURL(url)
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                  isDark
                    ? 'border-[#1E293B] text-gray-300 hover:bg-white/5'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
                title="Download filtered managers as CSV"
              >
                <Download className="w-4 h-4" />
                Download
              </button>
              <button
                onClick={openAddManagerModal}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-600 text-white font-semibold text-sm rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Manager
              </button>
            </div>
          </div>

          {/* Table */}
          <div className={`${cardClass} overflow-hidden flex flex-col flex-1 min-h-0`}>
            <div className="overflow-x-auto overflow-y-auto flex-1">
              <table className="w-full text-base table-fixed">
                <thead className="sticky top-0 z-[1]">
                  <tr className={`border-b ${isDark ? 'border-[#1E293B] bg-[#111D32]' : 'border-gray-200 bg-white'}`}>
                    {['No.', 'Name', 'Branch', 'Address', 'Status', 'View'].map((h) => (
                      <th key={h} className={`text-center py-3.5 px-4 font-medium ${h === 'No.' ? 'w-16' : 'w-1/5'} ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {managersLoading && (
                    <tr>
                      <td colSpan={6} className="py-3 px-4">
                        <TableSkeleton rows={5} />
                      </td>
                    </tr>
                  )}
                  {!managersLoading &&
                    paginatedManagers.map((manager, index) => (
                      <tr
                        key={manager.id}
                        className={`border-b last:border-0 transition-colors ${
                          isDark ? 'border-[#1E293B] hover:bg-white/[0.02]' : 'border-gray-100 hover:bg-gray-50'
                        }`}
                      >
                        <td className={`py-3.5 px-4 text-center ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                          {(managersPage - 1) * pageSize + index + 1}
                        </td>
                        <td className={`py-3.5 px-4 font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                          {manager.first_name} {manager.last_name}
                        </td>
                        <td className={`py-3.5 px-4 text-center text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                          {(() => {
                            if (!manager.apartment_id) return <span className={isDark ? 'text-gray-500' : 'text-gray-400'}>Unassigned</span>
                            const idx = properties.findIndex(p => p.id === manager.apartment_id)
                            if (idx === -1) return <span className={isDark ? 'text-gray-500' : 'text-gray-400'}>Unassigned</span>
                            return `Branch ${idx + 1}`
                          })()}
                        </td>
                        <td className={`py-3.5 px-4 text-center text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                          {(() => {
                            if (!manager.apartment_id) return <span className={isDark ? 'text-gray-500' : 'text-gray-400'}>—</span>
                            const prop = properties.find(p => p.id === manager.apartment_id)
                            if (!prop?.address) return <span className={isDark ? 'text-gray-500' : 'text-gray-400'}>—</span>
                            return prop.address
                          })()}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span
                            className={`inline-block px-2.5 py-0.5 text-xs font-medium rounded-full ${
                              manager.status === 'active'
                                ? 'bg-emerald-500/15 text-emerald-400'
                                : manager.status === 'pending_verification'
                                  ? 'bg-amber-500/15 text-amber-400'
                                  : manager.status === 'inactive'
                                    ? 'bg-red-500/15 text-red-400'
                                    : 'bg-gray-500/15 text-gray-400'
                            }`}
                          >
                            {manager.status === 'pending_verification' ? 'Awaiting Approval' : manager.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <button
                            onClick={() => setViewManager(manager)}
                            className={`p-1.5 rounded-md transition-colors ${
                              isDark ? 'hover:bg-white/10 text-gray-400 hover:text-white' : 'hover:bg-gray-100 text-gray-400 hover:text-gray-700'
                            }`}
                            title="View details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
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
          {!managersLoading && (
            <TablePagination
              currentPage={managersPage}
              totalPages={managersTotalPages}
              totalItems={filtered.length}
              pageSize={pageSize}
              onPageChange={setManagersPage}
              isDark={isDark}
            />
          )}
        </section>
        )}

        {/* ════════════════════════════════════════════════════════
            TENANTS SUB-TAB
           ════════════════════════════════════════════════════════ */}
        {mode === 'manage' && activeSubTab === 'tenants' && (
        <section className="flex flex-col flex-1 min-h-0">
          <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            {/* Search */}
            <div className="relative max-w-sm">
              <Search
                className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}
              />
              <input
                type="text"
                placeholder="Search tenants..."
                value={tenantSearch}
                onChange={(e) => setTenantSearch(e.target.value)}
                className={`w-full pl-10 pr-4 py-3 rounded-lg text-base border focus:outline-none focus:ring-2 focus:ring-primary/50 ${
                  isDark
                    ? 'bg-[#0A1628] border-[#1E293B] text-white placeholder-gray-500'
                    : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'
                }`}
              />
            </div>
            <div className="flex items-center gap-3">
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                {activeTenantCount} active tenant{activeTenantCount !== 1 ? 's' : ''}
              </p>
              {/* Custom status filter dropdown */}
              <div ref={tenantFilterRef} className="relative">
                <button
                  type="button"
                  onClick={() => setTenantFilterOpen((prev) => !prev)}
                  className={`h-11 rounded-lg border px-4 pr-10 text-sm text-left focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors ${isDark ? 'bg-[#0A1628] border-[#1E293B] text-white' : 'bg-white border-gray-200 text-gray-900'}`}
                >
                  {tenantStatusFilter === 'all' ? 'All Status' : tenantStatusFilter === 'active' ? 'Active' : tenantStatusFilter === 'inactive' ? 'Inactive' : 'Awaiting Approval'}
                </button>
                <ChevronDown
                  className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 transition-transform ${tenantFilterOpen ? 'rotate-180' : ''} ${isDark ? 'text-gray-400' : 'text-gray-500'}`}
                />
                {tenantFilterOpen && (
                  <div className={`absolute z-50 mt-1 w-full min-w-[160px] rounded-lg border shadow-lg animate-in fade-in zoom-in-95 duration-150 ${isDark ? 'bg-[#111C32] border-[#1E293B]' : 'bg-white border-gray-200'}`}>
                    {([['all', 'All Status'], ['active', 'Active'], ['inactive', 'Inactive'], ['pending_verification', 'Awaiting Approval']] as const).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => { setTenantStatusFilter(value); setTenantFilterOpen(false) }}
                        className={`w-full text-left px-3 py-2.5 text-sm transition-colors ${isDark ? 'text-gray-200 hover:bg-white/10' : 'text-gray-700 hover:bg-gray-100'} ${value === tenantStatusFilter ? (isDark ? 'bg-white/5 font-medium' : 'bg-gray-50 font-medium') : ''}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={() => {
                  const headers = ['Name', 'Branch', 'Address', 'Unit/Room', 'Status']
                  const rows = tenantsList.map((t) => [
                    t.name,
                    t.branch,
                    t.address,
                    t.unit,
                    t.status === 'pending_verification' ? 'Awaiting Approval' : t.status,
                  ])
                  const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
                  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = `tenants-${tenantStatusFilter}-${new Date().toISOString().slice(0, 10)}.csv`
                  a.click()
                  URL.revokeObjectURL(url)
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                  isDark
                    ? 'border-[#1E293B] text-gray-300 hover:bg-white/5'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
                title="Download filtered tenants as CSV"
              >
                <Download className="w-4 h-4" />
                Download
              </button>
            </div>
          </div>

          <div className={`${cardClass} overflow-hidden flex flex-col flex-1 min-h-0`}>
            <div className="overflow-x-auto overflow-y-auto flex-1">
              <table className="w-full text-base table-fixed">
                <thead className="sticky top-0 z-[1]">
                  <tr className={`border-b ${isDark ? 'border-[#1E293B] bg-[#111D32]' : 'border-gray-200 bg-white'}`}>
                    {['No.', 'Name', 'Branch', 'Address', 'Unit/Room', 'Status', 'View'].map((h) => (
                      <th
                        key={h}
                        className={`text-center py-3.5 px-4 font-medium ${h === 'No.' ? 'w-16' : 'w-1/7'} ${isDark ? 'text-gray-400' : 'text-gray-500'}`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tenantsTabLoading && (
                    <tr>
                      <td colSpan={7} className="py-3 px-4">
                        <TableSkeleton rows={5} />
                      </td>
                    </tr>
                  )}
                  {!tenantsTabLoading && paginatedTenants.map((t, index) => (
                    <tr
                      key={t.id}
                      className={`border-b last:border-0 transition-colors ${
                        isDark ? 'border-[#1E293B] hover:bg-white/[0.02]' : 'border-gray-100 hover:bg-gray-50'
                      }`}
                    >
                      <td className={`py-3.5 px-4 text-center ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        {(tenantsPage - 1) * pageSize + index + 1}
                      </td>
                      <td className={`py-3.5 px-4 font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {t.name}
                      </td>
                      <td className={`py-3.5 px-4 text-center ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                        {t.branch}
                      </td>
                      <td className={`py-3.5 px-4 text-center ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                        {t.address}
                      </td>
                      <td className={`py-3.5 px-4 text-center ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                        {t.unit}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 text-xs font-medium rounded-full ${
                            t.status === 'active'
                              ? 'bg-emerald-500/15 text-emerald-400'
                              : t.status === 'pending_verification'
                                ? 'bg-amber-500/15 text-amber-400'
                                : t.status === 'inactive'
                                  ? 'bg-red-500/15 text-red-400'
                                  : 'bg-gray-500/15 text-gray-400'
                          }`}
                        >
                          {t.status === 'pending_verification' ? 'Awaiting Approval' : t.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => setViewTenant(t)}
                          className={`p-1.5 rounded-md transition-colors ${
                            isDark ? 'hover:bg-white/10 text-gray-400 hover:text-white' : 'hover:bg-gray-100 text-gray-400 hover:text-gray-700'
                          }`}
                          title="View details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!tenantsTabLoading && tenantsList.length === 0 && (
                    <tr>
                      <td colSpan={7} className={`py-8 text-center ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                        No tenants found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          {!tenantsTabLoading && (
            <TablePagination
              currentPage={tenantsPage}
              totalPages={tenantsTotalPages}
              totalItems={tenantsList.length}
              pageSize={pageSize}
              onPageChange={setTenantsPage}
              isDark={isDark}
            />
          )}
        </section>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════
          MODALS
         ══════════════════════════════════════════════════════════ */}

      {/* Add/Edit Manager Modal */}
      {showManagerModal && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowManagerModal(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pt-20">
            <div className={`relative w-full max-w-md rounded-xl border p-6 ${isDark ? 'bg-[#111C32] border-[#1E293B]' : 'bg-white border-gray-200'}`}>
              <div className="flex items-center justify-between mb-2">
                <h3 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {editingManager ? 'Edit Manager' : 'Add Manager'}
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
                </div>
                <div>
                  <Label className={isDark ? 'text-gray-300' : 'text-gray-700'}>Phone Number</Label>
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
                  onClick={() => setShowManagerModal(false)}
                  className={isDark ? 'border-[#1E293B] text-gray-300 hover:bg-white/5' : ''}
                >
                  Back
                </Button>
                <Button
                  onClick={handleSaveManager}
                  disabled={saving}
                  className="bg-primary hover:bg-primary/90 text-white font-semibold"
                >
                  {editingManager ? 'Update' : saving ? 'Adding...' : 'Add'}
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
                New Manager Added Successfully
              </h3>

              <div className={`rounded-lg p-4 space-y-2 ${isDark ? 'bg-[#0A1628] border border-[#1E293B]' : 'bg-gray-50 border border-gray-200'}`}>
                <div className="flex justify-between">
                  <span className={`text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Name</span>
                  <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{credentials.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className={`text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Email</span>
                  <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{credentials.email}</span>
                </div>
              </div>

              <div className={`mt-4 rounded-lg p-3 ${isDark ? 'bg-blue-500/10 border border-blue-500/20' : 'bg-blue-50 border border-blue-200'}`}>
                <p className={`text-sm ${isDark ? 'text-blue-400' : 'text-blue-700'}`}>
                  An account activation link has been sent to the manager's email. They will need to verify their email and set up their password to complete the account setup and access their account.
                </p>
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

      {/* Unit Detail / Edit Modal */}
      {selectedUnit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setSelectedUnit(null)} />
          <div className={`relative w-full max-w-md rounded-xl p-6 shadow-2xl ${isDark ? 'bg-navy-card border border-white/10' : 'bg-white border border-gray-200'}`}>
            <div className="flex items-center justify-between mb-5">
              <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Edit Unit
              </h3>
              <button
                onClick={() => setSelectedUnit(null)}
                className={`p-1 rounded transition-colors ${isDark ? 'text-gray-400 hover:text-white hover:bg-white/10' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'}`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <Label className="mb-1.5 block">Unit Name</Label>
                <Input
                  value={editForm.name}
                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Unit 1"
                />
              </div>
              <div>
                <Label className="mb-1.5 block">Monthly Rent (₱)</Label>
                <Input
                  type="number"
                  min={0}
                  value={editForm.monthly_rent}
                  onChange={(e) => setEditForm((f) => ({ ...f, monthly_rent: e.target.value }))}
                  placeholder="0"
                />
              </div>
              <div>
                <Label className="mb-1.5 block">Max Tenant Occupancy</Label>
                <Input
                  type="number"
                  min={1}
                  value={editForm.max_occupancy}
                  onChange={(e) => setEditForm((f) => ({ ...f, max_occupancy: e.target.value }))}
                  placeholder="No limit"
                />
              </div>
              <div>
                <Label className="mb-1.5 block">Status</Label>
                <div className="relative" ref={statusDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setStatusDropdownOpen(!statusDropdownOpen)}
                    className={`w-full px-3 py-2.5 rounded-lg border text-sm cursor-pointer flex items-center justify-between ${
                      isDark
                        ? 'bg-[#0A1628] border-[#1E293B] text-white'
                        : 'bg-gray-50 border-gray-200 text-gray-900'
                    }`}
                  >
                    <span>{editForm.status === 'active' ? 'Active' : 'Under Renovation'}</span>
                    <ChevronDown className={`w-4 h-4 flex-shrink-0 transition-transform ${statusDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {statusDropdownOpen && (
                    <div className={`absolute z-50 w-full mt-1 rounded-lg border shadow-lg ${
                      isDark ? 'bg-[#111D32] border-[#1E293B]' : 'bg-white border-gray-200'
                    }`}>
                      {[
                        { value: 'active', label: 'Active' },
                        { value: 'under_renovation', label: 'Under Renovation' },
                      ].map((opt) => (
                        <div
                          key={opt.value}
                          onClick={() => {
                            setEditForm((f) => ({ ...f, status: opt.value }))
                            setStatusDropdownOpen(false)
                          }}
                          className={`px-3 py-2 text-sm cursor-pointer transition-colors ${
                            editForm.status === opt.value
                              ? (isDark ? 'bg-primary/20 text-primary' : 'bg-primary/10 text-primary')
                              : (isDark ? 'hover:bg-primary/20 text-gray-300' : 'hover:bg-primary/10 text-gray-700')
                          }`}
                        >
                          {opt.label}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Read-only info */}
              <div className={`rounded-lg p-3 space-y-2 text-sm ${isDark ? 'bg-white/5' : 'bg-gray-50'}`}>
                <div className="flex justify-between">
                  <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>Occupancy</span>
                  <span className={`font-medium capitalize ${selectedUnit.tenant_name ? 'text-red-500' : 'text-emerald-500'}`}>
                    {selectedUnit.tenant_name ? 'Occupied' : 'Vacant'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>Tenant</span>
                  <span className={isDark ? 'text-gray-200' : 'text-gray-800'}>{selectedUnit.tenant_name || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>Contact</span>
                  <span className={isDark ? 'text-gray-200' : 'text-gray-800'}>{selectedUnit.tenant_phone || '—'}</span>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <Button variant="outline" className="flex-1" onClick={() => setSelectedUnit(null)}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={saveUnitDetails} disabled={savingUnit}>
                {savingUnit ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </div>
      )}

      <ConfirmationModal
        open={Boolean(confirmAction)}
        isDark={isDark}
        title={confirmAction ? `Delete ${confirmAction.name}?` : 'Delete item?'}
        description={
          confirmAction?.type === 'unit'
            ? 'This will permanently delete this unit and remove any tenants assigned to it. This action cannot be undone.'
            : 'This will deactivate this manager account. This action cannot be undone.'
        }
        confirmText="Delete"
        loading={deleting}
        onCancel={() => setConfirmAction(null)}
        onConfirm={confirmDeleteAction}
      />

      {/* Add Unit Modal */}
      {showAddUnitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowAddUnitModal(false)} />
          <div className={`relative w-full max-w-md rounded-xl p-6 shadow-2xl ${isDark ? 'bg-navy-card border border-white/10' : 'bg-white border border-gray-200'}`}>
            <div className="flex items-center justify-between mb-5">
              <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Add Unit
              </h3>
              <button
                onClick={() => setShowAddUnitModal(false)}
                className={`p-1 rounded transition-colors ${isDark ? 'text-gray-400 hover:text-white hover:bg-white/10' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'}`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <Label className="mb-1.5 block">Number of Units</Label>
                <Input
                  type="number"
                  min={1}
                  value={addUnitForm.count}
                  onChange={(e) => setAddUnitForm((f) => ({ ...f, count: e.target.value }))}
                  placeholder="1"
                />
                {(() => {
                  const count = parseInt(addUnitForm.count, 10) || 1
                  const existingNumbers = units.map((u) => {
                    const m = u.name.match(/(\d+)/)
                    return m ? parseInt(m[1], 10) : 0
                  })
                  const startNum = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1
                  return (
                    <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                      Will create: Unit {startNum}{count > 1 ? ` – Unit ${startNum + count - 1}` : ''}
                    </p>
                  )
                })()}
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <Button variant="outline" className="flex-1 hover:bg-red-50 hover:text-red-600 hover:border-red-300" onClick={() => setShowAddUnitModal(false)}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={handleAddUnit} disabled={addingUnit}>
                {addingUnit ? 'Adding...' : 'Add Unit'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* View Manager Detail Modal */}
      {viewManager && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setViewManager(null)} />
          <div className={`relative w-full max-w-md rounded-xl shadow-2xl max-h-[90vh] flex flex-col ${isDark ? 'bg-navy-card border border-white/10' : 'bg-white border border-gray-200'}`}>
            <div className="flex items-center justify-between px-6 pt-6 pb-3 flex-shrink-0">
              <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Manager Details
              </h3>
              <button
                onClick={() => setViewManager(null)}
                className={`p-1 rounded transition-colors ${isDark ? 'text-gray-400 hover:text-white hover:bg-white/10' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'}`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-6 pb-6">
            <div className="space-y-4">
              {[
                { label: 'Name', value: `${viewManager.first_name} ${viewManager.last_name}` },
                { label: 'Email', value: viewManager.email },
                { label: 'Phone', value: viewManager.phone || '—' },
                { label: 'Branch', value: (() => {
                  if (!viewManager.apartment_id) return 'Unassigned'
                  const idx = properties.findIndex(p => p.id === viewManager.apartment_id)
                  if (idx === -1) return 'Unassigned'
                  return `Branch ${idx + 1}${properties[idx].address ? ` — ${properties[idx].address}` : ''}`
                })() },
                { label: 'Status', value: viewManager.status === 'pending_verification' ? 'Awaiting Approval' : viewManager.status },
                { label: 'Date Created', value: viewManager.joined_date ? new Date(viewManager.joined_date).toLocaleDateString() : '—' },
              ].map((item) => (
                <div key={item.label} className={`flex justify-between items-center py-2 border-b ${isDark ? 'border-white/5' : 'border-gray-100'}`}>
                  <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{item.label}</span>
                  {item.label === 'Status' ? (
                    <span className={`inline-block px-2.5 py-0.5 text-xs font-medium rounded-full ${
                      viewManager.status === 'active'
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : viewManager.status === 'pending_verification'
                          ? 'bg-amber-500/15 text-amber-400'
                          : 'bg-gray-500/15 text-gray-400'
                    }`}>
                      {item.value}
                    </span>
                  ) : (
                    <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{item.value}</span>
                  )}
                </div>
              ))}
            </div>

            {/* ID Verification Section — shown for pending_verification and active */}
            {(viewManager.status === 'pending_verification' || viewManager.status === 'active') && (
              <div className="mt-5">
                <h4 className={`text-sm font-semibold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  ID Verification
                </h4>
                {idPhotosLoading ? (
                  <div className={`text-sm text-center py-6 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Loading ID photos...</div>
                ) : managerIdPhotos ? (
                  <div className="space-y-3">
                    {managerIdPhotos.id_type && (
                      <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                        <span className={isDark ? 'text-gray-500' : 'text-gray-400'}>ID Type: </span>
                        {managerIdPhotos.id_type === 'Other' && managerIdPhotos.id_type_other
                          ? managerIdPhotos.id_type_other
                          : managerIdPhotos.id_type}
                      </p>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                      {managerIdPhotos.front_url && (
                        <div>
                          <p className={`text-xs mb-1.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Front</p>
                          <a href={managerIdPhotos.front_url} target="_blank" rel="noopener noreferrer">
                            <img
                              src={managerIdPhotos.front_url}
                              alt="ID Front"
                              className={`w-full rounded-lg border object-cover aspect-[3/2] cursor-pointer hover:opacity-80 transition-opacity ${isDark ? 'border-white/10' : 'border-gray-200'}`}
                            />
                          </a>
                        </div>
                      )}
                      {managerIdPhotos.back_url && (
                        <div>
                          <p className={`text-xs mb-1.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Back</p>
                          <a href={managerIdPhotos.back_url} target="_blank" rel="noopener noreferrer">
                            <img
                              src={managerIdPhotos.back_url}
                              alt="ID Back"
                              className={`w-full rounded-lg border object-cover aspect-[3/2] cursor-pointer hover:opacity-80 transition-opacity ${isDark ? 'border-white/10' : 'border-gray-200'}`}
                            />
                          </a>
                        </div>
                      )}
                    </div>
                    {!managerIdPhotos.front_url && !managerIdPhotos.back_url && (
                      <p className={`text-sm text-center py-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>No ID photos uploaded</p>
                    )}
                  </div>
                ) : (
                  <p className={`text-sm text-center py-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Unable to load ID photos</p>
                )}
              </div>
            )}

            <div className="mt-6 flex flex-col gap-2">
              {/* Approve button for pending_verification */}
              {viewManager.status === 'pending_verification' && (
                <Button
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                  disabled={approving}
                  onClick={async () => {
                    try {
                      setApproving(true)
                      // Skip API call for sample data
                      if (!viewManager.id.startsWith('sample-')) {
                        await approveManager(viewManager.id)
                      }
                      toast.success(`${viewManager.first_name} ${viewManager.last_name} has been approved`)
                      setViewManager({ ...viewManager, status: 'active' })
                      setManagers(prev => prev.map(m => m.id === viewManager.id ? { ...m, status: 'active' } : m))
                    } catch {
                      toast.error('Failed to approve manager')
                    } finally {
                      setApproving(false)
                    }
                  }}
                >
                  {approving ? 'Approving...' : 'Approve Manager'}
                </Button>
              )}
              {viewManager.status === 'pending' && (() => {
                const inviteSentAt = new Date(viewManager.updated_at || viewManager.joined_date)
                const expiresAt = new Date(inviteSentAt.getTime() + 60 * 60 * 1000)
                const isExpired = new Date() >= expiresAt
                const msLeft = Math.max(0, expiresAt.getTime() - Date.now())
                const minsLeft = Math.ceil(msLeft / (1000 * 60))

                return (
                  <div>
                    <Button
                      className={`w-full font-semibold ${isExpired ? 'bg-primary hover:bg-primary/90 text-white' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}
                      disabled={!isExpired}
                      onClick={async () => {
                        try {
                          await resendManagerInvite(viewManager.id)
                          toast.success('Invitation resent successfully')
                          setViewManager({ ...viewManager, updated_at: new Date().toISOString() })
                        } catch {
                          toast.error('Failed to resend invitation')
                        }
                      }}
                    >
                      Resend Invite
                    </Button>
                    {!isExpired && (
                      <p className={`text-xs text-center mt-1.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                        Invite link still active — resend available in {minsLeft} min{minsLeft !== 1 ? 's' : ''}
                      </p>
                    )}
                  </div>
                )
              })()}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setViewManager(null)
                    openEditModal(viewManager)
                  }}
                >
                  Edit
                </Button>
                <Button
                  variant="outline"
                  className={`flex-1 ${isDark ? 'text-red-400 hover:bg-red-500/10 border-red-500/30' : 'text-red-500 hover:bg-red-50 border-red-200'}`}
                  onClick={() => {
                    setViewManager(null)
                    handleDeleteManager(viewManager.id)
                  }}
                >
                  Delete
                </Button>
              </div>
            </div>
            </div>
          </div>
        </div>
      )}

      {/* View Tenant Detail Modal */}
      {viewTenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setViewTenant(null)} />
          <div className={`relative w-full max-w-md rounded-xl shadow-2xl max-h-[90vh] flex flex-col ${isDark ? 'bg-navy-card border border-white/10' : 'bg-white border border-gray-200'}`}>
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
                { label: 'Name', value: viewTenant.name },
                { label: 'Phone', value: viewTenant.phone },
                { label: 'Branch', value: viewTenant.branch },
                { label: 'Address', value: viewTenant.address },
                { label: 'Unit', value: viewTenant.unit },
                { label: 'Monthly Rent', value: viewTenant.rent ? `₱${viewTenant.rent.toLocaleString()}` : '—' },
                { label: 'Status', value: viewTenant.status === 'pending_verification' ? 'Awaiting Approval' : viewTenant.status },
              ].map((item) => (
                <div key={item.label} className={`flex justify-between items-center py-2 border-b ${isDark ? 'border-white/5' : 'border-gray-100'}`}>
                  <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{item.label}</span>
                  {item.label === 'Status' ? (
                    <span className={`inline-block px-2.5 py-0.5 text-xs font-medium rounded-full ${
                      viewTenant.status === 'active'
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : viewTenant.status === 'pending_verification'
                          ? 'bg-amber-500/15 text-amber-400'
                          : 'bg-gray-500/15 text-gray-400'
                    }`}>
                      {item.value}
                    </span>
                  ) : (
                    <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{item.value}</span>
                  )}
                </div>
              ))}
            </div>

            {/* ID Verification Section — shown for pending_verification and active */}
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

            <div className="mt-6 flex flex-col gap-2">
              {/* Approve button for pending_verification */}
              {viewTenant.status === 'pending_verification' && (
                <Button
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                  disabled={approvingTenant}
                  onClick={async () => {
                    try {
                      setApprovingTenant(true)
                      if (!viewTenant.id.startsWith('sample-')) {
                        await approveTenant(viewTenant.id)
                      }
                      toast.success(`${viewTenant.name} has been approved`)
                      setViewTenant({ ...viewTenant, status: 'active' })
                      setOwnerTenants(prev => prev.map(ot => ot.id === viewTenant.id ? { ...ot, status: 'active' } : ot))
                    } catch {
                      toast.error('Failed to approve tenant')
                    } finally {
                      setApprovingTenant(false)
                    }
                  }}
                >
                  {approvingTenant ? 'Approving...' : 'Approve Tenant'}
                </Button>
              )}
              <Button variant="outline" className="w-full" onClick={() => setViewTenant(null)}>
                Close
              </Button>
            </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Property Modal */}
      {showAddPropertyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowAddPropertyModal(false)} />
          <div className={`relative w-full max-w-md rounded-xl shadow-2xl max-h-[90vh] flex flex-col ${isDark ? 'bg-navy-card border border-white/10' : 'bg-white border border-gray-200'}`}>
            <div className="flex items-center justify-between px-6 pt-6 pb-3 flex-shrink-0">
              <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Add Apartment
              </h3>
              <button
                onClick={() => setShowAddPropertyModal(false)}
                className={`p-1 rounded transition-colors ${isDark ? 'text-gray-400 hover:text-white hover:bg-white/10' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'}`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-6 pb-2">
              <div className="space-y-4">
                <div>
                  <Label className="mb-1.5 block">Assign Apartment Manager</Label>
                  <div className="relative" ref={managerDropdownRef}>
                    <button
                      type="button"
                      onClick={() => setManagerDropdownOpen(!managerDropdownOpen)}
                      className={`w-full px-3 py-2.5 rounded-lg border text-sm cursor-pointer flex items-center justify-between ${
                        isDark
                          ? 'bg-[#0A1628] border-[#1E293B] text-white'
                          : 'bg-gray-50 border-gray-200 text-gray-900'
                      }`}
                    >
                      <span className={!addPropertyForm.manager_id ? (isDark ? 'text-gray-500' : 'text-gray-400') : ''}>
                        {addPropertyForm.manager_id
                          ? (() => { const m = managers.find(m => m.id === addPropertyForm.manager_id); return m ? `${m.first_name} ${m.last_name}` : 'Select manager' })()
                          : 'Select manager'}
                      </span>
                      <ChevronDown className={`w-4 h-4 flex-shrink-0 transition-transform ${managerDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {managerDropdownOpen && (
                      <div className={`absolute z-50 w-full mt-1 rounded-lg border shadow-lg max-h-72 overflow-y-auto ${
                        isDark ? 'bg-[#111D32] border-[#1E293B]' : 'bg-white border-gray-200'
                      }`}>
                        {managers
                          .filter(m => m.status === 'active')
                          .map((mgr) => (
                            <div
                              key={mgr.id}
                              onClick={() => {
                                setAddPropertyForm((f) => ({ ...f, manager_id: mgr.id }))
                                setManagerDropdownOpen(false)
                              }}
                              className={`px-3 py-2 text-sm cursor-pointer transition-colors ${
                                isDark ? 'hover:bg-primary/20 text-gray-300' : 'hover:bg-primary/10 text-gray-700'
                              }`}
                            >
                              {mgr.first_name} {mgr.last_name}
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <Label className="mb-1.5 block">Apartment Name</Label>
                  <Input
                    value={addPropertyForm.name}
                    onChange={(e) => setAddPropertyForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Main Building, Branch 2"
                  />
                </div>

                <div className={`pt-2 border-t ${isDark ? 'border-[#1E293B]' : 'border-gray-200'}`}>
                  <p className={`text-sm font-medium mb-3 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    Address
                  </p>
                  <AddressSelector
                    isDark={isDark}
                    onChange={(addr) => setAddPropertyForm((f) => ({ ...f, address: addr }))}
                  />
                </div>


              </div>
            </div>

            <div className="flex gap-3 px-6 pt-3 pb-6 flex-shrink-0">
              <Button variant="outline" className="flex-1 hover:bg-red-50 hover:text-red-600 hover:border-red-300" onClick={() => setShowAddPropertyModal(false)}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={handleAddProperty} disabled={addingProperty}>
                {addingProperty ? 'Adding...' : 'Add Apartment'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
