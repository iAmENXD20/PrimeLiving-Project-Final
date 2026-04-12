import api from './apiClient'

// ── Types ──────────────────────────────────────────────────
export interface Owner {
  id: string
  first_name: string
  last_name: string
  email: string
  phone: string | null
  status: 'active' | 'inactive'
  auth_user_id?: string
  created_at?: string
  updated_at?: string
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
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  unit_id: string | null
  apartmentowner_id: string | null
  status: 'active' | 'inactive' | 'pending' | 'pending_verification'
  move_in_date: string
  auth_user_id?: string | null
  created_at?: string
}

export interface Manager {
  id: string
  first_name: string
  last_name: string
  email: string
  phone: string | null
  apartmentowner_id: string | null
  apartment_id?: string | null
  apartment?: { id: string; name: string; address: string } | null
  client_name?: string // computed from join
  status: 'active' | 'inactive' | 'pending'
  joined_date: string
  created_at: string
}

// ── Dashboard Stats ────────────────────────────────────────
export async function getDashboardStats() {
  return api.get<{
    apartments: number
    owners: number
    tenants: number
    managers: number
    totalUsers: number
  }>('/analytics/overview')
}

// ── All Users ──────────────────────────────────────────────
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

// ── Owners CRUD ───────────────────────────────────────────
export async function getOwners() {
  return api.get<Owner[]>('/owners')
}

export async function createOwner(owner: {
  first_name: string; last_name: string; email: string; phone?: string;
}) {
  const result = await api.post<Owner & { generatedPassword?: string; requiresEmailVerification?: boolean }>('/owners', owner)
  return {
    owner: result,
    generatedPassword: result.generatedPassword,
    requiresEmailVerification: result.requiresEmailVerification,
  }
}

export async function updateOwner(id: string, updates: Partial<Owner>) {
  return api.put<Owner>(`/owners/${id}`, { ...updates, updated_at: new Date().toISOString() })
}

export async function deleteOwner(id: string) {
  await api.delete(`/owners/${id}`)
}

// ── Owner Detail Stats ────────────────────────────────────
export async function getOwnerDetailStats(ownerId: string) {
  return api.get<{
    tenants: { active: number; inactive: number; total: number }
    managers: { active: number; inactive: number; total: number }
  }>(`/analytics/owner/${ownerId}/detail-stats`)
}

// ── Managers ───────────────────────────────────────────────
export async function getManagers() {
  const managers = await api.get<Manager[]>('/managers')

  // Fetch owner names for each manager
  const ownerIds = [...new Set(managers.filter(m => m.apartmentowner_id).map(m => m.apartmentowner_id))]
  let ownerMap: Record<string, string> = {}

  if (ownerIds.length > 0) {
    const owners = await api.get<{ id: string; first_name: string; last_name: string }[]>('/owners')
    owners.forEach(c => {
      ownerMap[c.id] = `${c.first_name} ${c.last_name}`.trim()
    })
  }

  return managers.map(m => ({
    ...m,
    client_name: m.apartmentowner_id ? ownerMap[m.apartmentowner_id] || 'Unknown' : undefined,
  })) as Manager[]
}

export async function createManager(manager: { firstName: string; lastName: string; email: string; phone?: string; apartmentowner_id?: string }) {
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

// ── Tenants per Owner (for charts) ─────────────────────
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

