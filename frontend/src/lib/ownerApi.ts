import api from './apiClient'
import { supabase } from './supabase'

// ── Types ──────────────────────────────────────────────────
export interface MaintenanceRequest {
  id: string
  maintenance_id: string | null
  tenant_id: string | null
  unit_id: string | null
  apartmentowner_id: string | null
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
  apartmentowner_id: string | null
  amount: number
  month: string
  description: string | null
  created_at: string
  apartment_name?: string
}

// ── Get current owner from auth user ───────────────────
export async function getCurrentOwner() {
  const { data: { session } } = await supabase.auth.getSession()
  const userId = session?.user?.id
  if (!userId) return null

  try {
    return await api.get<any>(`/owners/by-auth/${userId}`)
  } catch {
    return null
  }
}

// ── Get Owner Apartment Address ─────────────────────────────
export async function getOwnerApartmentAddress(ownerId: string): Promise<string | null> {
  try {
    const data = await api.get<any[]>(`/apartments/properties?apartmentowner_id=${ownerId}`)
    if (!data?.[0]) return null
    const p = data[0]
    const parts = [p.address_street, p.address_barangay, p.address_city, p.address_province, p.address_region].filter(Boolean)
    return parts.length > 0 ? parts.join(', ') : null
  } catch {
    return null
  }
}

// ── Get Owner Apartment Name ──────────────────────────
export async function getOwnerApartmentName(ownerId: string): Promise<string | null> {
  try {
    const data = await api.get<any[]>(`/apartments?apartmentowner_id=${ownerId}`)
    return data?.[0]?.name || null
  } catch {
    return null
  }
}

// ── Update Owner Apartment Address ──────────────────────────
// Now updates the apartment record's address, not the owner record
export async function updateOwnerApartmentAddress(ownerId: string, address: string) {
  const apartments = await api.get<any[]>(`/apartments?apartmentowner_id=${ownerId}`)
  if (apartments?.[0]?.id) {
    await api.put(`/apartments/${apartments[0].id}`, { address, updated_at: new Date().toISOString() })
  }
}

// ── Owner Dashboard Stats ──────────────────────────────
export async function getOwnerDashboardStats(ownerId: string, options?: { month?: number; year?: number }) {
  const params = new URLSearchParams()
  if (options?.month) params.set('month', String(options.month))
  if (options?.year) params.set('year', String(options.year))
  const query = params.toString() ? `?${params.toString()}` : ''
  return api.get<{
    apartments: number
    activeTenants: number
    pendingMaintenance: number
    totalRevenue: number
  }>(`/analytics/owner/${ownerId}${query}`)
}

// ── Maintenance Requests ───────────────────────────────
export async function getOwnerMaintenanceRequests(ownerId: string) {
  // Fetch maintenance requests + tenants + apartments for this owner in parallel
  const [data, allTenants, allApts] = await Promise.all([
    api.get<any[]>(`/maintenance?apartmentowner_id=${ownerId}`),
    api.get<any[]>(`/tenants?apartmentowner_id=${ownerId}`).catch(() => [] as any[]),
    api.get<any[]>(`/apartments?apartmentowner_id=${ownerId}`).catch(() => [] as any[]),
  ])

  // Build lookup maps for name enrichment
  const tenantMap: Record<string, string> = {}
  ;(allTenants || []).forEach((t: any) => { tenantMap[t.id] = `${t.first_name} ${t.last_name}`.trim() })

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
export async function getMaintenanceRequestsByMonth(ownerId: string) {
  return api.get<{ month: string; pending: number; resolved: number }[]>(
    `/analytics/maintenance-by-month?apartmentowner_id=${ownerId}`
  )
}

// ── Owner Managers CRUD ────────────────────────────────────
export async function getOwnerManagers(ownerId: string) {
  return api.get<any[]>(`/managers?apartmentowner_id=${ownerId}`)
}

export async function createOwnerManager(manager: { firstName: string; lastName: string; email: string; phone?: string; sex?: string; age?: string; apartmentowner_id: string; apartment_id?: string }) {
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

export async function updateOwnerManager(id: string, updates: { first_name?: string; last_name?: string; email?: string; phone?: string; status?: string; apartment_id?: string | null }) {
  return api.put<any>(`/managers/${id}`, { ...updates, updated_at: new Date().toISOString() })
}

export async function deleteOwnerManager(id: string) {
  await api.delete(`/managers/${id}`)
}

export async function resendManagerInvite(id: string) {
  return api.post<{ invitationEmailSent: boolean }>(`/managers/${id}/resend-invite`, {})
}

export async function getManagerIdPhotos(id: string) {
  return api.get<{ id_type: string; id_type_other: string | null; front_url: string | null; back_url: string | null }>(`/managers/${id}/id-photos`)
}

export async function approveManager(id: string) {
  return api.post(`/managers/${id}/approve`, {})
}

// ── Owner Units (Apartments) CRUD ──────────────────────────
export interface UnitWithTenant {
  id: string
  name: string
  monthly_rent: number
  apartmentowner_id: string | null
  apartment_id: string | null
  manager_id: string | null
  status: string
  created_at: string
  tenant_name: string | null
  tenant_phone: string | null
  tenant_id: string | null
  max_occupancy: number | null
  payment_due_day: number | null
}

export interface OwnerTenant {
  id: string
  first_name: string
  last_name: string
  phone: string | null
  unit_id: string | null
  status: 'active' | 'inactive' | 'pending' | 'pending_verification'
  monthly_rent?: number
}

export async function getOwnerUnits(ownerId: string): Promise<UnitWithTenant[]> {
  // The backend /apartments/with-tenants endpoint does the join for us
  return api.get<UnitWithTenant[]>(`/apartments/with-tenants?apartmentowner_id=${ownerId}`)
}

export async function getOwnerTenants(ownerId: string, includeInactive = false): Promise<OwnerTenant[]> {
  const query = includeInactive ? '&include_inactive=true' : ''
  return api.get<OwnerTenant[]>(`/tenants?apartmentowner_id=${ownerId}${query}`)
}

export async function approveTenant(tenantId: string): Promise<void> {
  await api.put(`/tenants/${tenantId}/approve`, {})
}

export async function getTenantIdPhotos(id: string) {
  return api.get<{ id_type: string; id_type_other: string | null; front_url: string | null; back_url: string | null }>(`/tenants/${id}/id-photos`)
}

// ── Property-level apartments (buildings/locations) ────────
export interface PropertyManager {
  id: string
  first_name: string
  last_name: string
  email: string
  phone: string | null
  status: string
}

export interface Property {
  id: string
  apartmentowner_id: string
  name: string
  address_region: string | null
  address_region_code: string | null
  address_province: string | null
  address_province_code: string | null
  address_city: string | null
  address_city_code: string | null
  address_district: string | null
  address_district_code: string | null
  address_area: string | null
  address_area_code: string | null
  address_barangay: string | null
  address_barangay_code: string | null
  address_street: string | null
  managers: PropertyManager[]
  status: string
  unit_count: number
  created_at: string
  updated_at: string
}

export async function getOwnerProperties(ownerId: string) {
  return api.get<Property[]>(`/apartments/properties?apartmentowner_id=${ownerId}`)
}

export async function createOwnerProperty(property: {
  name: string
  apartmentowner_id: string
  address_region?: string
  address_region_code?: string
  address_province?: string
  address_province_code?: string
  address_city?: string
  address_city_code?: string
  address_district?: string
  address_district_code?: string
  address_area?: string
  address_area_code?: string
  address_barangay?: string
  address_barangay_code?: string
  address_street?: string
}) {
  return api.post<Property>('/apartments/properties', property)
}

export async function updateOwnerProperty(id: string, updates: { name?: string; status?: string }) {
  return api.put<Property>(`/apartments/properties/${id}`, updates)
}

export async function deleteOwnerProperty(id: string) {
  await api.delete(`/apartments/properties/${id}`)
}

export async function getOwnerApartments(ownerId: string) {
  return api.get<any[]>(`/apartments?apartmentowner_id=${ownerId}`)
}

export async function createOwnerApartment(apartment: {
  name: string
  monthly_rent?: number
  total_units?: number
  apartmentowner_id: string
  apartment_id?: string
  manager_id?: string
}) {
  return api.post<any>('/apartments', apartment)
}

export async function updateOwnerApartment(id: string, updates: {
  name?: string
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
export async function createBulkUnits(ownerId: string, count: number, startNumber: number, monthlyRent: number, apartmentId?: string) {
  const units = []
  for (let i = 0; i < count; i++) {
    units.push({
      name: `Unit ${startNumber + i}`,
      monthly_rent: monthlyRent,
      apartmentowner_id: ownerId,
      apartment_id: apartmentId || undefined,
      status: 'active',
    })
  }

  return api.post<any[]>('/apartments/bulk', { apartments: units })
}

// ── Assign tenant to a unit ────────────────────────────────
export async function assignTenantToUnit(unitId: string, tenant: { first_name: string; last_name: string; phone?: string }, monthlyRent?: number) {
  return api.post<any>('/tenants/assign-unit', {
    unit_id: unitId,
    first_name: tenant.first_name,
    last_name: tenant.last_name,
    phone: tenant.phone || null,
    monthly_rent: monthlyRent,
  })
}

// ── Remove tenant from unit (make available) ───────────────
export async function removeTenantFromUnit(unitId: string) {
  await api.post('/tenants/remove-from-unit', { unit_id: unitId })
}

// ── Update unit details ────────────────────────────────────
export async function updateUnit(unitId: string, updates: { name?: string; monthly_rent?: number; max_occupancy?: number | null; status?: string }) {
  return api.put<any>(`/apartments/${unitId}`, { ...updates, updated_at: new Date().toISOString() })
}

// ── Revenue ────────────────────────────────────────────────
export async function getOwnerRevenues(ownerId: string) {
  return api.get<Revenue[]>(`/revenues?apartmentowner_id=${ownerId}`)
}

export async function getRevenueByMonth(ownerId: string) {
  return api.get<{ month: string; revenue: number }[]>(
    `/revenues/by-month?apartmentowner_id=${ownerId}`
  )
}

// ── Announcements ──────────────────────────────────────────
export interface Announcement {
  id: string | null
  apartmentowner_id: string
  title: string
  message: string
  created_by: string
  created_at: string
}

export async function getOwnerAnnouncements(ownerId: string): Promise<Announcement[]> {
  return api.get<Announcement[]>(`/announcements?apartmentowner_id=${ownerId}`)
}

export async function createOwnerAnnouncement(ownerId: string, title: string, message: string, createdBy: string): Promise<Announcement> {
  return api.post<Announcement>('/announcements', { apartmentowner_id: ownerId, title, message, created_by: createdBy })
}

export async function deleteOwnerAnnouncement(id: string) {
  await api.delete(`/announcements/${id}`)
}

// ── Documents ──────────────────────────────────────────────
export interface OwnerDocument {
  id: string
  apartmentowner_id: string | null
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

export async function getOwnerDocuments(ownerId: string): Promise<OwnerDocument[]> {
  const data = await api.get<any[]>(`/documents?apartmentowner_id=${ownerId}`)
  return (data || []).map((d: any) => ({
    ...d,
    tenant_name: d.tenants ? `${d.tenants.first_name} ${d.tenants.last_name}`.trim() || null : null,
    unit_name: d.apartments?.name ?? null,
    tenants: undefined,
    apartments: undefined,
  }))
}

export async function uploadOwnerDocument(
  file: File,
  ownerId: string,
  unitId: string | null,
  tenantId: string | null,
  description: string,
) {
  const fileData = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })

  return api.post<any>('/documents/upload', {
    apartmentowner_id: ownerId,
    unit_id: unitId || null,
    tenant_id: tenantId || null,
    uploaded_by: ownerId,
    file_name: file.name,
    file_type: file.type,
    description: description || null,
    file_data: fileData,
  })
}

export async function deleteOwnerDocument(id: string) {
  await api.delete(`/documents/${id}`)
}

// ── Payments ───────────────────────────────────────────────
export interface OwnerPayment {
  id: string
  apartmentowner_id: string
  tenant_id: string | null
  unit_id: string | null
  amount: number
  payment_date: string
  status: 'paid' | 'pending' | 'overdue'
  verification_status: 'pending_verification' | 'verified' | 'approved' | 'rejected' | null
  receipt_url: string | null
  payment_mode: 'gcash' | 'maya' | 'cash' | 'bank_transfer' | null
  period_from: string | null
  period_to: string | null
  description: string | null
  created_at: string
  tenant_name?: string
  apartment_name?: string
}

export async function getOwnerPayments(ownerId: string): Promise<OwnerPayment[]> {
  const data = await api.get<any[]>(`/payments?apartmentowner_id=${ownerId}`)
  // The backend getPayments joins tenants(name, email) and apartments(name)
  return (data || []).map((p: any) => ({
    ...p,
    tenant_name: p.tenants ? `${p.tenants.first_name} ${p.tenants.last_name}`.trim() || '\u2014' : '\u2014',
    apartment_name: p.apartments?.name || '\u2014',
  }))
}

export async function createOwnerPayment(payment: {
  apartmentowner_id: string
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

// ── Payment Approval (Owner approves manager-verified payments) ──
export async function getVerifiedPayments(ownerId: string): Promise<OwnerPayment[]> {
  const data = await api.get<any[]>(`/payments/verified-pending-approval?apartmentowner_id=${ownerId}`)
  return (data || []).map((p: any) => ({
    ...p,
    tenant_name: p.tenant_name || '\u2014',
    apartment_name: p.apartment_name || '\u2014',
  }))
}

export async function approveVerifiedPayment(id: string) {
  await api.put(`/payments/${id}/approve`, { action: 'approved' })
}

export async function rejectVerifiedPayment(id: string) {
  await api.put(`/payments/${id}/approve`, { action: 'rejected' })
}

// ── Payment QR Code ────────────────────────────────────────
const QR_CACHE_KEY = 'payment_qr_cache'

function getQrCache(ownerId: string): string | null {
  return localStorage.getItem(`${QR_CACHE_KEY}_${ownerId}`)
}

function setQrCache(ownerId: string, url: string): void {
  localStorage.setItem(`${QR_CACHE_KEY}_${ownerId}`, url)
}

function clearQrCache(ownerId: string): void {
  localStorage.removeItem(`${QR_CACHE_KEY}_${ownerId}`)
}

// ── Unit Occupants ─────────────────────────────────────────
export interface UnitOccupant {
  id: string
  unit_id: string
  tenant_id: string
  full_name: string
  first_name?: string
  last_name?: string
  sex?: string | null
  phone?: string | null
  id_photo_url?: string | null
  created_at: string
}

export async function getUnitOccupants(unitId: string): Promise<UnitOccupant[]> {
  return api.get<UnitOccupant[]>(`/apartments/occupants/${unitId}`)
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export async function uploadPaymentQr(ownerId: string, file: File): Promise<string> {
  const dataUrl = await fileToDataUrl(file)
  setQrCache(ownerId, dataUrl)
  const result = await api.post<{ qr_url: string }>('/payments/qr', {
    apartmentowner_id: ownerId,
    data_url: dataUrl,
  })
  return result.qr_url || dataUrl
}

export async function getPaymentQrUrl(ownerId: string): Promise<string | null> {
  try {
    const result = await api.get<{ qr_url: string }>(`/payments/qr/${ownerId}`)
    if (result.qr_url) setQrCache(ownerId, result.qr_url)
    return result.qr_url || null
  } catch {
    return getQrCache(ownerId)
  }
}

export async function deletePaymentQr(ownerId: string): Promise<void> {
  await api.delete(`/payments/qr/${ownerId}`)
  clearQrCache(ownerId)
}

// ── Apartment Logs ─────────────────────────────────────────
export interface ApartmentLog {
  id: string
  arc_id: string
  apartmentowner_id: string
  apartment_id: string | null
  actor_id: string | null
  actor_name: string
  actor_role: 'owner' | 'manager' | 'tenant' | 'system'
  action: string
  entity_type: string | null
  entity_id: string | null
  description: string
  metadata: Record<string, unknown>
  created_at: string
}

export async function getOwnerApartmentLogs(ownerId: string): Promise<ApartmentLog[]> {
  return api.get<ApartmentLog[]>(`/apartment-logs?apartmentowner_id=${ownerId}`)
}

export async function createOwnerApartmentLog(log: {
  apartmentowner_id: string
  actor_name: string
  actor_role: string
  action: string
  entity_type?: string | null
  entity_id?: string | null
  description: string
  metadata?: Record<string, unknown>
}): Promise<ApartmentLog> {
  return api.post<ApartmentLog>('/apartment-logs', log)
}

export async function clearOwnerApartmentLogs(ownerId: string): Promise<void> {
  await api.delete(`/apartment-logs?apartmentowner_id=${ownerId}`)
}
