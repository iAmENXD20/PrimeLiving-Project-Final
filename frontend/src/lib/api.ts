import { supabase } from './supabase'

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
  const [apartments, clients, tenants, managers, inquiries] = await Promise.all([
    supabase.from('apartments').select('id', { count: 'exact' }).eq('status', 'active'),
    supabase.from('clients').select('id', { count: 'exact' }),
    supabase.from('tenants').select('id', { count: 'exact' }).eq('status', 'active'),
    supabase.from('managers').select('id', { count: 'exact' }).eq('status', 'active'),
    supabase.from('inquiries').select('id', { count: 'exact' }).eq('status', 'pending'),
  ])

  const totalUsers = (clients.count ?? 0) + (managers.count ?? 0) + (tenants.count ?? 0)

  return {
    apartments: apartments.count ?? 0,
    clients: clients.count ?? 0,
    tenants: tenants.count ?? 0,
    managers: managers.count ?? 0,
    totalUsers,
    pendingInquiries: inquiries.count ?? 0,
  }
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
  const [clientsRes, managersRes, tenantsRes] = await Promise.all([
    supabase.from('clients').select('*').order('created_at', { ascending: false }),
    supabase.from('managers').select('*, clients(apartment_address)').order('created_at', { ascending: false }),
    supabase.from('tenants').select('*, apartments(address)').order('created_at', { ascending: false }),
  ])

  const users: UserRecord[] = []

  clientsRes.data?.forEach((c) => {
    users.push({
      id: c.id,
      name: c.name,
      email: c.email,
      phone: c.phone,
      role: 'owner',
      status: c.status || 'active',
      address: c.apartment_address || null,
      created_at: c.created_at,
    })
  })

  managersRes.data?.forEach((m: any) => {
    users.push({
      id: m.id,
      name: m.name,
      email: m.email,
      phone: m.phone,
      role: 'manager',
      status: m.status || 'active',
      address: m.clients?.apartment_address || null,
      created_at: m.created_at,
    })
  })

  tenantsRes.data?.forEach((t: any) => {
    users.push({
      id: t.id,
      name: t.name,
      email: t.email || '',
      phone: t.phone,
      role: 'tenant',
      status: t.status || 'active',
      address: t.apartments?.address || null,
      created_at: t.created_at,
    })
  })

  // Sort by created_at descending
  users.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  return users
}

// ── Clients CRUD ───────────────────────────────────────────
export async function getClients() {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data as Client[]
}

export async function createClient(client: { name: string; email: string; phone?: string }) {
  // 1. Generate a random password
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%'
  let password = ''
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length))
  }

  // 2. Create Supabase Auth user (sends verification email automatically)
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: client.email,
    password,
    options: {
      data: { name: client.name, role: 'owner' },
    },
  })

  if (authError) throw authError

  // 3. Create client record linked to auth user
  const { data, error } = await supabase
    .from('clients')
    .insert({
      ...client,
      auth_user_id: authData.user?.id || null,
    })
    .select()
    .single()

  if (error) throw error

  return { client: data as Client, generatedPassword: password }
}

export async function updateClient(id: string, updates: Partial<Client>) {
  const { data, error } = await supabase
    .from('clients')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as Client
}

export async function deleteClient(id: string) {
  const { error } = await supabase.from('clients').delete().eq('id', id)
  if (error) throw error
}

// ── Client Detail Stats (for Admin view) ───────────────────
export async function getClientDetailStats(clientId: string) {
  // Get apartments for this client
  const { data: apartments } = await supabase
    .from('apartments')
    .select('id')
    .eq('client_id', clientId)

  const aptIds = (apartments || []).map(a => a.id)

  // Get tenants (active vs inactive)
  const { data: tenants } = aptIds.length > 0
    ? await supabase
        .from('tenants')
        .select('id, status')
        .in('apartment_id', aptIds)
    : { data: [] as { id: string; status: string }[] }

  // Get managers (active vs inactive)
  const { data: managers } = await supabase
    .from('managers')
    .select('id, status')
    .eq('client_id', clientId)

  const tenantList = tenants || []
  const managerList = managers || []

  return {
    tenants: {
      active: tenantList.filter(t => t.status === 'active').length,
      inactive: tenantList.filter(t => t.status !== 'active').length,
      total: tenantList.length,
    },
    managers: {
      active: managerList.filter(m => m.status === 'active').length,
      inactive: managerList.filter(m => m.status !== 'active').length,
      total: managerList.length,
    },
  }
}
export async function getManagers() {
  const { data: managers, error } = await supabase
    .from('managers')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error

  // Fetch client names for each manager
  const clientIds = [...new Set((managers || []).filter(m => m.client_id).map(m => m.client_id))]
  let clientMap: Record<string, string> = {}

  if (clientIds.length > 0) {
    const { data: clients } = await supabase
      .from('clients')
      .select('id, name')
      .in('id', clientIds)

    clients?.forEach(c => {
      clientMap[c.id] = c.name
    })
  }

  return (managers || []).map(m => ({
    ...m,
    client_name: m.client_id ? clientMap[m.client_id] || 'Unknown' : undefined,
  })) as Manager[]
}

export async function createManager(manager: { name: string; email: string; phone?: string; client_id?: string }) {
  const { data, error } = await supabase
    .from('managers')
    .insert(manager)
    .select()
    .single()

  if (error) throw error
  return data as Manager
}

export async function updateManager(id: string, updates: Partial<Manager>) {
  const { data, error } = await supabase
    .from('managers')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as Manager
}

export async function deleteManager(id: string) {
  const { error } = await supabase.from('managers').delete().eq('id', id)
  if (error) throw error
}

// ── Apartments ─────────────────────────────────────────────
export async function getApartments() {
  const { data, error } = await supabase
    .from('apartments')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data as Apartment[]
}

export async function getApartmentsWithTenantCount() {
  // Get apartments with their tenant counts
  const { data: apartments, error: aptError } = await supabase
    .from('apartments')
    .select('*')
    .eq('status', 'active')
    .order('name')

  if (aptError) throw aptError

  const { data: tenants, error: tenError } = await supabase
    .from('tenants')
    .select('apartment_id')
    .eq('status', 'active')

  if (tenError) throw tenError

  // Count tenants per apartment
  const countMap: Record<string, number> = {}
  tenants?.forEach((t) => {
    if (t.apartment_id) {
      countMap[t.apartment_id] = (countMap[t.apartment_id] || 0) + 1
    }
  })

  return (apartments || []).map((apt) => ({
    ...apt,
    tenant_count: countMap[apt.id] || 0,
  })) as (Apartment & { tenant_count: number })[]
}

// ── Inquiries ──────────────────────────────────────────────

export async function submitInquiry(data: { name: string; email: string; phone?: string; apartment_name?: string; message: string }) {
  const { error } = await supabase
    .from('inquiries')
    .insert({ name: data.name, email: data.email, phone: data.phone || null, apartment_name: data.apartment_name || null, message: data.message })

  if (error) throw error
}

export async function getInquiries() {
  const { data, error } = await supabase
    .from('inquiries')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data as Inquiry[]
}

export async function getPendingInquiryCount(): Promise<number> {
  const { count, error } = await supabase
    .from('inquiries')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending')

  if (error) return 0
  return count ?? 0
}

export async function updateInquiryStatus(id: string, status: Inquiry['status']) {
  const { data, error } = await supabase
    .from('inquiries')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as Inquiry
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
  const apartmentsWithCounts = await getApartmentsWithTenantCount()

  // Fetch client names for owner display
  const clientIds = [...new Set(apartmentsWithCounts.map((a) => a.client_id).filter(Boolean))] as string[]
  let clientMap: Record<string, string> = {}
  if (clientIds.length > 0) {
    const { data: clients } = await supabase
      .from('clients')
      .select('id, name')
      .in('id', clientIds)
    clients?.forEach((c) => { clientMap[c.id] = c.name })
  }

  // Fetch manager counts per client
  let managerCountMap: Record<string, number> = {}
  if (clientIds.length > 0) {
    const { data: managers } = await supabase
      .from('managers')
      .select('client_id')
      .eq('status', 'active')
      .in('client_id', clientIds)
    managers?.forEach((m) => {
      if (m.client_id) {
        managerCountMap[m.client_id] = (managerCountMap[m.client_id] || 0) + 1
      }
    })
  }

  // Aggregate per client (one record per owner)
  const clientAggMap: Record<string, {
    owner: string
    tenants: number
    units: number
    apartments: number
    activeUnits: number
    addresses: string[]
    managers: number
  }> = {}

  for (const apt of apartmentsWithCounts) {
    const cid = apt.client_id || '__unassigned'
    const ownerName = apt.client_id && clientMap[apt.client_id] ? clientMap[apt.client_id] : 'Unassigned'

    if (!clientAggMap[cid]) {
      clientAggMap[cid] = {
        owner: ownerName,
        tenants: 0,
        units: 0,
        apartments: 0,
        activeUnits: 0,
        addresses: [],
        managers: apt.client_id ? managerCountMap[apt.client_id] || 0 : 0,
      }
    }

    clientAggMap[cid].tenants += apt.tenant_count
    clientAggMap[cid].units += apt.total_units || 0
    clientAggMap[cid].apartments += 1
    if (apt.tenant_count > 0) clientAggMap[cid].activeUnits += 1
    if (apt.address && !clientAggMap[cid].addresses.includes(apt.address)) {
      clientAggMap[cid].addresses.push(apt.address)
    }
  }

  return Object.entries(clientAggMap).map(([id, c]) => ({
    id,
    name: c.owner.length > 12 ? c.owner.slice(0, 12) : c.owner,
    fullName: c.owner,
    tenants: c.tenants,
    units: c.units,
    apartments: c.apartments,
    activeUnits: c.activeUnits,
    owner: c.owner,
    location: c.addresses.join(', '),
    managers: c.managers,
  }))
}

// ── User Distribution (for pie chart) ──────────────────────
export async function getUserDistribution() {
  const [clients, tenants, managers] = await Promise.all([
    supabase.from('clients').select('id', { count: 'exact' }),
    supabase.from('tenants').select('id', { count: 'exact' }).eq('status', 'active'),
    supabase.from('managers').select('id', { count: 'exact' }).eq('status', 'active'),
  ])

  return [
    { name: 'Clients', value: clients.count ?? 0 },
    { name: 'Tenants', value: tenants.count ?? 0 },
    { name: 'Managers', value: managers.count ?? 0 },
  ]
}
