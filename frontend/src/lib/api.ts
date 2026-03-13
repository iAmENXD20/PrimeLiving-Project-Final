import api from './apiClient'

// ── Types ──────────────────────────────────────────────────
export interface Client {
  id: string
  name: string
  email: string
  phone: string | null
  apartment_address: string | null
  status: 'active' | 'inactive'
  joined_date: string
  created_at: string
  apartments?: number // computed from join
}

export interface Apartment {
  id: string
  name: string
  address: string
  client_id: string | null
  total_units: number
  monthly_rent: number
  status: 'active' | 'inactive'
  created_at: string
  tenant_count?: number // computed
}

export interface Tenant {
  id: string
  name: string
  email: string | null
  phone: string | null
  apartment_id: string | null
  status: 'active' | 'inactive'
  move_in_date: string
}

export interface Inquiry {
  id: string
  name: string
  email: string
  phone: string | null
  apartment_name: string | null
  message: string
  status: 'pending' | 'responded' | 'approved' | 'cancelled'
  created_at: string
}

export interface Manager {
  id: string
  name: string
  email: string
  phone: string | null
  client_id: string | null
  client_name?: string // computed from join
  status: 'active' | 'inactive'
  joined_date: string
  created_at: string
}

// ── Dashboard Stats ────────────────────────────────────────
export async function getDashboardStats() {
  return api.get<{
    apartments: number
    clients: number
    tenants: number
    managers: number
    totalUsers: number
    pendingInquiries: number
  }>('/analytics/overview')
}

// ── All Users (excluding admins) ───────────────────────────
export interface UserRecord {
  id: string
  name: string
  email: string
  phone: string | null
  role: 'owner' | 'manager' | 'tenant'
  status: string
  address: string | null
  created_at: string
}

export async function getAllUsers(): Promise<UserRecord[]> {
  return api.get<UserRecord[]>('/analytics/all-users')
}

// ── Clients CRUD ───────────────────────────────────────────
export async function getClients() {
  return api.get<Client[]>('/clients')
}

export async function createClient(client: { name: string; email: string; phone?: string }) {
  const result = await api.post<Client & { generatedPassword: string }>('/clients', client)
  return { client: result, generatedPassword: result.generatedPassword }
}

export async function updateClient(id: string, updates: Partial<Client>) {
  return api.put<Client>(`/clients/${id}`, { ...updates, updated_at: new Date().toISOString() })
}

export async function deleteClient(id: string) {
  await api.delete(`/clients/${id}`)
}

// ── Client Detail Stats (for Admin view) ───────────────────
export async function getClientDetailStats(clientId: string) {
  return api.get<{
    tenants: { active: number; inactive: number; total: number }
    managers: { active: number; inactive: number; total: number }
  }>(`/analytics/owner/${clientId}/detail-stats`)
}

// ── Managers ───────────────────────────────────────────────
export async function getManagers() {
  const managers = await api.get<Manager[]>('/managers')

  // Fetch client names for each manager
  const clientIds = [...new Set(managers.filter(m => m.client_id).map(m => m.client_id))]
  let clientMap: Record<string, string> = {}

  if (clientIds.length > 0) {
    const clients = await api.get<{ id: string; name: string }[]>('/clients')
    clients.forEach(c => {
      clientMap[c.id] = c.name
    })
  }

  return managers.map(m => ({
    ...m,
    client_name: m.client_id ? clientMap[m.client_id] || 'Unknown' : undefined,
  })) as Manager[]
}

export async function createManager(manager: { name: string; email: string; phone?: string; client_id?: string }) {
  const result = await api.post<Manager & { generatedPassword: string }>('/managers', manager)
  return result
}

export async function updateManager(id: string, updates: Partial<Manager>) {
  return api.put<Manager>(`/managers/${id}`, { ...updates, updated_at: new Date().toISOString() })
}

export async function deleteManager(id: string) {
  await api.delete(`/managers/${id}`)
}

// ── Apartments ─────────────────────────────────────────────
export async function getApartments() {
  return api.get<Apartment[]>('/apartments')
}

export async function getApartmentsWithTenantCount() {
  return api.get<(Apartment & { tenant_count: number })[]>('/apartments/with-tenants')
}

// ── Inquiries ──────────────────────────────────────────────

export async function submitInquiry(data: { name: string; email: string; phone?: string; apartment_name?: string; message: string }) {
  await api.post('/inquiries', {
    name: data.name,
    email: data.email,
    phone: data.phone || null,
    apartment_name: data.apartment_name || null,
    message: data.message,
  })
}

export async function getInquiries() {
  return api.get<Inquiry[]>('/inquiries')
}

export async function getPendingInquiryCount(): Promise<number> {
  try {
    const result = await api.get<{ count: number }>('/inquiries/count/pending')
    return result.count ?? 0
  } catch {
    return 0
  }
}

export async function updateInquiryStatus(id: string, status: Inquiry['status']) {
  return api.put<Inquiry>(`/inquiries/${id}/status`, { status })
}

/**
 * Approve an inquiry: mark it as 'approved', create a client record
 * with a Supabase Auth account, and return the credentials.
 */
export async function approveInquiry(
  inquiry: Inquiry,
  overrides?: { name?: string; email?: string; phone?: string }
) {
  // 1. Mark inquiry as approved
  const updated = await updateInquiryStatus(inquiry.id, 'approved')

  // 2. Create client + auth account (reuses createClient logic)
  const result = await createClient({
    name: overrides?.name || inquiry.name,
    email: overrides?.email || inquiry.email,
    phone: overrides?.phone || inquiry.phone || undefined,
  })

  return { inquiry: updated, client: result.client, generatedPassword: result.generatedPassword }
}

// ── Tenants per Client (for charts) ─────────────────────
export async function getTenantsPerApartment() {
  return api.get<{
    id: string
    name: string
    fullName: string
    tenants: number
    units: number
    apartments: number
    activeUnits: number
    owner: string
    location: string
    managers: number
  }[]>('/analytics/tenants-per-apartment')
}

// ── User Distribution (for pie chart) ──────────────────────
export async function getUserDistribution() {
  return api.get<{ name: string; value: number }[]>('/analytics/user-distribution')
}
