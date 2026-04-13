import { useEffect, useState, useRef } from 'react'
import { Search, Bell, ChevronDown, X, Building2, MapPin, Wrench } from 'lucide-react'
import { createPortal } from 'react-dom'
import { toast } from 'sonner'
import { useTheme } from '../../context/ThemeContext'
import {
  getOwnerMaintenanceRequests,
  createOwnerAnnouncement,
  type MaintenanceRequest,
} from '../../lib/ownerApi'
import { TableSkeleton } from '@/components/ui/skeleton'
import TablePagination from '@/components/ui/table-pagination'

const STATUSES = ['all', 'pending', 'in_progress', 'resolved', 'closed'] as const
type StatusFilter = (typeof STATUSES)[number]

const PRIORITIES = ['all', 'low', 'medium', 'high', 'urgent'] as const
type PriorityFilter = (typeof PRIORITIES)[number]

const statusColor: Record<string, string> = {
  pending: 'bg-yellow-500/15 text-yellow-500',
  in_progress: 'bg-blue-400/15 text-blue-400',
  resolved: 'bg-green-400/15 text-green-500',
  closed: 'bg-gray-400/15 text-gray-400',
}

const priorityColor: Record<string, string> = {
  low: 'bg-blue-400/15 text-blue-400',
  medium: 'bg-yellow-400/15 text-yellow-500',
  high: 'bg-orange-400/15 text-orange-400',
  urgent: 'bg-red-400/15 text-red-400',
}

interface OwnerMaintenanceTabProps {
  clientId: string
  ownerName?: string
}

/** Parse photo_url field — may be a JSON array string or a single URL */
function parsePhotoUrls(photoUrl: string | null | undefined): string[] {
  if (!photoUrl) return []
  try {
    const parsed = JSON.parse(photoUrl)
    if (Array.isArray(parsed)) return parsed.filter(Boolean)
  } catch {
    return [photoUrl]
  }
  return [photoUrl]
}

export default function OwnerMaintenanceTab({ clientId, ownerName }: OwnerMaintenanceTabProps) {
  const { isDark } = useTheme()
  const [requests, setRequests] = useState<MaintenanceRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all')
  const [statusOpen, setStatusOpen] = useState(false)
  const [priorityOpen, setPriorityOpen] = useState(false)
  const statusRef = useRef<HTMLDivElement>(null)
  const priorityRef = useRef<HTMLDivElement>(null)
  const [alertedIds, setAlertedIds] = useState<Set<string>>(new Set())
  const [alertingId, setAlertingId] = useState<string | null>(null)
  const [viewRequest, setViewRequest] = useState<MaintenanceRequest | null>(null)
  const [page, setPage] = useState(1)
  const pageSize = 10

  // ─── Sample/mock maintenance requests connected to 6 apartments ───
  const sampleRequests: MaintenanceRequest[] = [
    { id: 'sm-1', tenant_id: 'sample-t12', unit_id: 'su-2-3', apartmentowner_id: clientId, title: 'Leaking faucet in kitchen', description: 'Kitchen faucet dripping constantly, water bill increasing. Needs immediate plumbing repair.', priority: 'high', status: 'pending', photo_url: 'https://placehold.co/600x400/fef3c7/92400e?text=Leaking+Faucet', created_at: new Date(Date.now() - 1 * 86400000).toISOString(), updated_at: new Date(Date.now() - 1 * 86400000).toISOString(), tenant_name: 'Juan Dela Cruz', apartment_name: 'Apartment 2' },
    { id: 'sm-2', tenant_id: 'sample-t14', unit_id: 'su-2-5', apartmentowner_id: clientId, title: 'Broken door lock - Unit 5', description: 'Main door lock mechanism is jammed and cannot be locked properly. Security concern.', priority: 'urgent', status: 'in_progress', photo_url: 'https://placehold.co/600x400/dbeafe/1e40af?text=Broken+Lock', created_at: new Date(Date.now() - 2 * 86400000).toISOString(), updated_at: new Date(Date.now() - 1 * 86400000).toISOString(), tenant_name: 'Carlos Reyes', apartment_name: 'Apartment 2' },
    { id: 'sm-3', tenant_id: 'sample-t16', unit_id: 'su-2-8', apartmentowner_id: clientId, title: 'AC not working - Unit 8', description: 'Air conditioning unit not cooling. Thermostat shows it is running but emitting warm air.', priority: 'medium', status: 'pending', photo_url: 'https://placehold.co/600x400/fef3c7/92400e?text=AC+Not+Working', created_at: new Date(Date.now() - 2 * 86400000).toISOString(), updated_at: new Date(Date.now() - 2 * 86400000).toISOString(), tenant_name: 'Patricia Villanueva', apartment_name: 'Apartment 2' },
    { id: 'sm-4', tenant_id: 'sample-t4', unit_id: 'su-1-4', apartmentowner_id: clientId, title: 'Clogged drain in bathroom - Unit 3', description: 'Bathroom floor drain is completely clogged. Water backs up during showers.', priority: 'high', status: 'pending', photo_url: 'https://placehold.co/600x400/fef3c7/92400e?text=Clogged+Drain', created_at: new Date(Date.now() - 3 * 86400000).toISOString(), updated_at: new Date(Date.now() - 3 * 86400000).toISOString(), tenant_name: 'Rico Dimaculangan', apartment_name: 'Apartment 1' },
    { id: 'sm-5', tenant_id: 'sample-t1', unit_id: 'su-1-1', apartmentowner_id: clientId, title: 'Flickering lights in hallway - Unit 2', description: 'Hallway ceiling light flickers intermittently. May be a wiring issue.', priority: 'medium', status: 'in_progress', photo_url: null, created_at: new Date(Date.now() - 4 * 86400000).toISOString(), updated_at: new Date(Date.now() - 3 * 86400000).toISOString(), tenant_name: 'Elena Flores', apartment_name: 'Apartment 1' },
    { id: 'sm-6', tenant_id: 'sample-t2', unit_id: 'su-1-2', apartmentowner_id: clientId, title: 'Water heater not working - Unit 6', description: 'Electric water heater stopped working. No hot water available in the bathroom.', priority: 'high', status: 'pending', photo_url: null, created_at: new Date(Date.now() - 5 * 86400000).toISOString(), updated_at: new Date(Date.now() - 5 * 86400000).toISOString(), tenant_name: 'Marco Pascual', apartment_name: 'Apartment 1' },
    { id: 'sm-7', tenant_id: 'sample-t22', unit_id: 'su-3-7', apartmentowner_id: clientId, title: 'Pest control needed - Unit 4', description: 'Cockroach infestation in kitchen area. Tenant requesting immediate pest treatment.', priority: 'medium', status: 'resolved', photo_url: null, created_at: new Date(Date.now() - 5 * 86400000).toISOString(), updated_at: new Date(Date.now() - 2 * 86400000).toISOString(), tenant_name: 'Karl Bautista', apartment_name: 'Apartment 3' },
    { id: 'sm-8', tenant_id: 'sample-t5', unit_id: 'su-1-5', apartmentowner_id: clientId, title: 'Broken window latch - Unit 7', description: 'Window latch in bedroom broken. Window cannot be secured properly.', priority: 'low', status: 'resolved', photo_url: null, created_at: new Date(Date.now() - 6 * 86400000).toISOString(), updated_at: new Date(Date.now() - 3 * 86400000).toISOString(), tenant_name: 'Christine Tan', apartment_name: 'Apartment 1' },
    { id: 'sm-9', tenant_id: 'sample-t24', unit_id: 'su-4-2', apartmentowner_id: clientId, title: 'Leaking pipe in bathroom - Unit 2', description: 'Pipe under bathroom sink is leaking. Water pooling on the floor.', priority: 'high', status: 'pending', photo_url: 'https://placehold.co/600x400/fef3c7/92400e?text=Leaking+Pipe', created_at: new Date(Date.now() - 2 * 86400000).toISOString(), updated_at: new Date(Date.now() - 2 * 86400000).toISOString(), tenant_name: 'Isabella Cruz', apartment_name: 'Apartment 4' },
    { id: 'sm-10', tenant_id: 'sample-t28', unit_id: 'su-5-2', apartmentowner_id: clientId, title: 'Broken cabinet hinge - Unit 2', description: 'Kitchen cabinet door hinge is broken, door hanging loosely.', priority: 'low', status: 'in_progress', photo_url: null, created_at: new Date(Date.now() - 3 * 86400000).toISOString(), updated_at: new Date(Date.now() - 2 * 86400000).toISOString(), tenant_name: 'Rachel Tan', apartment_name: 'Apartment 5' },
    { id: 'sm-11', tenant_id: 'sample-t32', unit_id: 'su-6-1', apartmentowner_id: clientId, title: 'Faulty electrical outlet - Unit 1', description: 'Electrical outlet in living room sparking when used. Potential fire hazard.', priority: 'urgent', status: 'pending', photo_url: 'https://placehold.co/600x400/fef3c7/92400e?text=Faulty+Outlet', created_at: new Date(Date.now() - 4 * 86400000).toISOString(), updated_at: new Date(Date.now() - 4 * 86400000).toISOString(), tenant_name: 'Andrea Navarro', apartment_name: 'Apartment 6' },
    { id: 'sm-12', tenant_id: 'sample-t19', unit_id: 'su-3-3', apartmentowner_id: clientId, title: 'Roof leak during rain - Unit 3', description: 'Water dripping from ceiling in bedroom during heavy rain. Ceiling stain visible.', priority: 'high', status: 'closed', photo_url: 'https://placehold.co/600x400/d1d5db/374151?text=Roof+Leak+Fixed', created_at: new Date(Date.now() - 10 * 86400000).toISOString(), updated_at: new Date(Date.now() - 5 * 86400000).toISOString(), tenant_name: 'Miguel Aquino', apartment_name: 'Apartment 3' },
    { id: 'sm-13', tenant_id: 'sample-t25', unit_id: 'su-4-4', apartmentowner_id: clientId, title: 'Toilet not flushing properly', description: 'Toilet in bathroom not flushing completely. May need plumbing inspection.', priority: 'medium', status: 'pending', photo_url: null, created_at: new Date(Date.now() - 1 * 86400000).toISOString(), updated_at: new Date(Date.now() - 1 * 86400000).toISOString(), tenant_name: 'Lorenzo Reyes', apartment_name: 'Apartment 4' },
    { id: 'sm-14', tenant_id: 'sample-t30', unit_id: 'su-5-5', apartmentowner_id: clientId, title: 'Smoke detector beeping', description: 'Smoke detector in hallway continuously beeping. Battery replacement or unit check needed.', priority: 'low', status: 'resolved', photo_url: null, created_at: new Date(Date.now() - 7 * 86400000).toISOString(), updated_at: new Date(Date.now() - 4 * 86400000).toISOString(), tenant_name: 'Sophia Garcia', apartment_name: 'Apartment 5' },
  ]

  async function loadRequests() {
    try {
      const data = await getOwnerMaintenanceRequests(clientId)
      setRequests([...data, ...sampleRequests])
    } catch (err) {
      console.error('Failed to load maintenance requests:', err)
      setRequests(sampleRequests)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadRequests() }, [clientId])

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (statusRef.current && !statusRef.current.contains(e.target as Node)) setStatusOpen(false)
      if (priorityRef.current && !priorityRef.current.contains(e.target as Node)) setPriorityOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleAlertManager = async (req: MaintenanceRequest) => {
    setAlertingId(req.id)
    try {
      await createOwnerAnnouncement(
        clientId,
        `⚠️ Action Required: ${req.title}`,
        `The owner requests immediate attention on this maintenance issue.\n\nProblem: ${req.title}\nDescription: ${req.description}\nPriority: ${req.priority}\nTenant: ${req.tenant_name || 'Unknown'}\nStatus: ${req.status.replace('_', ' ')}`,
        ownerName || 'Owner'
      )
      setAlertedIds((prev) => new Set([...prev, req.id]))
      toast.success('Manager has been alerted!')
    } catch {
      toast.error('Failed to alert manager')
    } finally {
      setAlertingId(null)
    }
  }

  const filtered = requests.filter((r) => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false
    if (priorityFilter !== 'all' && r.priority !== priorityFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        r.title.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        (r.tenant_name ?? '').toLowerCase().includes(q) ||
        (r.apartment_name ?? '').toLowerCase().includes(q)
      )
    }
    return true
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize)

  useEffect(() => {
    setPage(1)
  }, [search, statusFilter, priorityFilter, requests.length])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const cardClass = `rounded-xl border ${isDark ? 'bg-navy-card border-[#1E293B]' : 'bg-white border-gray-200 shadow-sm'}`

  // Address lookup by apartment name for mock data
  const addressByApartment: Record<string, string> = {
    'Apartment 1': '123 Taft Ave, Malate, Manila',
    'Apartment 2': '456 Vito Cruz St, Paco, Manila',
    'Apartment 3': '789 Jupiter St, Poblacion, Makati',
    'Apartment 4': '321 Katipunan Ave, Loyola Heights, QC',
    'Apartment 5': '555 Shaw Blvd, Wack-Wack, Mandaluyong',
    'Apartment 6': '100 Rizal Ave, Sta. Cruz, Manila',
  }

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Header */}
      <div>
        <h2 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Maintenance Requests</h2>
        <p className={`text-base mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          Monitor maintenance requests from your tenants. The manager handles all actions.
        </p>
      </div>

      {/* Search + Filters on same line */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
          <input
            type="text"
            placeholder="Search by title, tenant, or unit…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`w-full pl-10 pr-4 py-2.5 rounded-lg border text-base transition-colors ${
              isDark
                ? 'bg-[#111D32] border-[#1E293B] text-white placeholder-gray-500 focus:border-primary'
                : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-primary'
            } focus:outline-none`}
          />
        </div>
        {/* Status dropdown */}
        <div className="flex items-center gap-2">
          <span className={`text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Status:</span>
          <div ref={statusRef} className="relative">
            <button
              onClick={() => { setStatusOpen(!statusOpen); setPriorityOpen(false) }}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm border cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50 ${
                isDark
                  ? 'bg-[#111D32] border-[#1E293B] text-white'
                  : 'bg-white border-gray-200 text-gray-900'
              }`}
            >
              {statusFilter === 'all' ? 'All' : statusFilter === 'in_progress' ? 'In Progress' : statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)}
              <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${statusOpen ? 'rotate-180' : ''}`} />
            </button>
            <div
              className={`absolute top-full left-0 mt-1 min-w-[160px] rounded-lg border shadow-lg z-20 overflow-hidden transition-all duration-300 ease-out origin-top ${
                statusOpen
                  ? 'opacity-100 scale-y-100 translate-y-0'
                  : 'opacity-0 scale-y-95 -translate-y-1 pointer-events-none'
              } ${isDark ? 'bg-[#111D32] border-[#1E293B]' : 'bg-white border-gray-200'}`}
            >
              <div className="py-1">
                {STATUSES.map((s) => (
                  <button
                    key={s}
                    onClick={() => { setStatusFilter(s); setStatusOpen(false) }}
                    className={`w-full text-left px-4 py-2.5 text-sm transition-colors duration-200 ${
                      statusFilter === s
                        ? 'bg-primary/10 text-primary font-medium'
                        : isDark
                        ? 'text-gray-300 hover:bg-gray-700'
                        : 'text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {s === 'all' ? 'All' : s === 'in_progress' ? 'In Progress' : s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Priority dropdown */}
        <div className="flex items-center gap-2">
          <span className={`text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Priority:</span>
          <div ref={priorityRef} className="relative">
            <button
              onClick={() => { setPriorityOpen(!priorityOpen); setStatusOpen(false) }}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm border cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50 ${
                isDark
                  ? 'bg-[#111D32] border-[#1E293B] text-white'
                  : 'bg-white border-gray-200 text-gray-900'
              }`}
            >
              {priorityFilter === 'all' ? 'All' : priorityFilter.charAt(0).toUpperCase() + priorityFilter.slice(1)}
              <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${priorityOpen ? 'rotate-180' : ''}`} />
            </button>
            <div
              className={`absolute top-full left-0 mt-1 min-w-[160px] rounded-lg border shadow-lg z-20 overflow-hidden transition-all duration-300 ease-out origin-top ${
                priorityOpen
                  ? 'opacity-100 scale-y-100 translate-y-0'
                  : 'opacity-0 scale-y-95 -translate-y-1 pointer-events-none'
              } ${isDark ? 'bg-[#111D32] border-[#1E293B]' : 'bg-white border-gray-200'}`}
            >
              <div className="py-1">
                {PRIORITIES.map((p) => (
                  <button
                    key={p}
                    onClick={() => { setPriorityFilter(p); setPriorityOpen(false) }}
                    className={`w-full text-left px-4 py-2.5 text-sm transition-colors duration-200 ${
                      priorityFilter === p
                        ? 'bg-primary/10 text-primary font-medium'
                        : isDark
                        ? 'text-gray-300 hover:bg-gray-700'
                        : 'text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {p === 'all' ? 'All' : p.charAt(0).toUpperCase() + p.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <TableSkeleton rows={6} />
      )}

      {/* Table */}
      {!loading && (
        <div className={`${cardClass} overflow-x-auto min-h-[calc(100vh-340px)]`}>
          <table className="w-full text-base table-fixed">
            <thead>
              <tr className={`border-b ${isDark ? 'border-[#1E293B]' : 'border-gray-200'}`}>
                <th className={`w-14 text-center py-3 px-4 font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>No.</th>
                <th className={`w-[18%] text-left py-3 px-4 font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Name</th>
                <th className={`w-[15%] text-left py-3 px-4 font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Branch</th>
                <th className={`w-[28%] text-left py-3 px-4 font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Address</th>
                <th className={`w-[12%] text-center py-3 px-4 font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Status</th>
                <th className={`w-[12%] text-center py-3 px-4 font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Date</th>
                <th className={`w-[8%] text-center py-3 px-4 font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>View</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((r, index) => (
                <tr key={r.id} className={`border-b last:border-0 ${isDark ? 'border-[#1E293B]' : 'border-gray-100'}`}>
                  <td className={`py-3 px-4 text-center ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    {(page - 1) * pageSize + index + 1}
                  </td>
                  <td className={`py-3 px-4 font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {r.tenant_name || '—'}
                  </td>
                  <td className={`py-3 px-4 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{r.apartment_name || '—'}</td>
                  <td className={`py-3 px-4 text-sm break-words ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    {(r.apartment_name && addressByApartment[r.apartment_name]) || '—'}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className={`inline-block px-2.5 py-0.5 text-xs font-medium rounded-full capitalize ${statusColor[r.status] || ''}`}>
                      {r.status === 'in_progress' ? 'In Progress' : r.status}
                    </span>
                  </td>
                  <td className={`py-3 px-4 text-center ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    {new Date(r.created_at).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <button
                      onClick={() => setViewRequest(r)}
                      className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${isDark ? 'text-primary hover:bg-primary/10' : 'text-primary hover:bg-primary/5'}`}
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className={`py-8 text-center ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                    No maintenance requests found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <TablePagination
          currentPage={page}
          totalPages={totalPages}
          totalItems={filtered.length}
          pageSize={pageSize}
          onPageChange={setPage}
          isDark={isDark}
        />
      )}

      {/* Detail Modal */}
      {viewRequest && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setViewRequest(null)}>
          <div
            className={`relative w-full max-w-md mx-4 rounded-xl border p-6 shadow-2xl ${isDark ? 'bg-[#0F1A2E] border-[#1E293B]' : 'bg-white border-gray-200'}`}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setViewRequest(null)}
              className={`absolute top-3 right-3 p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full flex items-center justify-center bg-orange-500/15">
                <Wrench className="w-5 h-5 text-orange-400" />
              </div>
              <div>
                <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Maintenance Details</h3>
                <span className={`inline-block px-2 py-0.5 text-[11px] font-medium rounded-full ${statusColor[viewRequest.status] || ''}`}>
                  {viewRequest.status === 'in_progress' ? 'In Progress' : viewRequest.status}
                </span>
              </div>
            </div>

            <div className={`space-y-3 text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
              <div>
                <p className={`text-xs font-medium mb-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Title</p>
                <p className={isDark ? 'text-white' : 'text-gray-900'}>{viewRequest.title}</p>
              </div>
              <div>
                <p className={`text-xs font-medium mb-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Description</p>
                <p className={isDark ? 'text-white' : 'text-gray-900'}>{viewRequest.description}</p>
              </div>
              <div>
                <p className={`text-xs font-medium mb-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Tenant Name</p>
                <p className={isDark ? 'text-white' : 'text-gray-900'}>{viewRequest.tenant_name || '—'}</p>
              </div>
              {viewRequest.apartment_name && (
                <div>
                  <p className={`text-xs font-medium mb-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Branch</p>
                  <p className={`flex items-center gap-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    <Building2 className="w-3.5 h-3.5" />{viewRequest.apartment_name}
                  </p>
                </div>
              )}
              {viewRequest.apartment_name && addressByApartment[viewRequest.apartment_name] && (
                <div>
                  <p className={`text-xs font-medium mb-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Address</p>
                  <p className={`flex items-center gap-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    <MapPin className="w-3.5 h-3.5" />{addressByApartment[viewRequest.apartment_name]}
                  </p>
                </div>
              )}
              <div>
                <p className={`text-xs font-medium mb-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Priority</p>
                <span className={`inline-block px-2.5 py-0.5 text-xs font-medium rounded-full capitalize ${priorityColor[viewRequest.priority] || ''}`}>
                  {viewRequest.priority}
                </span>
              </div>
              <div>
                <p className={`text-xs font-medium mb-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Date</p>
                <p className={isDark ? 'text-white' : 'text-gray-900'}>{new Date(viewRequest.created_at).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
              </div>
              {(() => {
                const urls = parsePhotoUrls(viewRequest.photo_url)
                return urls.length > 0 ? (
                  <div>
                    <p className={`text-xs font-medium mb-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Photo</p>
                    <div className="flex gap-2">
                      {urls.map((url, i) => (
                        <img
                          key={i}
                          src={url}
                          alt={`Evidence ${i + 1}`}
                          className="w-full max-h-48 object-cover rounded-lg border"
                        />
                      ))}
                    </div>
                  </div>
                ) : null
              })()}

              {/* Alert button — only for pending requests */}
              {viewRequest.status === 'pending' && (
                <div className="pt-2">
                  {alertedIds.has(viewRequest.id) ? (
                    <span className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-500/15 text-emerald-400">
                      <Bell className="w-3.5 h-3.5" />
                      Alert Sent
                    </span>
                  ) : (
                    <button
                      onClick={() => handleAlertManager(viewRequest)}
                      disabled={alertingId === viewRequest.id}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-primary hover:bg-primary/90 text-white transition-colors disabled:opacity-50"
                    >
                      <Bell className="w-3.5 h-3.5" />
                      {alertingId === viewRequest.id ? 'Sending...' : 'Alert Manager'}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
