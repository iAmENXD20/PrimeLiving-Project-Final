import api from './apiClient'
import { supabase } from './supabase'

// ── Types ──────────────────────────────────────────────────
export interface MaintenanceRequest {
  id: string
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

export interface ManagerProfile {
  id: string
  auth_user_id: string | null
  name: string
  email: string
  phone: string | null
  apartmentowner_id: string | null
  status: string
  joined_date: string
  created_at: string
}

// ── Get current manager from auth user ─────────────────────
export async function getCurrentManager(): Promise<ManagerProfile | null> {
  const { data: { session } } = await supabase.auth.getSession()
  const userId = session?.user?.id
  if (!userId) return null

  try {
    const manager = await api.get<ManagerProfile>(`/managers/by-auth/${userId}`)

    if (manager && !manager.apartmentowner_id) {
      const apartments = await api.get<any[]>(`/apartments?manager_id=${manager.id}`).catch(() => [])
      const fallbackClientId = apartments?.[0]?.apartmentowner_id || null
      return {
        ...manager,
        apartmentowner_id: fallbackClientId,
      }
    }

    return manager
  } catch {
    return null
  }
}

export interface ManagerNotification {
  id: string
  apartmentowner_id: string | null
  recipient_role: 'manager' | 'tenant'
  recipient_id: string
  type: string
  title: string
  message: string
  is_read: boolean
  created_at: string
}

export async function getManagerNotifications(managerId: string, clientId: string): Promise<ManagerNotification[]> {
  return api.get<ManagerNotification[]>(`/notifications?recipient_role=manager&recipient_id=${managerId}&apartmentowner_id=${clientId}`, { skipCache: true })
}

export async function markManagerNotificationRead(id: string): Promise<void> {
  await api.put(`/notifications/${id}/read`, {})
}

export async function markAllManagerNotificationsRead(managerId: string): Promise<void> {
  await api.put('/notifications/read-all', {
    recipient_role: 'manager',
    recipient_id: managerId,
  })
}

export async function deleteManagerNotification(id: string): Promise<void> {
  await api.delete(`/notifications/${id}`)
}

export async function deleteAllManagerNotifications(managerId: string, clientId?: string | null): Promise<void> {
  await api.delete('/notifications/all', {
    recipient_role: 'manager',
    recipient_id: managerId,
    apartmentowner_id: clientId || undefined,
  })
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
  }>(`/analytics/manager/${managerId}?apartmentowner_id=${clientId}`)
}

// ── Get Maintenance Requests ───────────────────────────────
export async function getManagerMaintenanceRequests(clientId: string): Promise<MaintenanceRequest[]> {
  // Fetch maintenance requests + tenants + apartments for this client in parallel
  const [requests, allTenants, allApts] = await Promise.all([
    api.get<any[]>(`/maintenance?apartmentowner_id=${clientId}`).catch(() => [] as any[]),
    api.get<any[]>(`/tenants?apartmentowner_id=${clientId}`).catch(() => [] as any[]),
    api.get<any[]>(`/apartments?apartmentowner_id=${clientId}`).catch(() => [] as any[]),
  ])

  if (!requests || requests.length === 0) return []

  const tenantMap = new Map((allTenants || []).map((t: any) => [t.id, t.name]))
  const apartmentMap = new Map((allApts || []).map((a: any) => [a.id, a.name]))

  return requests.map(r => ({
    ...r,
    tenant_name: r.tenant_id ? tenantMap.get(r.tenant_id) || 'Unknown' : '\u2014',
    apartment_name: r.unit_id ? apartmentMap.get(r.unit_id) || 'Unknown' : '\u2014',
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
  apartmentowner_id: string | null
  manager_id: string | null
  status: string
  created_at: string
  tenant_name: string | null
  tenant_phone: string | null
  tenant_id: string | null
}

export async function getManagerUnits(clientId: string): Promise<UnitWithTenant[]> {
  // The backend /apartments/with-tenants does the join
  return api.get<UnitWithTenant[]>(`/apartments/with-tenants?apartmentowner_id=${clientId}`, { skipCache: true })
}

export async function getManagerUnitsByManager(managerId: string): Promise<UnitWithTenant[]> {
  return api.get<UnitWithTenant[]>(`/apartments/with-tenants?manager_id=${managerId}`)
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
  startAt?: string,
) {
  await api.post('/tenants/assign-unit', {
    unit_id: unitId,
    name: tenant.name,
    phone: tenant.phone || null,
    monthly_rent: monthlyRent,
    start_at: startAt,
  })
}

export async function assignExistingTenantToUnit(
  unitId: string,
  tenantId: string,
  monthlyRent?: number,
  startAt?: string,
) {
  await api.post('/tenants/assign-unit', {
    unit_id: unitId,
    tenant_id: tenantId,
    monthly_rent: monthlyRent,
    start_at: startAt,
  })
}

// ── Remove tenant from a unit ──────────────────────────────
export async function removeTenantFromUnit(unitId: string, preserveAccount = false) {
  await api.post('/tenants/remove-from-unit', {
    unit_id: unitId,
    preserve_account: preserveAccount,
  })
}

// ── Announcements ──────────────────────────────────────────
export interface Announcement {
  id: string | null
  apartmentowner_id: string
  title: string
  message: string
  created_by: string
  recipient_tenant_ids?: string[] | null
  created_at: string
}

export async function getAnnouncements(clientId: string): Promise<Announcement[]> {
  return api.get<Announcement[]>(`/announcements?apartmentowner_id=${clientId}`)
}

export async function createAnnouncement(
  clientId: string,
  title: string,
  message: string,
  createdBy: string,
  recipientTenantIds?: string[],
): Promise<Announcement> {
  return api.post<Announcement>('/announcements', {
    apartmentowner_id: clientId,
    title,
    message,
    created_by: createdBy,
    recipient_tenant_ids: recipientTenantIds && recipientTenantIds.length > 0 ? recipientTenantIds : null,
  })
}

export async function deleteAnnouncement(id: string) {
  await api.delete(`/announcements/${id}`)
}

// ── Payments ───────────────────────────────────────────────
export interface Payment {
  id: string
  apartmentowner_id: string
  tenant_id: string | null
  unit_id: string | null
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
  const data = await api.get<any[]>(`/payments?apartmentowner_id=${clientId}`)
  // Backend joins tenants(name, email) and apartments(name) as nested objects
  return (data || []).map((p: any) => ({
    ...p,
    tenant_name: p.tenants?.name || '\u2014',
    apartment_name: p.apartments?.name || '\u2014',
  }))
}

export async function createPayment(payment: {
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

export async function updatePaymentStatus(id: string, status: 'paid' | 'pending' | 'overdue') {
  await api.put(`/payments/${id}`, { status })
}

// ── Cash Payment Verification ──────────────────────────────
export async function getPendingCashVerifications(clientId: string): Promise<Payment[]> {
  const data = await api.get<any[]>(`/payments/pending-verifications?apartmentowner_id=${clientId}`)
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
    const data = await api.get<any[]>(`/apartments?apartmentowner_id=${clientId}`)
    return data?.[0]?.payment_due_day ?? null
  } catch {
    return null
  }
}

/** Set the payment_due_day for all apartments under a client */
export async function setPaymentDueDay(clientId: string, day: number): Promise<void> {
  // Use the special endpoint that sets payment_due_day for all apartments under a client
  // The endpoint is PUT /apartments/:id/payment-due-day with apartmentowner_id in body to update all
  await api.put('/apartments/_/payment-due-day', { day, apartmentowner_id: clientId })
}

/**
 * Generate pending billings for the current month.
 * The backend handles the full billing generation logic.
 */
export async function generateMonthlyBillings(clientId: string): Promise<void> {
  await api.post('/payments/generate-monthly', { apartmentowner_id: clientId })
}

// ── Record Cash Payment (Manager records after tenant pays) ──
export async function recordCashPayment(payment: {
  apartmentowner_id: string
  tenant_id: string
  unit_id: string | null
  amount: number
  description?: string
  period_from?: string
  period_to?: string
}) {
  await api.post('/payments', {
    apartmentowner_id: payment.apartmentowner_id,
    tenant_id: payment.tenant_id,
    unit_id: payment.unit_id,
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

export async function settleCashBilling(paymentId: string, description?: string) {
  await api.put(`/payments/${paymentId}`, {
    status: 'paid',
    payment_mode: 'cash',
    verification_status: 'verified',
    payment_date: new Date().toISOString(),
    description: description || 'Cash payment recorded by manager',
  })
}

// ── Get Active Tenants (for SMS notifications) ─────────────
export async function getActiveTenants(
  clientId: string,
  managerId?: string,
): Promise<{ id: string; name: string; phone: string | null; unit_name?: string | null }[]> {
  let effectiveClientId = clientId

  if (managerId) {
    const units = await api
      .get<any[]>(`/apartments/with-tenants?manager_id=${managerId}`)
      .catch(() => [] as any[])

    const managerTenants = (units || [])
      .filter((u: any) => u.tenant_id)
      .map((u: any) => ({
        id: u.tenant_id,
        name: u.tenant_name || 'Unknown',
        phone: u.tenant_phone || null,
        unit_name: u.name || null,
      }))

    if (managerTenants.length > 0) {
      const deduped = new Map<string, { id: string; name: string; phone: string | null; unit_name?: string | null }>()
      managerTenants.forEach((t) => deduped.set(t.id, t))
      return Array.from(deduped.values())
    }

    if (!effectiveClientId) {
      const manager = await api.get<any>(`/managers/${managerId}`).catch(() => null)
      effectiveClientId = manager?.apartmentowner_id || ''
    }
  }

  if (!effectiveClientId) {
    return []
  }

  const data = await api.get<any[]>(`/tenants?apartmentowner_id=${effectiveClientId}`)
  return (data || []).map((t: any) => ({ id: t.id, name: t.name, phone: t.phone, unit_name: null }))
}

// ── Documents ──────────────────────────────────────────────

export interface Document {
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
  tenant_name?: string
  unit_name?: string
}

export async function getDocuments(clientId: string): Promise<Document[]> {
  const data = await api.get<any[]>(`/documents?apartmentowner_id=${clientId}`)
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
  const fileData = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })

  return api.post<any>('/documents/upload', {
    apartmentowner_id: clientId,
    unit_id: apartmentId || null,
    tenant_id: tenantId || null,
    uploaded_by: managerId,
    file_name: file.name,
    file_type: file.type,
    description: description || null,
    file_data: fileData,
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
  unit_id: string | null
  apartmentowner_id: string | null
  status: string
  move_in_date: string | null
  created_at: string
  apartment_name?: string
}

export async function getManagerTenants(clientId: string): Promise<TenantAccount[]> {
  // Get apartments for name mapping, and all tenants for this client
  const [apartments, tenants] = await Promise.all([
    api.get<any[]>(`/apartments?apartmentowner_id=${clientId}`, { skipCache: true }).catch(() => [] as any[]),
    api.get<any[]>(`/tenants?apartmentowner_id=${clientId}`, { skipCache: true }).catch(() => [] as any[]),
  ])

  const aptMap = new Map((apartments || []).map((a: any) => [a.id, a.name]))

  return (tenants || []).map((t: any) => ({
    ...t,
    apartment_name: t.unit_id ? aptMap.get(t.unit_id) || 'Unknown' : '\u2014',
  }))
}

export async function createTenantAccount(tenant: {
  name: string
  email: string
  phone?: string
  sex?: string
  age?: string
  unit_id?: string
  apartmentowner_id: string
}) {
  const result = await api.post<any>('/tenants', {
    name: tenant.name,
    email: tenant.email,
    phone: tenant.phone || null,
    sex: tenant.sex || null,
    age: tenant.age || null,
    unit_id: tenant.unit_id || null,
    apartmentowner_id: tenant.apartmentowner_id,
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
  unit_id?: string | null
  status?: string
}) {
  return api.put<any>(`/tenants/${id}`, { ...updates, updated_at: new Date().toISOString() })
}

export async function deleteTenantAccount(id: string) {
  await api.delete(`/tenants/${id}`)
}

// ── Apartment Logs ─────────────────────────────────────────
export interface ManagerApartmentLog {
  id: string
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

export async function getManagerApartmentLogs(clientId: string): Promise<ManagerApartmentLog[]> {
  return api.get<ManagerApartmentLog[]>(`/apartment-logs?apartmentowner_id=${clientId}`)
}

export async function createManagerApartmentLog(log: {
  apartmentowner_id: string
  actor_name: string
  actor_role: string
  action: string
  entity_type?: string | null
  entity_id?: string | null
  description: string
  metadata?: Record<string, unknown>
}): Promise<ManagerApartmentLog> {
  return api.post<ManagerApartmentLog>('/apartment-logs', log)
}
