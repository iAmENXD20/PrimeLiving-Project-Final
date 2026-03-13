import api from './apiClient'
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

export interface ManagerProfile {
  id: string
  auth_user_id: string | null
  name: string
  email: string
  phone: string | null
  client_id: string | null
  status: string
  joined_date: string
  created_at: string
}

// ── Get current manager from auth user ─────────────────────
export async function getCurrentManager(): Promise<ManagerProfile | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  try {
    return await api.get<ManagerProfile>(`/managers/by-auth/${user.id}`)
  } catch {
    return null
  }
}

// ── Manager Dashboard Stats ────────────────────────────────
export async function getManagerDashboardStats(managerId: string, clientId: string) {
  return api.get<{
    managedApartments: number
    activeTenants: number
    pendingMaintenance: number
    totalMaintenance: number
    paidTenants: number
    unpaidTenants: number
  }>(`/analytics/manager/${managerId}?client_id=${clientId}`)
}

// ── Get Maintenance Requests ───────────────────────────────
export async function getManagerMaintenanceRequests(clientId: string): Promise<MaintenanceRequest[]> {
  // Fetch maintenance requests + tenants + apartments for this client in parallel
  const [requests, allTenants, allApts] = await Promise.all([
    api.get<any[]>(`/maintenance?client_id=${clientId}`).catch(() => [] as any[]),
    api.get<any[]>(`/tenants?client_id=${clientId}`).catch(() => [] as any[]),
    api.get<any[]>(`/apartments?client_id=${clientId}`).catch(() => [] as any[]),
  ])

  if (!requests || requests.length === 0) return []

  const tenantMap = new Map((allTenants || []).map((t: any) => [t.id, t.name]))
  const apartmentMap = new Map((allApts || []).map((a: any) => [a.id, a.name]))

  return requests.map(r => ({
    ...r,
    tenant_name: r.tenant_id ? tenantMap.get(r.tenant_id) || 'Unknown' : '\u2014',
    apartment_name: r.apartment_id ? apartmentMap.get(r.apartment_id) || 'Unknown' : '\u2014',
  }))
}

// ── Update Maintenance Request Status ──────────────────────
export async function updateMaintenanceStatus(id: string, status: MaintenanceRequest['status']) {
  await api.put(`/maintenance/${id}/status`, { status })
}

// ── Get Managed Apartments (Units with Tenant info) ────────
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

export async function getManagerUnits(clientId: string): Promise<UnitWithTenant[]> {
  // The backend /apartments/with-tenants does the join
  return api.get<UnitWithTenant[]>(`/apartments/with-tenants?client_id=${clientId}`)
}

export async function getManagedApartments(managerId: string) {
  return api.get<any[]>(`/apartments?manager_id=${managerId}`)
}

// ── Update a unit (name, rent) ─────────────────────────────
export async function updateManagerUnit(
  unitId: string,
  updates: { name?: string; monthly_rent?: number },
) {
  await api.put(`/apartments/${unitId}`, updates)
}

// ── Assign or update tenant on a unit ──────────────────────
export async function assignTenantToUnit(
  unitId: string,
  tenant: { name: string; phone?: string },
  monthlyRent?: number,
) {
  await api.post('/tenants/assign-unit', {
    unit_id: unitId,
    name: tenant.name,
    phone: tenant.phone || null,
    monthly_rent: monthlyRent,
  })
}

// ── Remove tenant from a unit ──────────────────────────────
export async function removeTenantFromUnit(unitId: string) {
  await api.post('/tenants/remove-from-unit', { unit_id: unitId })
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

export async function getAnnouncements(clientId: string): Promise<Announcement[]> {
  return api.get<Announcement[]>(`/announcements?client_id=${clientId}`)
}

export async function createAnnouncement(clientId: string, title: string, message: string, createdBy: string) {
  await api.post('/announcements', { client_id: clientId, title, message, created_by: createdBy })
}

export async function deleteAnnouncement(id: string) {
  await api.delete(`/announcements/${id}`)
}

// ── Payments ───────────────────────────────────────────────
export interface Payment {
  id: string
  client_id: string
  tenant_id: string | null
  apartment_id: string | null
  amount: number
  payment_date: string
  status: 'paid' | 'pending' | 'overdue'
  description: string | null
  payment_mode: 'cash' | 'qr' | null
  receipt_url: string | null
  verification_status: 'pending_verification' | 'verified' | 'rejected' | null
  period_from: string | null
  period_to: string | null
  created_at: string
  tenant_name?: string
  apartment_name?: string
}

export async function getPayments(clientId: string): Promise<Payment[]> {
  const data = await api.get<any[]>(`/payments?client_id=${clientId}`)
  // Backend joins tenants(name, email) and apartments(name) as nested objects
  return (data || []).map((p: any) => ({
    ...p,
    tenant_name: p.tenants?.name || '\u2014',
    apartment_name: p.apartments?.name || '\u2014',
  }))
}

export async function createPayment(payment: {
  client_id: string
  tenant_id: string | null
  apartment_id: string | null
  amount: number
  payment_date: string
  status: 'paid' | 'pending' | 'overdue'
  description: string | null
}) {
  await api.post('/payments', payment)
}

export async function updatePaymentStatus(id: string, status: 'paid' | 'pending' | 'overdue') {
  await api.put(`/payments/${id}`, { status })
}

// ── Cash Payment Verification ──────────────────────────────
export async function getPendingCashVerifications(clientId: string): Promise<Payment[]> {
  const data = await api.get<any[]>(`/payments/pending-verifications?client_id=${clientId}`)
  // Backend already flattens tenant_name and apartment_name
  return (data || []).map((p: any) => ({
    ...p,
    tenant_name: p.tenant_name || '\u2014',
    apartment_name: p.apartment_name || '\u2014',
  }))
}

export async function approveCashPayment(id: string) {
  await api.put(`/payments/${id}/verify`, { verification_status: 'verified' })
}

export async function rejectCashPayment(id: string) {
  await api.put(`/payments/${id}/verify`, { verification_status: 'rejected' })
}

// ── Payment Due Day Configuration ──────────────────────────

/** Get the payment_due_day for the manager's apartment */
export async function getPaymentDueDay(clientId: string): Promise<number | null> {
  try {
    const data = await api.get<any[]>(`/apartments?client_id=${clientId}`)
    return data?.[0]?.payment_due_day ?? null
  } catch {
    return null
  }
}

/** Set the payment_due_day for all apartments under a client */
export async function setPaymentDueDay(clientId: string, day: number): Promise<void> {
  // Use the special endpoint that sets payment_due_day for all apartments under a client
  // The endpoint is PUT /apartments/:id/payment-due-day with client_id in body to update all
  await api.put('/apartments/_/payment-due-day', { day, client_id: clientId })
}

/**
 * Generate pending billings for the current month.
 * The backend handles the full billing generation logic.
 */
export async function generateMonthlyBillings(clientId: string): Promise<void> {
  await api.post('/payments/generate-monthly', { client_id: clientId })
}

// ── Record Cash Payment (Manager records after tenant pays) ──
export async function recordCashPayment(payment: {
  client_id: string
  tenant_id: string
  apartment_id: string | null
  amount: number
  description?: string
  period_from?: string
  period_to?: string
}) {
  await api.post('/payments', {
    client_id: payment.client_id,
    tenant_id: payment.tenant_id,
    apartment_id: payment.apartment_id,
    amount: payment.amount,
    payment_date: new Date().toISOString(),
    status: 'paid',
    description: payment.description || 'Cash payment recorded by manager',
    payment_mode: 'cash',
    verification_status: 'verified',
    period_from: payment.period_from || null,
    period_to: payment.period_to || null,
  })
}

// ── Get Active Tenants (for SMS notifications) ─────────────
export async function getActiveTenants(clientId: string): Promise<{ id: string; name: string; phone: string | null }[]> {
  const data = await api.get<any[]>(`/tenants?client_id=${clientId}`)
  // Filter to active tenants with name and phone
  return (data || [])
    .filter((t: any) => t.status === 'active')
    .map((t: any) => ({ id: t.id, name: t.name, phone: t.phone }))
}

// ── Documents ──────────────────────────────────────────────

export interface Document {
  id: string
  client_id: string | null
  apartment_id: string | null
  tenant_id: string | null
  uploaded_by: string | null
  file_name: string
  file_url: string
  file_type: string
  description: string | null
  created_at: string
  tenant_name?: string
  unit_name?: string
}

export async function getDocuments(clientId: string): Promise<Document[]> {
  const data = await api.get<any[]>(`/documents?client_id=${clientId}`)
  // Backend joins tenants(name) and apartments(name) as nested objects
  return (data || []).map((d: any) => ({
    ...d,
    tenant_name: d.tenants?.name ?? null,
    unit_name: d.apartments?.name ?? null,
    tenants: undefined,
    apartments: undefined,
  }))
}

export async function uploadDocument(
  file: File,
  clientId: string,
  managerId: string,
  apartmentId: string | null,
  tenantId: string | null,
  description: string,
) {
  // File upload still goes directly to Supabase Storage
  const ext = file.name.split('.').pop()
  const path = `${clientId}/${crypto.randomUUID()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('documents')
    .upload(path, file, { contentType: file.type })

  if (uploadError) throw uploadError

  const { data: urlData } = supabase.storage.from('documents').getPublicUrl(path)

  // Create the DB record via backend
  return api.post<any>('/documents', {
    client_id: clientId,
    apartment_id: apartmentId || null,
    tenant_id: tenantId || null,
    uploaded_by: managerId,
    file_name: file.name,
    file_url: urlData.publicUrl,
    file_type: file.type,
    description: description || null,
  })
}

export async function deleteDocument(id: string, _fileUrl: string) {
  // Backend handles both storage deletion and DB record deletion
  await api.delete(`/documents/${id}`)
}

// ── Tenant Account Management (Manager creates tenant accounts) ──

export interface TenantAccount {
  id: string
  auth_user_id: string | null
  name: string
  email: string | null
  phone: string | null
  apartment_id: string | null
  client_id: string | null
  status: string
  move_in_date: string | null
  created_at: string
  apartment_name?: string
}

export async function getManagerTenants(clientId: string): Promise<TenantAccount[]> {
  // Get apartments for name mapping, and all tenants for this client
  const [apartments, tenants] = await Promise.all([
    api.get<any[]>(`/apartments?client_id=${clientId}`).catch(() => [] as any[]),
    api.get<any[]>(`/tenants?client_id=${clientId}`).catch(() => [] as any[]),
  ])

  const aptMap = new Map((apartments || []).map((a: any) => [a.id, a.name]))

  return (tenants || []).map((t: any) => ({
    ...t,
    apartment_name: t.apartment_id ? aptMap.get(t.apartment_id) || 'Unknown' : '\u2014',
  }))
}

export async function createTenantAccount(tenant: {
  name: string
  email: string
  phone?: string
  apartment_id?: string
  client_id: string
}) {
  const result = await api.post<any>('/tenants', {
    name: tenant.name,
    email: tenant.email,
    phone: tenant.phone || null,
    apartment_id: tenant.apartment_id || null,
    client_id: tenant.client_id,
    create_auth_account: true,
  })

  // Backend returns { ...tenantData, generatedPassword }
  const { generatedPassword, ...tenantData } = result
  return { tenant: tenantData, generatedPassword }
}

export async function updateTenantAccount(id: string, updates: {
  name?: string
  email?: string
  phone?: string
  apartment_id?: string | null
  status?: string
}) {
  return api.put<any>(`/tenants/${id}`, { ...updates, updated_at: new Date().toISOString() })
}

export async function deleteTenantAccount(id: string) {
  await api.delete(`/tenants/${id}`)
}
