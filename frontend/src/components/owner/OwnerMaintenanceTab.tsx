import { useEffect, useState, useRef } from 'react'
import { Search, Bell, ChevronDown, X, Building2, Wrench, ChevronLeft, ChevronRight, Star } from 'lucide-react'
import { createPortal } from 'react-dom'
import { toast } from 'sonner'
import { useTheme } from '../../context/ThemeContext'
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription'
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

const CATEGORIES = ['all', 'plumbing', 'electrical', 'hvac', 'structural', 'appliances', 'pest_control', 'cleaning', 'other'] as const
type CategoryFilter = (typeof CATEGORIES)[number]

const CATEGORY_ICONS: Record<string, string> = {
  plumbing: '🔧', electrical: '⚡', hvac: '❄️', structural: '🏗️',
  appliances: '🔌', pest_control: '🐛', cleaning: '🧹', other: '📋',
}

function categoryLabel(c: string) {
  if (c === 'hvac') return 'HVAC'
  if (c === 'pest_control') return 'Pest Control'
  return c.charAt(0).toUpperCase() + c.slice(1)
}

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
  ownerId: string
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

export default function OwnerMaintenanceTab({ ownerId, ownerName }: OwnerMaintenanceTabProps) {
  const { isDark } = useTheme()
  const [requests, setRequests] = useState<MaintenanceRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all')
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all')
  const [statusOpen, setStatusOpen] = useState(false)
  const [priorityOpen, setPriorityOpen] = useState(false)
  const [categoryOpen, setCategoryOpen] = useState(false)
  const statusRef = useRef<HTMLDivElement>(null)
  const priorityRef = useRef<HTMLDivElement>(null)
  const categoryRef = useRef<HTMLDivElement>(null)
  const [alertedIds, setAlertedIds] = useState<Set<string>>(new Set())
  const [alertingId, setAlertingId] = useState<string | null>(null)
  const [viewRequest, setViewRequest] = useState<MaintenanceRequest | null>(null)
  const [photoModalOpen, setPhotoModalOpen] = useState(false)
  const [photoModalUrls, setPhotoModalUrls] = useState<string[]>([])
  const [photoModalIndex, setPhotoModalIndex] = useState(0)
  const [page, setPage] = useState(1)
  const pageSize = 10

  function openPhotoModal(urls: string[], index: number) {
    setPhotoModalUrls(urls)
    setPhotoModalIndex(index)
    setPhotoModalOpen(true)
  }

  async function loadRequests() {
    try {
      const data = await getOwnerMaintenanceRequests(ownerId)
      setRequests(data)
    } catch (err) {
      console.error('Failed to load maintenance requests:', err)
      setRequests([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadRequests() }, [ownerId])

  // Real-time: auto-refresh when maintenance requests change
  useRealtimeSubscription(`owner-maintenance-${ownerId}`, [
    { table: 'maintenance', filter: `apartmentowner_id=eq.${ownerId}`, onChanged: () => loadRequests() },
  ])

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (statusRef.current && !statusRef.current.contains(e.target as Node)) setStatusOpen(false)
      if (priorityRef.current && !priorityRef.current.contains(e.target as Node)) setPriorityOpen(false)
      if (categoryRef.current && !categoryRef.current.contains(e.target as Node)) setCategoryOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleAlertManager = async (req: MaintenanceRequest) => {
    setAlertingId(req.id)
    try {
      await createOwnerAnnouncement(
        ownerId,
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
    if (categoryFilter !== 'all' && r.category !== categoryFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        r.title.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        (r.tenant_name ?? '').toLowerCase().includes(q) ||
        (r.apartment_name ?? '').toLowerCase().includes(q) ||
        (r.maintenance_id ?? '').toLowerCase().includes(q)
      )
    }
    return true
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize)

  useEffect(() => {
    setPage(1)
  }, [search, statusFilter, priorityFilter, categoryFilter, requests.length])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const cardClass = `rounded-xl border ${isDark ? 'bg-navy-card border-[#1E293B]' : 'bg-white border-gray-200 shadow-sm'}`

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Header */}
      <div>
        <h2 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Maintenance Request History</h2>
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

        {/* Category dropdown */}
        <div className="flex items-center gap-2">
          <span className={`text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Category:</span>
          <div ref={categoryRef} className="relative">
            <button
              onClick={() => { setCategoryOpen(!categoryOpen); setStatusOpen(false); setPriorityOpen(false) }}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm border cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50 ${
                isDark ? 'bg-[#111D32] border-[#1E293B] text-white' : 'bg-white border-gray-200 text-gray-900'
              }`}
            >
              {categoryFilter === 'all' ? 'All' : categoryLabel(categoryFilter)}
              <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${categoryOpen ? 'rotate-180' : ''}`} />
            </button>
            <div className={`absolute top-full left-0 mt-1 min-w-[180px] rounded-lg border shadow-lg z-20 overflow-hidden transition-all duration-300 ease-out origin-top ${
              categoryOpen ? 'opacity-100 scale-y-100 translate-y-0' : 'opacity-0 scale-y-95 -translate-y-1 pointer-events-none'
            } ${isDark ? 'bg-[#111D32] border-[#1E293B]' : 'bg-white border-gray-200'}`}>
              <div className="py-1">
                {CATEGORIES.map((c) => (
                  <button
                    key={c}
                    onClick={() => { setCategoryFilter(c); setCategoryOpen(false) }}
                    className={`w-full text-left px-4 py-2.5 text-sm transition-colors duration-200 flex items-center gap-2 ${
                      categoryFilter === c ? 'bg-primary/10 text-primary font-medium' : isDark ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {c !== 'all' && <span>{CATEGORY_ICONS[c]}</span>}
                    {c === 'all' ? 'All' : categoryLabel(c)}
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
          <table className="w-full text-base">
            <thead>
              <tr className={`border-b ${isDark ? 'border-[#1E293B]' : 'border-gray-200'}`}>
                <th className={`w-14 text-center py-3 px-4 font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>No.</th>
                <th className={`text-left py-3 px-4 font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Maintenance ID</th>
                <th className={`text-left py-3 px-4 font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Name</th>
                <th className={`text-left py-3 px-4 font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Description</th>
                <th className={`text-center py-3 px-4 font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Category</th>
                <th className={`text-center py-3 px-4 font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Priority</th>
                <th className={`text-center py-3 px-4 font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Status</th>
                <th className={`text-center py-3 px-4 font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Timestamp</th>
                <th className={`text-center py-3 px-4 font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>View</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((r, index) => (
                <tr key={r.id} className={`border-b last:border-0 ${isDark ? 'border-[#1E293B]' : 'border-gray-100'}`}>
                  <td className={`py-3 px-4 text-center ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    {(page - 1) * pageSize + index + 1}
                  </td>
                  <td className={`py-3 px-4 font-mono text-sm font-medium ${isDark ? 'text-primary' : 'text-blue-600'}`}>
                    {r.maintenance_id || '—'}
                  </td>
                  <td className={`py-3 px-4 font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {r.tenant_name || '—'}
                  </td>
                  <td className={`py-3 px-4 max-w-[200px] ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                    <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{r.title}</p>
                    <p className={`text-sm mt-0.5 truncate ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{r.description}</p>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${isDark ? 'bg-white/5 text-gray-400' : 'bg-gray-100 text-gray-600'}`}>
                      {r.category ? `${CATEGORY_ICONS[r.category] || ''} ${categoryLabel(r.category)}` : '—'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className={`inline-block px-2.5 py-0.5 text-xs font-medium rounded-full capitalize ${priorityColor[r.priority] || ''}`}>
                      {r.priority}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className={`inline-block px-2.5 py-0.5 text-xs font-medium rounded-full capitalize ${statusColor[r.status] || ''}`}>
                      {r.status === 'in_progress' ? 'In Progress' : r.status}
                    </span>
                  </td>
                  <td className={`py-3 px-4 text-center text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    <div>{new Date(r.created_at).toLocaleDateString()}</div>
                    <div className="text-xs">{new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
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
                  <td colSpan={8} className={`py-8 text-center ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
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
                <p className={`text-xs font-medium mb-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Maintenance ID</p>
                <p className={`font-mono font-medium ${isDark ? 'text-primary' : 'text-blue-600'}`}>{viewRequest.maintenance_id || '—'}</p>
              </div>
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
                    <p className={`text-xs font-medium mb-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Photos ({urls.length})</p>
                    <div className="flex gap-2">
                      {urls.map((url, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => { setViewRequest(null); openPhotoModal(urls, i) }}
                        >
                          <img
                            src={url}
                            alt={`Evidence ${i + 1}`}
                            className={`w-20 h-20 object-cover rounded-lg border hover:opacity-80 transition-opacity cursor-pointer ${
                              isDark ? 'border-[#1E293B]' : 'border-gray-200'
                            }`}
                          />
                        </button>
                      ))}
                    </div>
                    <p className={`text-xs mt-1 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>Tap to enlarge</p>
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

              {/* Tenant Review */}
              {viewRequest.status === 'resolved' && !viewRequest.review_rating && (
                <div className={`rounded-lg border p-3 ${isDark ? 'border-yellow-500/30 bg-yellow-500/5' : 'border-yellow-200 bg-yellow-50'}`}>
                  <p className={`text-sm ${isDark ? 'text-yellow-400' : 'text-yellow-600'}`}>Waiting for tenant review before closing.</p>
                </div>
              )}
              {viewRequest.review_rating && (
                <div>
                  <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Tenant Review</label>
                  {/* Repairman rating */}
                  <div className="mb-3">
                    <p className={`text-xs mb-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Repairman</p>
                    <div className="flex items-center gap-1 mb-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`w-4 h-4 ${star <= viewRequest.review_rating! ? 'fill-yellow-400 text-yellow-400' : isDark ? 'text-gray-600' : 'text-gray-300'}`}
                        />
                      ))}
                      <span className={`ml-1.5 text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                        {viewRequest.review_rating}/5
                      </span>
                    </div>
                    {viewRequest.review_comment && (
                      <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>"{viewRequest.review_comment}"</p>
                    )}
                  </div>
                  {/* Service/work rating */}
                  {viewRequest.service_rating && (
                    <div>
                      <p className={`text-xs mb-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Work Done</p>
                      <div className="flex items-center gap-1 mb-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={`w-4 h-4 ${star <= viewRequest.service_rating! ? 'fill-yellow-400 text-yellow-400' : isDark ? 'text-gray-600' : 'text-gray-300'}`}
                          />
                        ))}
                        <span className={`ml-1.5 text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                          {viewRequest.service_rating}/5
                        </span>
                      </div>
                      {viewRequest.service_comment && (
                        <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>"{viewRequest.service_comment}"</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Photo Lightbox Modal */}
      {photoModalOpen && photoModalUrls.length > 0 && createPortal(
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80"
          onClick={() => setPhotoModalOpen(false)}
        >
          <div
            className={`relative flex flex-col items-center max-w-2xl w-full mx-4 rounded-xl p-4 ${isDark ? 'bg-[#0F1A2E]' : 'bg-white'}`}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setPhotoModalOpen(false)}
              className={`absolute top-3 right-3 p-1.5 rounded-lg z-10 ${isDark ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}
            >
              <X className="w-5 h-5" />
            </button>

            <div className="relative w-full flex items-center justify-center min-h-[300px]">
              {photoModalUrls.length > 1 && (
                <button
                  onClick={() => setPhotoModalIndex((prev) => (prev - 1 + photoModalUrls.length) % photoModalUrls.length)}
                  className={`absolute left-2 p-2 rounded-full z-10 ${isDark ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-black/10 hover:bg-black/20 text-gray-900'}`}
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
              )}

              <img
                src={photoModalUrls[photoModalIndex]}
                alt={`Photo ${photoModalIndex + 1}`}
                className="max-h-[70vh] max-w-full object-contain rounded-lg"
              />

              {photoModalUrls.length > 1 && (
                <button
                  onClick={() => setPhotoModalIndex((prev) => (prev + 1) % photoModalUrls.length)}
                  className={`absolute right-2 p-2 rounded-full z-10 ${isDark ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-black/10 hover:bg-black/20 text-gray-900'}`}
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              )}
            </div>

            {photoModalUrls.length > 1 && (
              <div className="flex gap-2 mt-3">
                {photoModalUrls.map((url, i) => (
                  <button
                    key={i}
                    onClick={() => setPhotoModalIndex(i)}
                    className={`w-14 h-14 rounded-lg overflow-hidden border-2 transition-all ${
                      photoModalIndex === i
                        ? 'border-primary ring-2 ring-primary/30'
                        : isDark ? 'border-[#1E293B] opacity-60 hover:opacity-100' : 'border-gray-200 opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img src={url} alt={`Thumb ${i + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}

            <p className={`text-sm mt-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              Photo {photoModalIndex + 1} of {photoModalUrls.length}
            </p>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

