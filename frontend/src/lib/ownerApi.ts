import { supabase } from './supabase'

// ── Types ──────────────────────────────────────────────────
export interface MaintenanceRequest {
  id: string
  tenant_id: string | null
  apartment_id: string | null
  client_id: string | null
  title: string
  description: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
  status: 'pending' | 'in_progress' | 'resolved' | 'closed'
  photo_url: string | null
  created_at: string
  updated_at: string
  tenant_name?: string
  apartment_name?: string
}

export interface Revenue {
  id: string
  apartment_id: string | null
  client_id: string | null
  amount: number
  month: string
  description: string | null
  created_at: string
  apartment_name?: string
}

// ── Get current owner (client) from auth user ─────────────
export async function getCurrentOwner() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('auth_user_id', user.id)
    .single()

  if (error) return null
  return data
}

// ── Get Owner Apartment Address ─────────────────────────────
export async function getOwnerApartmentAddress(clientId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('clients')
    .select('apartment_address')
    .eq('id', clientId)
    .single()

  if (error) return null
  return data?.apartment_address || null
}

// ── Get Client Apartment Name ──────────────────────────────
export async function getClientApartmentName(clientId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('apartments')
    .select('name')
    .eq('client_id', clientId)
    .limit(1)
    .single()

  if (error) return null
  return data?.name || null
}

// ── Update Owner Apartment Address ──────────────────────────
export async function updateOwnerApartmentAddress(clientId: string, address: string) {
  const { error } = await supabase
    .from('clients')
    .update({ apartment_address: address, updated_at: new Date().toISOString() })
    .eq('id', clientId)

  if (error) throw error
}

// ── Owner Dashboard Stats ──────────────────────────────────
export async function getOwnerDashboardStats(clientId: string) {
  const [apartments, tenants, maintenance, revenues] = await Promise.all([
    supabase.from('apartments').select('id', { count: 'exact' }).eq('client_id', clientId).eq('status', 'active'),
    supabase
      .from('tenants')
      .select('id, apartment_id', { count: 'exact' })
      .eq('status', 'active')
      .in('apartment_id', (
        await supabase.from('apartments').select('id').eq('client_id', clientId)
      ).data?.map(a => a.id) || []),
    supabase.from('maintenance_requests').select('id', { count: 'exact' }).eq('client_id', clientId).eq('status', 'pending'),
    supabase.from('revenues').select('amount').eq('client_id', clientId),
  ])

  const totalRevenue = (revenues.data || []).reduce((sum, r) => sum + Number(r.amount), 0)

  return {
    apartments: apartments.count ?? 0,
    activeTenants: tenants.count ?? 0,
    pendingMaintenance: maintenance.count ?? 0,
    totalRevenue,
  }
}

// ── Maintenance Requests ───────────────────────────────────
export async function getOwnerMaintenanceRequests(clientId: string) {
  const { data, error } = await supabase
    .from('maintenance_requests')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })

  if (error) throw error

  // Fetch tenant and apartment names
  const tenantIds = [...new Set((data || []).filter(m => m.tenant_id).map(m => m.tenant_id))]
  const apartmentIds = [...new Set((data || []).filter(m => m.apartment_id).map(m => m.apartment_id))]

  const [tenantsRes, apartmentsRes] = await Promise.all([
    tenantIds.length > 0
      ? supabase.from('tenants').select('id, name').in('id', tenantIds)
      : { data: [] },
    apartmentIds.length > 0
      ? supabase.from('apartments').select('id, name').in('id', apartmentIds)
      : { data: [] },
  ])

  const tenantMap: Record<string, string> = {}
  tenantsRes.data?.forEach((t: { id: string; name: string }) => { tenantMap[t.id] = t.name })

  const aptMap: Record<string, string> = {}
  apartmentsRes.data?.forEach((a: { id: string; name: string }) => { aptMap[a.id] = a.name })

  return (data || []).map(m => ({
    ...m,
    tenant_name: m.tenant_id ? tenantMap[m.tenant_id] || 'Unknown' : undefined,
    apartment_name: m.apartment_id ? aptMap[m.apartment_id] || 'Unknown' : undefined,
  })) as MaintenanceRequest[]
}

export async function updateOwnerMaintenanceStatus(id: string, status: MaintenanceRequest['status']) {
  const { error } = await supabase
    .from('maintenance_requests')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) throw error
}

// ── Maintenance Requests per Month (for chart) ─────────────
export async function getMaintenanceRequestsByMonth(clientId: string) {
  const { data, error } = await supabase
    .from('maintenance_requests')
    .select('created_at, status')
    .eq('client_id', clientId)
    .order('created_at', { ascending: true })

  if (error) throw error

  const monthMap: Record<string, { pending: number; resolved: number }> = {}

  ;(data || []).forEach(req => {
    const date = new Date(req.created_at)
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    if (!monthMap[key]) monthMap[key] = { pending: 0, resolved: 0 }
    if (req.status === 'resolved' || req.status === 'closed') {
      monthMap[key].resolved++
    } else {
      monthMap[key].pending++
    }
  })

  return Object.entries(monthMap).map(([month, counts]) => ({
    month,
    pending: counts.pending,
    resolved: counts.resolved,
  }))
}

// ── Owner Managers CRUD ────────────────────────────────────
export async function getOwnerManagers(clientId: string) {
  const { data, error } = await supabase
    .from('managers')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

export async function createOwnerManager(manager: { name: string; email: string; phone?: string; client_id: string }) {
  // 1. Generate a random password
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%'
  let password = ''
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length))
  }

  // 2. Create Supabase Auth user
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: manager.email,
    password,
    options: {
      data: { name: manager.name, role: 'manager' },
    },
  })

  if (authError) throw authError

  // 3. Create manager record linked to auth user
  const { data, error } = await supabase
    .from('managers')
    .insert({
      ...manager,
      auth_user_id: authData.user?.id || null,
    })
    .select()
    .single()

  if (error) throw error
  return { manager: data, generatedPassword: password }
}

export async function updateOwnerManager(id: string, updates: { name?: string; email?: string; phone?: string; status?: string }) {
  const { data, error } = await supabase
    .from('managers')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteOwnerManager(id: string) {
  const { error } = await supabase.from('managers').delete().eq('id', id)
  if (error) throw error
}

// ── Owner Units (Apartments) CRUD ──────────────────────────
export interface UnitWithTenant {
  id: string
  name: string
  monthly_rent: number
  client_id: string | null
  manager_id: string | null
  status: string
  created_at: string
  tenant_name: string | null
  tenant_phone: string | null
  tenant_id: string | null
}

export async function getOwnerUnits(clientId: string): Promise<UnitWithTenant[]> {
  // Get all apartments (units) for this owner
  const { data: apartments, error: aptError } = await supabase
    .from('apartments')
    .select('*')
    .eq('client_id', clientId)
    .order('name', { ascending: true })

  if (aptError) throw aptError

  const aptIds = (apartments || []).map(a => a.id)
  if (aptIds.length === 0) return []

  // Get active tenants for these apartments
  const { data: tenants, error: tenError } = await supabase
    .from('tenants')
    .select('id, name, phone, apartment_id')
    .eq('status', 'active')
    .in('apartment_id', aptIds)

  if (tenError) throw tenError

  // Map tenant to apartment
  const tenantMap: Record<string, { id: string; name: string; phone: string | null }> = {}
  ;(tenants || []).forEach(t => {
    if (t.apartment_id) {
      tenantMap[t.apartment_id] = { id: t.id, name: t.name, phone: t.phone }
    }
  })

  return (apartments || []).map(apt => ({
    id: apt.id,
    name: apt.name,
    monthly_rent: Number(apt.monthly_rent) || 0,
    client_id: apt.client_id,
    manager_id: apt.manager_id,
    status: apt.status,
    created_at: apt.created_at,
    tenant_name: tenantMap[apt.id]?.name || null,
    tenant_phone: tenantMap[apt.id]?.phone || null,
    tenant_id: tenantMap[apt.id]?.id || null,
  }))
}

export async function getOwnerApartments(clientId: string) {
  const { data, error } = await supabase
    .from('apartments')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

export async function createOwnerApartment(apartment: {
  name: string
  address: string
  monthly_rent?: number
  total_units?: number
  client_id: string
  manager_id?: string
}) {
  const { data, error } = await supabase
    .from('apartments')
    .insert(apartment)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateOwnerApartment(id: string, updates: {
  name?: string
  address?: string
  monthly_rent?: number
  total_units?: number
  manager_id?: string
  status?: string
}) {
  const { data, error } = await supabase
    .from('apartments')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteOwnerApartment(id: string) {
  // Also delete tenants in this unit
  await supabase.from('tenants').delete().eq('apartment_id', id)
  const { error } = await supabase.from('apartments').delete().eq('id', id)
  if (error) throw error
}

// ── Create multiple units at once ──────────────────────────
export async function createBulkUnits(clientId: string, count: number, startNumber: number, monthlyRent: number) {
  const units = []
  for (let i = 0; i < count; i++) {
    units.push({
      name: `Unit ${startNumber + i}`,
      address: '-',
      monthly_rent: monthlyRent,
      client_id: clientId,
      status: 'active',
    })
  }

  const { data, error } = await supabase
    .from('apartments')
    .insert(units)
    .select()

  if (error) throw error
  return data
}

// ── Assign tenant to a unit ────────────────────────────────
export async function assignTenantToUnit(unitId: string, tenant: { name: string; phone?: string }, monthlyRent?: number) {
  // Remove any existing active tenant from this unit
  await supabase
    .from('tenants')
    .update({ status: 'inactive', updated_at: new Date().toISOString() })
    .eq('apartment_id', unitId)
    .eq('status', 'active')

  // Create new tenant
  const { data, error } = await supabase
    .from('tenants')
    .insert({
      name: tenant.name,
      phone: tenant.phone || null,
      apartment_id: unitId,
      status: 'active',
    })
    .select()
    .single()

  if (error) throw error

  // Update monthly rent if provided
  if (monthlyRent !== undefined) {
    await supabase
      .from('apartments')
      .update({ monthly_rent: monthlyRent, updated_at: new Date().toISOString() })
      .eq('id', unitId)
  }

  return data
}

// ── Remove tenant from unit (make available) ───────────────
export async function removeTenantFromUnit(unitId: string) {
  const { error } = await supabase
    .from('tenants')
    .update({ status: 'inactive', updated_at: new Date().toISOString() })
    .eq('apartment_id', unitId)
    .eq('status', 'active')

  if (error) throw error
}

// ── Update unit details ────────────────────────────────────
export async function updateUnit(unitId: string, updates: { name?: string; monthly_rent?: number }) {
  const { data, error } = await supabase
    .from('apartments')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', unitId)
    .select()
    .single()

  if (error) throw error
  return data
}

// ── Revenue ────────────────────────────────────────────────
export async function getOwnerRevenues(clientId: string) {
  const { data, error } = await supabase
    .from('revenues')
    .select('*')
    .eq('client_id', clientId)
    .order('month', { ascending: false })

  if (error) throw error
  return data as Revenue[]
}

export async function getRevenueByMonth(clientId: string) {
  const { data, error } = await supabase
    .from('revenues')
    .select('amount, month')
    .eq('client_id', clientId)
    .order('month', { ascending: true })

  if (error) throw error

  const monthMap: Record<string, number> = {}
  ;(data || []).forEach(r => {
    const key = r.month.slice(0, 7) // YYYY-MM
    monthMap[key] = (monthMap[key] || 0) + Number(r.amount)
  })

  return Object.entries(monthMap).map(([month, total]) => ({
    month,
    revenue: total,
  }))
}

// ── Announcements ──────────────────────────────────────────
export interface Announcement {
  id: string
  client_id: string
  title: string
  message: string
  created_by: string
  created_at: string
}

export async function getOwnerAnnouncements(clientId: string): Promise<Announcement[]> {
  const { data, error } = await supabase
    .from('announcements')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

export async function createOwnerAnnouncement(clientId: string, title: string, message: string, createdBy: string) {
  const { error } = await supabase
    .from('announcements')
    .insert({ client_id: clientId, title, message, created_by: createdBy })

  if (error) throw error
}

export async function deleteOwnerAnnouncement(id: string) {
  const { error } = await supabase
    .from('announcements')
    .delete()
    .eq('id', id)

  if (error) throw error
}

// ── Payments ───────────────────────────────────────────────
export interface OwnerPayment {
  id: string
  client_id: string
  tenant_id: string | null
  apartment_id: string | null
  amount: number
  payment_date: string
  status: 'paid' | 'pending' | 'overdue'
  description: string | null
  created_at: string
  tenant_name?: string
  apartment_name?: string
}

export async function getOwnerPayments(clientId: string): Promise<OwnerPayment[]> {
  const { data, error } = await supabase
    .from('payments')
    .select('*, tenants:tenant_id(name), apartments:apartment_id(name)')
    .eq('client_id', clientId)
    .order('payment_date', { ascending: false })

  if (error) throw error
  return (data || []).map((p: any) => ({
    ...p,
    tenant_name: p.tenants?.name || '—',
    apartment_name: p.apartments?.name || '—',
  }))
}

export async function createOwnerPayment(payment: {
  client_id: string
  tenant_id: string | null
  apartment_id: string | null
  amount: number
  payment_date: string
  status: 'paid' | 'pending' | 'overdue'
  description: string | null
}) {
  const { error } = await supabase
    .from('payments')
    .insert(payment)

  if (error) throw error
}

export async function updateOwnerPaymentStatus(id: string, status: 'paid' | 'pending' | 'overdue') {
  const { error } = await supabase
    .from('payments')
    .update({ status })
    .eq('id', id)

  if (error) throw error
}

// ── Payment QR Code ────────────────────────────────────────
const QR_STORAGE_KEY = 'primeliving_payment_qr'

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export async function uploadPaymentQr(clientId: string, file: File): Promise<string> {
  const dataUrl = await fileToDataUrl(file)
  localStorage.setItem(`${QR_STORAGE_KEY}_${clientId}`, dataUrl)
  return dataUrl
}

export function getPaymentQrUrl(clientId: string): string | null {
  return localStorage.getItem(`${QR_STORAGE_KEY}_${clientId}`) || null
}

export function deletePaymentQr(clientId: string): void {
  localStorage.removeItem(`${QR_STORAGE_KEY}_${clientId}`)
}
