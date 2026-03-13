import api from './apiClient'
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

  try {
    return await api.get<TenantProfile>(`/tenants/by-auth/${user.id}`)
  } catch {
    return null
  }
}

// ── Tenant Dashboard Stats ─────────────────────────────────
export async function getTenantDashboardStats(tenantId: string, _apartmentId: string | null) {
  return api.get<{
    pendingMaintenance: number
    resolvedMaintenance: number
    totalPaid: number
    pendingPayments: number
  }>(`/analytics/tenant/${tenantId}`)
}

// ── Get Apartment Info ─────────────────────────────────────
export async function getTenantApartmentInfo(apartmentId: string) {
  try {
    const data = await api.get<any>(`/apartments/${apartmentId}`)
    if (!data) return null
    return {
      name: data.name,
      address: data.address,
      monthly_rent: data.monthly_rent,
      client_id: data.client_id,
    }
  } catch {
    return null
  }
}

// ── Maintenance Requests ───────────────────────────────────
export async function getTenantMaintenanceRequests(tenantId: string): Promise<TenantMaintenanceRequest[]> {
  return api.get<TenantMaintenanceRequest[]>(`/maintenance?tenant_id=${tenantId}`)
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
  return api.post<TenantMaintenanceRequest>('/maintenance', {
    ...request,
    photo_url: request.photo_url || null,
  })
}

// ── Upload Maintenance Photo ───────────────────────────────
// File uploads go directly to Supabase Storage (not routed through backend)
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
  return api.get<TenantPayment[]>(`/payments?tenant_id=${tenantId}`)
}

// ── Upload Payment Receipt to Supabase Storage ─────────────
// File uploads go directly to Supabase Storage (not routed through backend)
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
  return api.post<any>('/payments', {
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
}

// ── Announcements / Notifications ──────────────────────────
export async function getTenantAnnouncements(clientId: string): Promise<TenantAnnouncement[]> {
  return api.get<TenantAnnouncement[]>(`/announcements?client_id=${clientId}`)
}

// ── Notification Read Tracking (localStorage) ──────────────
// Client-side only — no backend needed
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
// Client-side only — stored in localStorage
const QR_STORAGE_KEY = 'primeliving_payment_qr'

export function getClientPaymentQrUrl(clientId: string): string | null {
  return localStorage.getItem(`${QR_STORAGE_KEY}_${clientId}`) || null
}
