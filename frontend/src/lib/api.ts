import api from './apiClient'

// ── Types ──────────────────────────────────────────────────
export interface Client {
  id: string
  name: string
  email: string
  phone: string | null
  apartment_address: string | null
  sex: string | null
  age: string | null
  apartment_classification: string | null
  street_building: string | null
  barangay: string | null
  province: string | null
  city_municipality: string | null
  zip_code: string | null
  number_of_units: string | null
  number_of_floors: string | null
  other_property_details: string | null
  status: 'active' | 'inactive'
  joined_date: string
  created_at: string
  apartments?: number // computed from join
}

export interface Apartment {
  id: string
  name: string
  address: string
  apartmentowner_id: string | null
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
  unit_id: string | null
  status: 'active' | 'inactive'
  move_in_date: string
}

export interface Inquiry {
  id: string
  name: string
  email: string
  phone: string | null
  sex: string | null
  age: string | null
  apartment_classification: string | null
  street_building: string | null
  barangay: string | null
  province: string | null
  city_municipality: string | null
  zip_code: string | null
  number_of_units: string | null
  number_of_floors: string | null
  number_of_rooms: string | null
  other_property_details: string | null
  status: 'pending' | 'responded' | 'approved' | 'cancelled'
  created_at: string
}

export interface Manager {
  id: string
  name: string
  email: string
  phone: string | null
  apartmentowner_id: string | null
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

export async function createClient(client: {
  name: string; email: string; phone?: string; apartment_address?: string;
  sex?: string; age?: string; apartment_classification?: string;
  street_building?: string; barangay?: string; province?: string;
  city_municipality?: string; zip_code?: string;
  number_of_units?: string; number_of_floors?: string; number_of_rooms?: string; other_property_details?: string;
}) {
  const result = await api.post<Client & { generatedPassword?: string; requiresEmailVerification?: boolean }>('/clients', client)
  return {
    client: result,
    generatedPassword: result.generatedPassword,
    requiresEmailVerification: result.requiresEmailVerification,
  }
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
  const clientIds = [...new Set(managers.filter(m => m.apartmentowner_id).map(m => m.apartmentowner_id))]
  let clientMap: Record<string, string> = {}

  if (clientIds.length > 0) {
    const clients = await api.get<{ id: string; name: string }[]>('/clients')
    clients.forEach(c => {
      clientMap[c.id] = c.name
    })
  }

  return managers.map(m => ({
    ...m,
    client_name: m.apartmentowner_id ? clientMap[m.apartmentowner_id] || 'Unknown' : undefined,
  })) as Manager[]
}

export async function createManager(manager: { name: string; email: string; phone?: string; apartmentowner_id?: string }) {
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

export async function submitInquiry(data: {
  name: string
  email: string
  phone?: string
  sex?: string
  age?: string
  apartment_classification?: string
  street_building?: string
  barangay?: string
  province?: string
  city_municipality?: string
  zip_code?: string
  number_of_units?: string
  number_of_floors?: string
  number_of_rooms?: string
  other_property_details?: string
}) {
  await api.post('/inquiries', {
    name: data.name,
    email: data.email,
    phone: data.phone || null,
    sex: data.sex || null,
    age: data.age || null,
    apartment_classification: data.apartment_classification || null,
    street_building: data.street_building || null,
    barangay: data.barangay || null,
    province: data.province || null,
    city_municipality: data.city_municipality || null,
    zip_code: data.zip_code || null,
    number_of_units: data.number_of_units || null,
    number_of_floors: data.number_of_floors || null,
    number_of_rooms: data.number_of_rooms || null,
    other_property_details: data.other_property_details || null,
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
  // Build apartment address from individual location fields
  const addressParts = [
    inquiry.street_building,
    inquiry.barangay,
    inquiry.city_municipality,
    inquiry.province,
    inquiry.zip_code,
  ].filter(Boolean)
  const apartmentAddress = addressParts.length > 0 ? addressParts.join(', ') : undefined

  // 1. Create client + auth account
  const result = await createClient({
    name: overrides?.name || inquiry.name,
    email: overrides?.email || inquiry.email,
    phone: overrides?.phone || inquiry.phone || undefined,
    apartment_address: apartmentAddress,
    sex: inquiry.sex || undefined,
    age: inquiry.age || undefined,
    apartment_classification: inquiry.apartment_classification || undefined,
    street_building: inquiry.street_building || undefined,
    barangay: inquiry.barangay || undefined,
    province: inquiry.province || undefined,
    city_municipality: inquiry.city_municipality || undefined,
    zip_code: inquiry.zip_code || undefined,
    number_of_units: inquiry.number_of_units || undefined,
    number_of_floors: inquiry.number_of_floors || undefined,
    number_of_rooms: inquiry.number_of_rooms || undefined,
    other_property_details: inquiry.other_property_details || undefined,
  })

  // 2. Auto-create units from inquiry's number_of_units
  const unitCount = inquiry.number_of_units ? parseInt(inquiry.number_of_units, 10) : 0
  if (unitCount > 0 && result.client?.id) {
    const units = []
    for (let i = 0; i < unitCount; i++) {
      units.push({
        name: `Unit ${i + 1}`,
        address: apartmentAddress || '-',
        monthly_rent: 0,
        apartmentowner_id: result.client.id,
        status: 'active',
      })
    }
    await api.post('/apartments/bulk', { apartments: units })
  }

  // 3. Mark inquiry as approved only after account creation succeeds
  const updated = await updateInquiryStatus(inquiry.id, 'approved')

  return {
    inquiry: updated,
    client: result.client,
    generatedPassword: result.generatedPassword,
    requiresEmailVerification: result.requiresEmailVerification,
  }
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
