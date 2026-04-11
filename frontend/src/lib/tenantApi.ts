import api from './apiClient'
import { supabase } from './supabase'

// ── Types ──────────────────────────────────────────────────
export interface TenantProfile {
  id: string
  auth_user_id: string | null
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  unit_id: string | null
  apartmentowner_id: string | null
  status: string
  move_in_date: string
  created_at: string
  updated_at: string
}

export interface TenantMaintenanceRequest {
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
}

export interface TenantPayment {
  id: string
  apartmentowner_id: string
  tenant_id: string | null
  unit_id: string | null
  amount: number
  payment_date: string
  status: 'paid' | 'pending' | 'overdue'
  description: string | null
  payment_mode: 'gcash' | 'maya' | 'cash' | 'bank_transfer' | null
  receipt_url: string | null
  verification_status: 'pending_verification' | 'verified' | 'approved' | 'rejected' | null
  period_from: string | null
  period_to: string | null
  created_at: string
}

export interface TenantDueScheduleItem {
  id: string
  period_from: string
  period_to: string
  payment_date: string
  amount: number
  status: 'pending' | 'overdue'
}

export interface TenantAnnouncement {
  id: string
  apartmentowner_id: string
  title: string
  message: string
  created_by: string
  created_at: string
}

export interface TenantNotification {
  id: string
  apartmentowner_id: string | null
  recipient_role: 'tenant' | 'manager'
  recipient_id: string
  type: string
  title: string
  message: string
  is_read: boolean
  created_at: string
}

export interface TenantDocument {
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
  unit_name?: string | null
}

// ── Get current tenant from auth user ──────────────────────
export async function getCurrentTenant(): Promise<TenantProfile | null> {
  const { data: { session } } = await supabase.auth.getSession()
  const userId = session?.user?.id
  if (!userId) return null

  try {
    return await api.get<TenantProfile>(`/tenants/by-auth/${userId}`)
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
      apartmentowner_id: data.apartmentowner_id,
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
  unit_id: string | null
  apartmentowner_id: string | null
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
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// File uploads are routed through backend for centralized storage handling
export async function uploadMaintenancePhoto(file: File, tenantId: string): Promise<string> {
  const dataUrl = await fileToDataUrl(file)
  const result = await api.post<{ photo_url: string }>('/maintenance/photos', {
    tenant_id: tenantId,
    data_url: dataUrl,
  })
  return result.photo_url
}

// ── Payments ───────────────────────────────────────────────
export async function getTenantPayments(tenantId: string): Promise<TenantPayment[]> {
  return api.get<TenantPayment[]>(`/payments?tenant_id=${tenantId}`)
}

export async function getTenantDueSchedule(tenantId: string): Promise<TenantDueScheduleItem[]> {
  return api.get<TenantDueScheduleItem[]>(`/payments/due-schedule/${tenantId}`)
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
  apartmentowner_id: string
  unit_id: string | null
  amount: number
  receipt_url: string
  period_from: string
  period_to: string
  description?: string
  payment_mode?: 'gcash' | 'maya' | 'cash' | 'bank_transfer'
}) {
  return api.post<any>('/payments/submit-proof', {
    tenant_id: params.tenant_id,
    apartmentowner_id: params.apartmentowner_id,
    unit_id: params.unit_id,
    amount: params.amount,
    receipt_url: params.receipt_url,
    period_from: params.period_from,
    period_to: params.period_to,
    description: params.description || 'Payment - Pending Verification',
    payment_mode: params.payment_mode || 'gcash',
  })
}

// ── Announcements / Notifications ──────────────────────────
export async function getTenantAnnouncements(ownerId: string, tenantId?: string): Promise<TenantAnnouncement[]> {
  const params = new URLSearchParams({ apartmentowner_id: ownerId })
  if (tenantId) {
    params.set('tenant_id', tenantId)
  }

  return api.get<TenantAnnouncement[]>(`/announcements?${params.toString()}`)
}

export async function getTenantDocuments(tenantId: string, ownerId?: string | null): Promise<TenantDocument[]> {
  const params = new URLSearchParams({ tenant_id: tenantId })
  if (ownerId) params.set('apartmentowner_id', ownerId)

  const data = await api.get<any[]>(`/documents?${params.toString()}`)
  return (data || []).map((doc: any) => ({
    ...doc,
    unit_name: doc.apartments?.name ?? null,
    apartments: undefined,
    tenants: undefined,
  }))
}

export async function getTenantNotifications(tenantId: string, ownerId?: string | null): Promise<TenantNotification[]> {
  const params = new URLSearchParams({
    recipient_role: 'tenant',
    recipient_id: tenantId,
  })
  if (ownerId) params.set('apartmentowner_id', ownerId)
  return api.get<TenantNotification[]>(`/notifications?${params.toString()}`, { skipCache: true })
}

export async function markTenantNotificationRead(id: string): Promise<void> {
  await api.put(`/notifications/${id}/read`, {})
}

export async function markAllTenantNotificationsRead(tenantId: string): Promise<void> {
  await api.put('/notifications/read-all', {
    recipient_role: 'tenant',
    recipient_id: tenantId,
  })
}

export async function deleteTenantNotification(id: string): Promise<void> {
  await api.delete(`/notifications/${id}`)
}

export async function deleteAllTenantNotifications(tenantId: string, ownerId?: string | null): Promise<void> {
  await api.delete('/notifications/all', {
    recipient_role: 'tenant',
    recipient_id: tenantId,
    apartmentowner_id: ownerId || undefined,
  })
}

export async function getUnreadNotificationCount(tenantId: string, ownerId?: string | null): Promise<number> {
  const notifications = await getTenantNotifications(tenantId, ownerId)
  return notifications.filter((notification) => !notification.is_read).length
}

// ── Payment QR Code (fetch from owner) ──────────
const QR_CACHE_KEY = 'payment_qr_cache'

export async function getOwnerPaymentQrUrl(ownerId?: string | null, apartmentId?: string | null, tenantId?: string | null): Promise<string | null> {
  const cacheKey = tenantId || ownerId || apartmentId || 'unknown'

  if (tenantId) {
    try {
      const byTenant = await api.get<{ qr_url: string; apartmentowner_id?: string }>(`/payments/qr/by-tenant/${tenantId}`)
      if (byTenant.qr_url) {
        const resolvedKey = byTenant.apartmentowner_id || cacheKey
        localStorage.setItem(`${QR_CACHE_KEY}_${resolvedKey}`, byTenant.qr_url)
        localStorage.setItem(`${QR_CACHE_KEY}_${cacheKey}`, byTenant.qr_url)
        return byTenant.qr_url
      }
    } catch {
      // continue to client/apartment fallback
    }
  }

  if (ownerId) {
    try {
      const result = await api.get<{ qr_url: string }>(`/payments/qr/${ownerId}`)
      if (result.qr_url) {
        localStorage.setItem(`${QR_CACHE_KEY}_${cacheKey}`, result.qr_url)
        return result.qr_url
      }
    } catch {
      // continue to apartment fallback
    }
  }

  if (apartmentId) {
    try {
      const fallback = await api.get<{ qr_url: string; apartmentowner_id?: string }>(`/payments/qr/by-apartment/${apartmentId}`)
      if (fallback.qr_url) {
        const resolvedKey = fallback.apartmentowner_id || cacheKey
        localStorage.setItem(`${QR_CACHE_KEY}_${resolvedKey}`, fallback.qr_url)
        localStorage.setItem(`${QR_CACHE_KEY}_${cacheKey}`, fallback.qr_url)
        return fallback.qr_url
      }
    } catch {
      // fall through to cache
    }
  }

  return localStorage.getItem(`${QR_CACHE_KEY}_${cacheKey}`) || null
}
