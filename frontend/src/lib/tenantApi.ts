import { supabase } from './supabase'

// ── Types ──────────────────────────────────────────────────
export interface TenantProfile {
  id: string
  auth_user_id: string | null
  name: string
  email: string | null
  phone: string | null
  apartment_id: string | null
  status: string
  move_in_date: string
  created_at: string
  updated_at: string
}

export interface TenantMaintenanceRequest {
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
}

export interface TenantPayment {
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
}

export interface TenantAnnouncement {
  id: string
  client_id: string
  title: string
  message: string
  created_by: string
  created_at: string
}

// ── Get current tenant from auth user ──────────────────────
export async function getCurrentTenant(): Promise<TenantProfile | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('tenants')
    .select('*')
    .eq('auth_user_id', user.id)
    .single()

  if (error) return null
  return data
}

// ── Tenant Dashboard Stats ─────────────────────────────────
export async function getTenantDashboardStats(tenantId: string, apartmentId: string | null) {
  const [maintenance, payments] = await Promise.all([
    supabase
      .from('maintenance_requests')
      .select('id, status')
      .eq('tenant_id', tenantId),
    supabase
      .from('payments')
      .select('amount, status')
      .eq('tenant_id', tenantId),
  ])

  const maintenanceData = maintenance.data || []
  const paymentData = payments.data || []

  const pendingMaintenance = maintenanceData.filter(m => m.status === 'pending' || m.status === 'in_progress').length
  const resolvedMaintenance = maintenanceData.filter(m => m.status === 'resolved' || m.status === 'closed').length
  const totalPaid = paymentData.filter(p => p.status === 'paid').reduce((sum, p) => sum + Number(p.amount), 0)
  const pendingPayments = paymentData.filter(p => p.status === 'pending' || p.status === 'overdue').length

  return {
    pendingMaintenance,
    resolvedMaintenance,
    totalPaid,
    pendingPayments,
  }
}

// ── Get Apartment Info ─────────────────────────────────────
export async function getTenantApartmentInfo(apartmentId: string) {
  const { data, error } = await supabase
    .from('apartments')
    .select('name, address, monthly_rent, client_id')
    .eq('id', apartmentId)
    .single()

  if (error) return null
  return data
}

// ── Maintenance Requests ───────────────────────────────────
export async function getTenantMaintenanceRequests(tenantId: string): Promise<TenantMaintenanceRequest[]> {
  const { data, error } = await supabase
    .from('maintenance_requests')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

export async function createTenantMaintenanceRequest(request: {
  tenant_id: string
  apartment_id: string | null
  client_id: string | null
  title: string
  description: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
  photo_url?: string | null
}) {
  const { data, error } = await supabase
    .from('maintenance_requests')
    .insert(request)
    .select()
    .single()

  if (error) throw error
  return data
}

// ── Upload Maintenance Photo ───────────────────────────────
export async function uploadMaintenancePhoto(file: File, tenantId: string): Promise<string> {
  const ext = file.name.split('.').pop()
  const fileName = `${tenantId}/${Date.now()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('maintenance-photos')
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: false,
    })

  if (uploadError) throw uploadError

  const { data } = supabase.storage
    .from('maintenance-photos')
    .getPublicUrl(fileName)

  return data.publicUrl
}

// ── Payments ───────────────────────────────────────────────
export async function getTenantPayments(tenantId: string): Promise<TenantPayment[]> {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('payment_date', { ascending: false })

  if (error) throw error
  return data || []
}

// ── Upload Payment Receipt to Supabase Storage ─────────────
export async function uploadPaymentReceipt(file: File, tenantId: string): Promise<string> {
  const ext = file.name.split('.').pop()
  const fileName = `${tenantId}/${Date.now()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('payment-receipts')
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: false,
    })

  if (uploadError) throw uploadError

  const { data } = supabase.storage
    .from('payment-receipts')
    .getPublicUrl(fileName)

  return data.publicUrl
}

// ── Submit Cash Payment Verification Request ───────────────
export async function submitCashPaymentVerification(params: {
  tenant_id: string
  client_id: string
  apartment_id: string | null
  amount: number
  receipt_url: string
  period_from: string
  period_to: string
  description?: string
}) {
  const { data, error } = await supabase
    .from('payments')
    .insert({
      tenant_id: params.tenant_id,
      client_id: params.client_id,
      apartment_id: params.apartment_id,
      amount: params.amount,
      payment_date: new Date().toISOString(),
      status: 'pending',
      payment_mode: 'cash',
      receipt_url: params.receipt_url,
      verification_status: 'pending_verification',
      period_from: params.period_from,
      period_to: params.period_to,
      description: params.description || 'Cash Payment - Pending Verification',
    })
    .select()
    .single()

  if (error) throw error
  return data
}

// ── Announcements / Notifications ──────────────────────────
export async function getTenantAnnouncements(clientId: string): Promise<TenantAnnouncement[]> {
  const { data, error } = await supabase
    .from('announcements')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

// ── Notification Read Tracking (localStorage) ──────────────
const READ_KEY = 'primeliving_read_notifications'

function getReadIds(): Set<string> {
  try {
    const raw = localStorage.getItem(READ_KEY)
    if (!raw) return new Set()
    return new Set(JSON.parse(raw) as string[])
  } catch {
    return new Set()
  }
}

export function markNotificationsAsRead(ids: string[]) {
  const readIds = getReadIds()
  ids.forEach(id => readIds.add(id))
  localStorage.setItem(READ_KEY, JSON.stringify([...readIds]))
}

export async function getUnreadNotificationCount(clientId: string): Promise<number> {
  const announcements = await getTenantAnnouncements(clientId)
  const readIds = getReadIds()
  return announcements.filter(a => !readIds.has(a.id)).length
}

// ── Payment QR Code (fetch from owner/client) ──────────
const QR_STORAGE_KEY = 'primeliving_payment_qr'

export function getClientPaymentQrUrl(clientId: string): string | null {
  return localStorage.getItem(`${QR_STORAGE_KEY}_${clientId}`) || null
}
