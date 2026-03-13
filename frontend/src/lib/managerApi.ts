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

  const { data, error } = await supabase
    .from('managers')
    .select('*')
    .eq('auth_user_id', user.id)
    .single()

  if (error) return null
  return data
}

// ── Manager Dashboard Stats ────────────────────────────────
export async function getManagerDashboardStats(managerId: string, clientId: string) {
  // Get apartments managed by this manager
  const { data: managedApartments } = await supabase
    .from('apartments')
    .select('id')
    .eq('manager_id', managerId)
    .eq('status', 'active')

  const apartmentIds = managedApartments?.map(a => a.id) || []

  const [tenants, pendingMaintenance, allMaintenance] = await Promise.all([
    supabase
      .from('tenants')
      .select('id', { count: 'exact' })
      .eq('status', 'active')
      .in('apartment_id', apartmentIds.length ? apartmentIds : ['none']),
    supabase
      .from('maintenance_requests')
      .select('id', { count: 'exact' })
      .eq('status', 'pending')
      .eq('client_id', clientId),
    supabase
      .from('maintenance_requests')
      .select('id', { count: 'exact' })
      .eq('client_id', clientId),
  ])

  // Get paid / unpaid tenant counts from payments for current month
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString()

  const { data: paidPayments } = await supabase
    .from('payments')
    .select('tenant_id')
    .eq('client_id', clientId)
    .eq('status', 'paid')
    .gte('payment_date', startOfMonth)
    .lte('payment_date', endOfMonth)

  const paidTenantIds = new Set((paidPayments || []).map(p => p.tenant_id).filter(Boolean))
  const totalActiveTenants = tenants.count ?? 0
  const paidTenants = paidTenantIds.size
  const unpaidTenants = Math.max(0, totalActiveTenants - paidTenants)

  return {
    managedApartments: apartmentIds.length,
    activeTenants: totalActiveTenants,
    pendingMaintenance: pendingMaintenance.count ?? 0,
    totalMaintenance: allMaintenance.count ?? 0,
    paidTenants,
    unpaidTenants,
  }
}

// ── Get Maintenance Requests ───────────────────────────────
export async function getManagerMaintenanceRequests(clientId: string): Promise<MaintenanceRequest[]> {
  const { data: requests, error } = await supabase
    .from('maintenance_requests')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })

  if (error || !requests) return []

  // Fetch related tenant & apartment names
  const tenantIds = [...new Set(requests.filter(r => r.tenant_id).map(r => r.tenant_id))]
  const apartmentIds = [...new Set(requests.filter(r => r.apartment_id).map(r => r.apartment_id))]

  const [tenantsRes, apartmentsRes] = await Promise.all([
    tenantIds.length
      ? supabase.from('tenants').select('id, name').in('id', tenantIds)
      : Promise.resolve({ data: [] }),
    apartmentIds.length
      ? supabase.from('apartments').select('id, name').in('id', apartmentIds)
      : Promise.resolve({ data: [] }),
  ])

  const tenantMap = new Map((tenantsRes.data || []).map(t => [t.id, t.name]))
  const apartmentMap = new Map((apartmentsRes.data || []).map(a => [a.id, a.name]))

  return requests.map(r => ({
    ...r,
    tenant_name: r.tenant_id ? tenantMap.get(r.tenant_id) || 'Unknown' : '—',
    apartment_name: r.apartment_id ? apartmentMap.get(r.apartment_id) || 'Unknown' : '—',
  }))
}

// ── Update Maintenance Request Status ──────────────────────
export async function updateMaintenanceStatus(id: string, status: MaintenanceRequest['status']) {
  const { error } = await supabase
    .from('maintenance_requests')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) throw error
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
  const { data: apartments, error: aptError } = await supabase
    .from('apartments')
    .select('*')
    .eq('client_id', clientId)
    .order('name', { ascending: true })

  if (aptError) throw aptError

  const aptIds = (apartments || []).map(a => a.id)
  if (aptIds.length === 0) return []

  const { data: tenants, error: tenError } = await supabase
    .from('tenants')
    .select('id, name, phone, apartment_id')
    .eq('status', 'active')
    .in('apartment_id', aptIds)

  if (tenError) throw tenError

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

export async function getManagedApartments(managerId: string) {
  const { data, error } = await supabase
    .from('apartments')
    .select('*')
    .eq('manager_id', managerId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

// ── Update a unit (name, rent) ─────────────────────────────
export async function updateManagerUnit(
  unitId: string,
  updates: { name?: string; monthly_rent?: number },
) {
  const { error } = await supabase
    .from('apartments')
    .update(updates)
    .eq('id', unitId)

  if (error) throw error
}

// ── Assign or update tenant on a unit ──────────────────────
export async function assignTenantToUnit(
  unitId: string,
  tenant: { name: string; phone?: string },
  monthlyRent?: number,
) {
  // Get apartment to know client_id
  const { data: apt, error: aptErr } = await supabase
    .from('apartments')
    .select('client_id')
    .eq('id', unitId)
    .single()

  if (aptErr || !apt) throw new Error('Unit not found')

  // Check if unit already has a tenant
  const { data: existing } = await supabase
    .from('tenants')
    .select('id')
    .eq('apartment_id', unitId)
    .eq('status', 'active')
    .maybeSingle()

  if (existing) {
    // Update existing tenant
    const { error } = await supabase
      .from('tenants')
      .update({ name: tenant.name, phone: tenant.phone || null })
      .eq('id', existing.id)
    if (error) throw error
  } else {
    // Create new tenant
    const { error } = await supabase
      .from('tenants')
      .insert({
        name: tenant.name,
        phone: tenant.phone || null,
        apartment_id: unitId,
        client_id: apt.client_id,
        status: 'active',
      })
    if (error) throw error
  }

  // Update rent if provided
  if (monthlyRent !== undefined) {
    await supabase
      .from('apartments')
      .update({ monthly_rent: monthlyRent })
      .eq('id', unitId)
  }
}

// ── Remove tenant from a unit ──────────────────────────────
export async function removeTenantFromUnit(unitId: string) {
  const { error } = await supabase
    .from('tenants')
    .update({ status: 'inactive', apartment_id: null })
    .eq('apartment_id', unitId)
    .eq('status', 'active')

  if (error) throw error
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
  const { data, error } = await supabase
    .from('announcements')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

export async function createAnnouncement(clientId: string, title: string, message: string, createdBy: string) {
  const { error } = await supabase
    .from('announcements')
    .insert({ client_id: clientId, title, message, created_by: createdBy })

  if (error) throw error
}

export async function deleteAnnouncement(id: string) {
  const { error } = await supabase
    .from('announcements')
    .delete()
    .eq('id', id)

  if (error) throw error
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

export async function createPayment(payment: {
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

export async function updatePaymentStatus(id: string, status: 'paid' | 'pending' | 'overdue') {
  const { error } = await supabase
    .from('payments')
    .update({ status })
    .eq('id', id)

  if (error) throw error
}

// ── Cash Payment Verification ──────────────────────────────
export async function getPendingCashVerifications(clientId: string): Promise<Payment[]> {
  const { data, error } = await supabase
    .from('payments')
    .select('*, tenants:tenant_id(name), apartments:apartment_id(name)')
    .eq('client_id', clientId)
    .eq('payment_mode', 'cash')
    .eq('verification_status', 'pending_verification')
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data || []).map((p: any) => ({
    ...p,
    tenant_name: p.tenants?.name || '—',
    apartment_name: p.apartments?.name || '—',
  }))
}

export async function approveCashPayment(id: string) {
  const { error } = await supabase
    .from('payments')
    .update({
      status: 'paid',
      verification_status: 'verified',
    })
    .eq('id', id)

  if (error) throw error
}

export async function rejectCashPayment(id: string) {
  const { error } = await supabase
    .from('payments')
    .update({
      verification_status: 'rejected',
    })
    .eq('id', id)

  if (error) throw error
}

// ── Payment Due Day Configuration ──────────────────────────

/** Get the payment_due_day for the manager's apartment */
export async function getPaymentDueDay(clientId: string): Promise<number | null> {
  const { data } = await supabase
    .from('apartments')
    .select('payment_due_day')
    .eq('client_id', clientId)
    .limit(1)
    .single()

  return data?.payment_due_day ?? null
}

/** Set the payment_due_day for all apartments under a client */
export async function setPaymentDueDay(clientId: string, day: number): Promise<void> {
  const { error } = await supabase
    .from('apartments')
    .update({ payment_due_day: day })
    .eq('client_id', clientId)

  if (error) throw error
}

/**
 * Generate pending billings for the current month.
 * For each active tenant in the client's apartments, if there's no payment record
 * for the current month, create a pending payment.
 * Also marks existing pending payments as overdue if past due date.
 */
export async function generateMonthlyBillings(clientId: string): Promise<void> {
  // 1. Get all apartments for this client with their due day and monthly rent
  const { data: apartments } = await supabase
    .from('apartments')
    .select('id, payment_due_day, monthly_rent')
    .eq('client_id', clientId)
    .eq('status', 'active')

  if (!apartments || apartments.length === 0) return

  const apartmentIds = apartments.map(a => a.id)
  const apartmentMap = new Map(apartments.map(a => [a.id, a]))

  // 2. Get all active tenants in these apartments
  const { data: allTenants } = await supabase
    .from('tenants')
    .select('id, apartment_id')
    .in('apartment_id', apartmentIds)
    .eq('status', 'active')

  if (!allTenants || allTenants.length === 0) return

  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() // 0-indexed
  const monthStart = new Date(year, month, 1).toISOString().split('T')[0]
  const monthEnd = new Date(year, month + 1, 0).toISOString().split('T')[0]

  // 3. Get existing payments for this month
  const { data: existingPayments } = await supabase
    .from('payments')
    .select('tenant_id, status')
    .eq('client_id', clientId)
    .gte('period_from', monthStart)
    .lte('period_from', monthEnd)

  const paidOrPendingTenants = new Set(
    (existingPayments || []).map(p => p.tenant_id).filter(Boolean)
  )

  // 4. Create pending payments for tenants without a payment this month
  const newPayments: Array<Record<string, unknown>> = []

  for (const tenant of allTenants) {
    if (paidOrPendingTenants.has(tenant.id)) continue

    const apt = apartmentMap.get(tenant.apartment_id)
    if (!apt || !apt.payment_due_day) continue

    const dueDay = Math.min(apt.payment_due_day, new Date(year, month + 1, 0).getDate())
    const dueDate = new Date(year, month, dueDay)
    const isPastDue = now > dueDate

    newPayments.push({
      client_id: clientId,
      tenant_id: tenant.id,
      apartment_id: tenant.apartment_id,
      amount: apt.monthly_rent || 0,
      payment_date: dueDate.toISOString(),
      status: isPastDue ? 'overdue' : 'pending',
      description: `Monthly rent - ${new Date(year, month).toLocaleString('default', { month: 'long', year: 'numeric' })}`,
      payment_mode: null,
      period_from: monthStart,
      period_to: monthEnd,
    })
  }

  if (newPayments.length > 0) {
    const { error } = await supabase.from('payments').insert(newPayments)
    if (error) throw error
  }

  // 5. Mark existing pending payments as overdue if past due date
  for (const apt of apartments) {
    if (!apt.payment_due_day) continue
    const dueDay = Math.min(apt.payment_due_day, new Date(year, month + 1, 0).getDate())
    const dueDate = new Date(year, month, dueDay)

    if (now > dueDate) {
      await supabase
        .from('payments')
        .update({ status: 'overdue' })
        .eq('client_id', clientId)
        .eq('apartment_id', apt.id)
        .eq('status', 'pending')
        .gte('period_from', monthStart)
        .lte('period_from', monthEnd)
    }
  }
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
  const { error } = await supabase
    .from('payments')
    .insert({
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

  if (error) throw error
}

// ── Get Active Tenants (for SMS notifications) ─────────────
export async function getActiveTenants(clientId: string): Promise<{ id: string; name: string; phone: string | null }[]> {
  // Get apartment IDs belonging to this client
  const { data: apartments } = await supabase
    .from('apartments')
    .select('id')
    .eq('client_id', clientId)

  if (!apartments || apartments.length === 0) return []

  const aptIds = apartments.map(a => a.id)
  const { data, error } = await supabase
    .from('tenants')
    .select('id, name, phone')
    .in('apartment_id', aptIds)
    .eq('status', 'active')

  if (error) throw error
  return data || []
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
  const { data, error } = await supabase
    .from('documents')
    .select('*, tenants(name), apartments(name)')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })

  if (error) throw error
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
  const ext = file.name.split('.').pop()
  const path = `${clientId}/${crypto.randomUUID()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('documents')
    .upload(path, file, { contentType: file.type })

  if (uploadError) throw uploadError

  const { data: urlData } = supabase.storage.from('documents').getPublicUrl(path)

  const { data, error } = await supabase
    .from('documents')
    .insert({
      client_id: clientId,
      apartment_id: apartmentId || null,
      tenant_id: tenantId || null,
      uploaded_by: managerId,
      file_name: file.name,
      file_url: urlData.publicUrl,
      file_type: file.type,
      description: description || null,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteDocument(id: string, fileUrl: string) {
  // Extract path from URL for storage deletion
  const urlParts = fileUrl.split('/documents/')
  if (urlParts.length > 1) {
    await supabase.storage.from('documents').remove([urlParts[urlParts.length - 1]])
  }

  const { error } = await supabase.from('documents').delete().eq('id', id)
  if (error) throw error
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
  const { data: apartments } = await supabase
    .from('apartments')
    .select('id, name')
    .eq('client_id', clientId)

  if (!apartments || apartments.length === 0) return []

  const aptIds = apartments.map(a => a.id)
  const aptMap = new Map(apartments.map(a => [a.id, a.name]))

  const { data, error } = await supabase
    .from('tenants')
    .select('*')
    .in('apartment_id', aptIds)
    .order('created_at', { ascending: false })

  if (error) throw error

  return (data || []).map(t => ({
    ...t,
    apartment_name: t.apartment_id ? aptMap.get(t.apartment_id) || 'Unknown' : '—',
  }))
}

export async function createTenantAccount(tenant: {
  name: string
  email: string
  phone?: string
  apartment_id?: string
  client_id: string
}) {
  // 1. Generate a random password
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%'
  let password = ''
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length))
  }

  // 2. Create Supabase Auth user
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: tenant.email,
    password,
    options: {
      data: { name: tenant.name, role: 'tenant' },
    },
  })

  if (authError) throw authError

  // 3. Create tenant record linked to auth user
  const { data, error } = await supabase
    .from('tenants')
    .insert({
      name: tenant.name,
      email: tenant.email,
      phone: tenant.phone || null,
      apartment_id: tenant.apartment_id || null,
      client_id: tenant.client_id,
      auth_user_id: authData.user?.id || null,
      status: 'active',
    })
    .select()
    .single()

  if (error) throw error
  return { tenant: data, generatedPassword: password }
}

export async function updateTenantAccount(id: string, updates: {
  name?: string
  email?: string
  phone?: string
  apartment_id?: string | null
  status?: string
}) {
  const { data, error } = await supabase
    .from('tenants')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteTenantAccount(id: string) {
  const { error } = await supabase
    .from('tenants')
    .delete()
    .eq('id', id)

  if (error) throw error
}
