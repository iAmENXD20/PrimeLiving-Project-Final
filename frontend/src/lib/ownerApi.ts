import api from './apiClient'
import { supabase } from './supabase'

// ── Types ──────────────────────────────────────────────────
export interface MaintenanceRequest {
  id: string
  tenant_id: string | null
  unit_id: string | null
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
  unit_id: string | null
  client_id: string | null
  amount: number
  month: string
  description: string | null
  created_at: string
  apartment_name?: string
}

// ── Get current owner (client) from auth user ─────────────
export async function getCurrentOwner() {
  const { data: { session } } = await supabase.auth.getSession()
  const userId = session?.user?.id
  if (!userId) return null

  try {
    return await api.get<any>(`/clients/by-auth/${userId}`)
  } catch {
    return null
  }
}

// ── Get Owner Apartment Address ─────────────────────────────
export async function getOwnerApartmentAddress(clientId: string): Promise<string | null> {
  try {
    const data = await api.get<any>(`/clients/${clientId}/location`)
    return data?.apartment_address || null
  } catch {
    return null
  }
}

// ── Get Client Apartment Name ──────────────────────────────
export async function getClientApartmentName(clientId: string): Promise<string | null> {
  try {
    const data = await api.get<any[]>(`/apartments?client_id=${clientId}`)
    return data?.[0]?.name || null
  } catch {
    return null
  }
}

// ── Update Owner Apartment Address ──────────────────────────
export async function updateOwnerApartmentAddress(clientId: string, address: string) {
  await api.put(`/clients/${clientId}`, { apartment_address: address, updated_at: new Date().toISOString() })
}

// ── Owner Dashboard Stats ──────────────────────────────────
export async function getOwnerDashboardStats(clientId: string, options?: { month?: number; year?: number }) {
  const params = new URLSearchParams()
  if (options?.month) params.set('month', String(options.month))
  if (options?.year) params.set('year', String(options.year))
  const query = params.toString() ? `?${params.toString()}` : ''
  return api.get<{
    apartments: number
    activeTenants: number
    pendingMaintenance: number
    totalRevenue: number
  }>(`/analytics/owner/${clientId}${query}`)
}

// ── Maintenance Requests ───────────────────────────────────
export async function getOwnerMaintenanceRequests(clientId: string) {
  // Fetch maintenance requests + tenants + apartments for this client in parallel
  const [data, allTenants, allApts] = await Promise.all([
    api.get<any[]>(`/maintenance?client_id=${clientId}`),
    api.get<any[]>(`/tenants?client_id=${clientId}`).catch(() => [] as any[]),
    api.get<any[]>(`/apartments?client_id=${clientId}`).catch(() => [] as any[]),
  ])

  // Build lookup maps for name enrichment
  const tenantMap: Record<string, string> = {}
  ;(allTenants || []).forEach((t: any) => { tenantMap[t.id] = t.name })

  const aptMap: Record<string, string> = {}
  ;(allApts || []).forEach((a: any) => { aptMap[a.id] = a.name })

  return (data || []).map(m => ({
    ...m,
    tenant_name: m.tenant_id ? tenantMap[m.tenant_id] || 'Unknown' : undefined,
    apartment_name: m.unit_id ? aptMap[m.unit_id] || 'Unknown' : undefined,
  })) as MaintenanceRequest[]
}

export async function updateOwnerMaintenanceStatus(id: string, status: MaintenanceRequest['status']) {
  await api.put(`/maintenance/${id}/status`, { status })
}

// ── Maintenance Requests per Month (for chart) ─────────────
export async function getMaintenanceRequestsByMonth(clientId: string) {
  return api.get<{ month: string; pending: number; resolved: number }[]>(
    `/analytics/maintenance-by-month?client_id=${clientId}`
  )
}

// ── Owner Managers CRUD ────────────────────────────────────
export async function getOwnerManagers(clientId: string) {
  return api.get<any[]>(`/managers?client_id=${clientId}`)
}

export async function createOwnerManager(manager: { name: string; email: string; phone?: string; client_id: string }) {
  const result = await api.post<Record<string, any>>('/managers', manager)
  // The backend createManager returns { ...managerData, generatedPassword }
  // Re-shape to match original interface: { manager, generatedPassword }
  const generatedPassword =
    result.generatedPassword ||
    result.generated_password ||
    result.password
  const {
    generatedPassword: _generatedPassword,
    generated_password: _generatedPasswordSnake,
    password: _password,
    ...managerData
  } = result
  return { manager: managerData, generatedPassword }
}

export async function updateOwnerManager(id: string, updates: { name?: string; email?: string; phone?: string; status?: string }) {
  return api.put<any>(`/managers/${id}`, { ...updates, updated_at: new Date().toISOString() })
}

export async function deleteOwnerManager(id: string) {
  await api.delete(`/managers/${id}`)
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

export interface OwnerTenant {
  id: string
  name: string
  phone: string | null
  unit_id: string | null
  status: 'active' | 'inactive'
  monthly_rent?: number
}

export async function getOwnerUnits(clientId: string): Promise<UnitWithTenant[]> {
  // The backend /apartments/with-tenants endpoint does the join for us
  return api.get<UnitWithTenant[]>(`/apartments/with-tenants?client_id=${clientId}`)
}

export async function getOwnerTenants(clientId: string, includeInactive = false): Promise<OwnerTenant[]> {
  const query = includeInactive ? '&include_inactive=true' : ''
  return api.get<OwnerTenant[]>(`/tenants?client_id=${clientId}${query}`)
}

export async function getOwnerApartments(clientId: string) {
  return api.get<any[]>(`/apartments?client_id=${clientId}`)
}

export async function createOwnerApartment(apartment: {
  name: string
  address: string
  monthly_rent?: number
  total_units?: number
  client_id: string
  manager_id?: string
}) {
  return api.post<any>('/apartments', apartment)
}

export async function updateOwnerApartment(id: string, updates: {
  name?: string
  address?: string
  monthly_rent?: number
  total_units?: number
  manager_id?: string
  status?: string
}) {
  return api.put<any>(`/apartments/${id}`, { ...updates, updated_at: new Date().toISOString() })
}

export async function deleteOwnerApartment(id: string) {
  // The backend deleteApartment handler already deletes tenants first
  await api.delete(`/apartments/${id}`)
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

  return api.post<any[]>('/apartments/bulk', { apartments: units })
}

// ── Assign tenant to a unit ────────────────────────────────
export async function assignTenantToUnit(unitId: string, tenant: { name: string; phone?: string }, monthlyRent?: number) {
  return api.post<any>('/tenants/assign-unit', {
    unit_id: unitId,
    name: tenant.name,
    phone: tenant.phone || null,
    monthly_rent: monthlyRent,
  })
}

// ── Remove tenant from unit (make available) ───────────────
export async function removeTenantFromUnit(unitId: string) {
  await api.post('/tenants/remove-from-unit', { unit_id: unitId })
}

// ── Update unit details ────────────────────────────────────
export async function updateUnit(unitId: string, updates: { name?: string; monthly_rent?: number }) {
  return api.put<any>(`/apartments/${unitId}`, { ...updates, updated_at: new Date().toISOString() })
}

// ── Revenue ────────────────────────────────────────────────
export async function getOwnerRevenues(clientId: string) {
  return api.get<Revenue[]>(`/revenues?client_id=${clientId}`)
}

export async function getRevenueByMonth(clientId: string) {
  return api.get<{ month: string; revenue: number }[]>(
    `/revenues/by-month?client_id=${clientId}`
  )
}

// ── Announcements ──────────────────────────────────────────
export interface Announcement {
  id: string | null
  client_id: string
  title: string
  message: string
  created_by: string
  created_at: string
}

export async function getOwnerAnnouncements(clientId: string): Promise<Announcement[]> {
  return api.get<Announcement[]>(`/announcements?client_id=${clientId}`)
}

export async function createOwnerAnnouncement(clientId: string, title: string, message: string, createdBy: string): Promise<Announcement> {
  return api.post<Announcement>('/announcements', { client_id: clientId, title, message, created_by: createdBy })
}

export async function deleteOwnerAnnouncement(id: string) {
  await api.delete(`/announcements/${id}`)
}

// ── Documents ──────────────────────────────────────────────
export interface OwnerDocument {
  id: string
  client_id: string | null
  unit_id: string | null
  tenant_id: string | null
  uploaded_by: string | null
  file_name: string
  file_url: string
  file_type: string
  description: string | null
  created_at: string
  tenant_name?: string | null
  unit_name?: string | null
}

export async function getOwnerDocuments(clientId: string): Promise<OwnerDocument[]> {
  const data = await api.get<any[]>(`/documents?client_id=${clientId}`)
  return (data || []).map((d: any) => ({
    ...d,
    tenant_name: d.tenants?.name ?? null,
    unit_name: d.apartments?.name ?? null,
    tenants: undefined,
    apartments: undefined,
  }))
}

// ── Payments ───────────────────────────────────────────────
export interface OwnerPayment {
  id: string
  client_id: string
  tenant_id: string | null
  unit_id: string | null
  amount: number
  payment_date: string
  status: 'paid' | 'pending' | 'overdue'
  description: string | null
  created_at: string
  tenant_name?: string
  apartment_name?: string
}

export async function getOwnerPayments(clientId: string): Promise<OwnerPayment[]> {
  const data = await api.get<any[]>(`/payments?client_id=${clientId}`)
  // The backend getPayments joins tenants(name, email) and apartments(name)
  return (data || []).map((p: any) => ({
    ...p,
    tenant_name: p.tenants?.name || '\u2014',
    apartment_name: p.apartments?.name || '\u2014',
  }))
}

export async function createOwnerPayment(payment: {
  client_id: string
  tenant_id: string | null
  unit_id: string | null
  amount: number
  payment_date: string
  status: 'paid' | 'pending' | 'overdue'
  description: string | null
}) {
  await api.post('/payments', payment)
}

export async function updateOwnerPaymentStatus(id: string, status: 'paid' | 'pending' | 'overdue') {
  await api.put(`/payments/${id}`, { status })
}

// ── Payment QR Code ────────────────────────────────────────
const QR_CACHE_KEY = 'primeliving_payment_qr_cache'

function getQrCache(clientId: string): string | null {
  return localStorage.getItem(`${QR_CACHE_KEY}_${clientId}`)
}

function setQrCache(clientId: string, url: string): void {
  localStorage.setItem(`${QR_CACHE_KEY}_${clientId}`, url)
}

function clearQrCache(clientId: string): void {
  localStorage.removeItem(`${QR_CACHE_KEY}_${clientId}`)
}

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
  setQrCache(clientId, dataUrl)
  const result = await api.post<{ qr_url: string }>('/payments/qr', {
    client_id: clientId,
    data_url: dataUrl,
  })
  return result.qr_url || dataUrl
}

export async function getPaymentQrUrl(clientId: string): Promise<string | null> {
  try {
    const result = await api.get<{ qr_url: string }>(`/payments/qr/${clientId}`)
    if (result.qr_url) setQrCache(clientId, result.qr_url)
    return result.qr_url || null
  } catch {
    return getQrCache(clientId)
  }
}

export async function deletePaymentQr(clientId: string): Promise<void> {
  await api.delete(`/payments/qr/${clientId}`)
  clearQrCache(clientId)
}
