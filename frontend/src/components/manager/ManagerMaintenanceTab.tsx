import { useEffect, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Search, Filter, ChevronDown, X, ChevronLeft, ChevronRight, Eye, Star } from 'lucide-react'
import { useTheme } from '../../context/ThemeContext'
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription'
import { toast } from 'sonner'
import { getManagerMaintenanceRequests, updateMaintenanceStatus, type MaintenanceRequest } from '../../lib/managerApi'
import ConfirmationModal from '@/components/ui/ConfirmationModal'
import { TableSkeleton } from '@/components/ui/skeleton'
import TablePagination from '@/components/ui/table-pagination'

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

interface ManagerMaintenanceTabProps {
  managerId: string
  ownerId?: string
}

export default function ManagerMaintenanceTab({ managerId, ownerId }: ManagerMaintenanceTabProps) {
  const { isDark } = useTheme()
  const [requests, setRequests] = useState<MaintenanceRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all')
  const [statusOpen, setStatusOpen] = useState(false)
  const [priorityOpen, setPriorityOpen] = useState(false)
  const [photoModalOpen, setPhotoModalOpen] = useState(false)
  const [photoModalUrls, setPhotoModalUrls] = useState<string[]>([])
  const [photoModalIndex, setPhotoModalIndex] = useState(0)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [requestToClose, setRequestToClose] = useState<MaintenanceRequest | null>(null)
  const [selectedRequest, setSelectedRequest] = useState<MaintenanceRequest | null>(null)
  const [statusChangeLoading, setStatusChangeLoading] = useState(false)
  const [page, setPage] = useState(1)
  const pageSize = 10
  const statusRef = useRef<HTMLDivElement>(null)
  const priorityRef = useRef<HTMLDivElement>(null)

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (statusRef.current && !statusRef.current.contains(e.target as Node)) setStatusOpen(false)
      if (priorityRef.current && !priorityRef.current.contains(e.target as Node)) setPriorityOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const openPhotoModal = (urls: string[], index: number) => {
    setPhotoModalUrls(urls)
    setPhotoModalIndex(index)
    setPhotoModalOpen(true)
  }

  const closePhotoModal = () => {
    setPhotoModalOpen(false)
    setPhotoModalUrls([])
    setPhotoModalIndex(0)
  }

  const showPrevPhoto = () => {
    setPhotoModalIndex((prev) => (prev <= 0 ? photoModalUrls.length - 1 : prev - 1))
  }

  const showNextPhoto = () => {
    setPhotoModalIndex((prev) => (prev >= photoModalUrls.length - 1 ? 0 : prev + 1))
  }

  async function loadRequests() {
    try {
      const data = await getManagerMaintenanceRequests(managerId)
      setRequests(data)
    } catch (err) {
      console.error('Failed to load maintenance requests:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRequests()
  }, [managerId])

  // Real-time: auto-refresh when maintenance requests change
  useRealtimeSubscription(`mgr-maintenance-${managerId}`, [
    { table: 'maintenance', ...(ownerId ? { filter: `apartmentowner_id=eq.${ownerId}` } : {}), onChanged: () => loadRequests() },
  ])

  async function performStatusChange(requestId: string, nextStatus: 'in_progress' | 'resolved' | 'closed') {
    try {
      setUpdatingId(requestId)
      await updateMaintenanceStatus(requestId, nextStatus)
      await loadRequests()
      toast.success('Maintenance status updated')
    } catch (error) {
      console.error('Failed to update maintenance status:', error)
      toast.error('Failed to update maintenance status')
    } finally {
      setUpdatingId(null)
    }
  }

  async function handleStatusChange(requestId: string, nextStatus: 'in_progress' | 'resolved' | 'closed') {
    if (nextStatus === 'closed') {
      setRequestToClose(requests.find((request) => request.id === requestId) || null)
      return
    }

    await performStatusChange(requestId, nextStatus)
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
  }, [search, statusFilter, priorityFilter, requests.length])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Header */}
      <div>
        <h2 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
          Maintenance Requests
        </h2>
        <p className={`text-base mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          View and manage maintenance requests from tenants
        </p>
      </div>

      {/* Search + Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="relative flex-1 w-full sm:w-auto sm:max-w-md">
          <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
          <input
            type="text"
            placeholder="Search by title, description, tenant, or apartment…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`w-full pl-10 pr-4 py-2.5 rounded-lg border text-base transition-colors ${
              isDark
                ? 'bg-[#111D32] border-[#1E293B] text-white placeholder-gray-500 focus:border-primary'
                : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-primary'
            } focus:outline-none`}
          />
        </div>

        {/* Status filter */}
        <div className="flex items-center gap-2">
            <Filter className={`w-4 h-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
            <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Status:</span>
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

          {/* Priority filter */}
          <div className="flex items-center gap-2">
            <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Priority:</span>
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

      {/* Requests Table */}
      {!loading && (
        <div
          className={`rounded-xl border overflow-x-auto min-h-[calc(100vh-340px)] ${
            isDark ? 'bg-[#111D32] border-[#1E293B]' : 'bg-white border-gray-200 shadow-sm'
          }`}
        >
          <table className="w-full text-base bg-transparent">
            <thead>
              <tr className={`border-b ${isDark ? 'border-[#1E293B] bg-[#0F1B30]' : 'border-gray-200 bg-white'}`}>
                {['No.', 'Maintenance ID', 'Name', 'Description', 'Priority', 'Status', 'Timestamp', 'View'].map((h) => (
                  <th key={h} className={`text-left py-3 px-4 font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.map((req, idx) => (
                <tr key={req.id} className={`border-b last:border-0 ${isDark ? 'border-[#1E293B] hover:bg-white/[0.02]' : 'border-gray-100 hover:bg-gray-50'}`}>
                  <td className={`py-3 px-4 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                    {(page - 1) * pageSize + idx + 1}
                  </td>
                  <td className={`py-3 px-4 font-mono text-sm font-medium ${isDark ? 'text-primary' : 'text-blue-600'}`}>
                    {req.maintenance_id || '—'}
                  </td>
                  <td className={`py-3 px-4 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{req.tenant_name}</td>
                  <td className="py-3 px-4">
                    <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{req.title}</p>
                    <p className={`text-sm mt-0.5 truncate max-w-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                      {req.description}
                    </p>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`inline-block px-2.5 py-0.5 text-xs font-medium rounded-full ${priorityColor[req.priority] || ''}`}>
                      {req.priority}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`inline-block px-2.5 py-0.5 text-xs font-medium rounded-full ${statusColor[req.status] || ''}`}>
                      {req.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className={`py-3 px-4 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    <div>{new Date(req.created_at).toLocaleDateString()}</div>
                    <div className="text-xs">{new Date(req.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                  </td>
                  <td className="py-3 px-4">
                    <button
                      onClick={() => setSelectedRequest(req)}
                      className="p-1.5 rounded-lg text-primary hover:bg-primary/10 transition-colors"
                      title="View details"
                    >
                      <Eye className="w-4 h-4" />
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

      {/* Summary */}
      {!loading && (
        <TablePagination
          currentPage={page}
          totalPages={totalPages}
          totalItems={filtered.length}
          pageSize={pageSize}
          onPageChange={setPage}
          isDark={isDark}
        />
      )}

      {photoModalOpen && photoModalUrls.length > 0 && createPortal(
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={closePhotoModal} />
          <div className={`relative w-full max-w-3xl rounded-xl border overflow-hidden ${isDark ? 'bg-[#111D32] border-[#1E293B]' : 'bg-white border-gray-200'}`}>
            <div className={`flex items-center justify-between px-4 py-3 border-b ${isDark ? 'border-[#1E293B]' : 'border-gray-200'}`}>
              <p className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Photo {photoModalIndex + 1} of {photoModalUrls.length}
              </p>
              <button onClick={closePhotoModal} className={`p-1.5 rounded-lg ${isDark ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="relative bg-black/80 flex items-center justify-center min-h-[420px]">
              <img
                src={photoModalUrls[photoModalIndex]}
                alt={`Maintenance photo ${photoModalIndex + 1}`}
                className="max-h-[70vh] w-auto object-contain"
              />

              {photoModalUrls.length > 1 && (
                <>
                  <button
                    onClick={showPrevPhoto}
                    className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white hover:bg-black/70"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    onClick={showNextPhoto}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white hover:bg-black/70"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </>
              )}
            </div>

            {photoModalUrls.length > 1 && (
              <div className={`flex gap-2 p-3 overflow-x-auto ${isDark ? 'bg-[#0A1628]' : 'bg-gray-50'}`}>
                {photoModalUrls.map((url, index) => (
                  <button
                    key={`${url}-${index}`}
                    onClick={() => setPhotoModalIndex(index)}
                    className={`rounded-lg overflow-hidden border-2 ${
                      index === photoModalIndex ? 'border-primary' : isDark ? 'border-[#1E293B]' : 'border-gray-200'
                    }`}
                  >
                    <img src={url} alt={`Thumbnail ${index + 1}`} className="w-14 h-14 object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* Maintenance Request Detail Modal */}
      {selectedRequest && createPortal(
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/65 animate-in fade-in duration-200"
          onClick={() => setSelectedRequest(null)}
        >
          <div
            className={`rounded-2xl p-6 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 fade-in duration-200 ${isDark ? 'bg-[#111D32]' : 'bg-white'}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h4 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Maintenance Request Details
              </h4>
              <button onClick={() => setSelectedRequest(null)} className={`p-1 rounded-lg transition-colors ${isDark ? 'hover:bg-white/10' : 'hover:bg-gray-100'}`}>
                <X className={`w-5 h-5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Maintenance ID */}
              <div>
                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Maintenance ID</label>
                <p className={`text-sm font-mono font-medium ${isDark ? 'text-primary' : 'text-blue-600'}`}>{selectedRequest.maintenance_id || '—'}</p>
              </div>

              {/* Title */}
              <div>
                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Title</label>
                <p className={`text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>{selectedRequest.title}</p>
              </div>

              {/* Description */}
              <div>
                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Description</label>
                <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{selectedRequest.description}</p>
              </div>

              {/* Tenant */}
              <div>
                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Tenant</label>
                <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{selectedRequest.tenant_name || '—'}</p>
              </div>

              {/* Branch */}
              <div>
                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Branch</label>
                <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{selectedRequest.apartment_name || '—'}</p>
              </div>

              {/* Priority */}
              <div>
                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Priority</label>
                <span className={`inline-block px-2.5 py-0.5 text-xs font-medium rounded-full ${priorityColor[selectedRequest.priority] || ''}`}>
                  {selectedRequest.priority}
                </span>
              </div>

              {/* Photo */}
              {(() => {
                const urls = parsePhotoUrls(selectedRequest.photo_url)
                return urls.length > 0 ? (
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Photos</label>
                    <div className="flex gap-2 flex-wrap">
                      {urls.map((url, i) => (
                        <button key={i} type="button" onClick={() => { setSelectedRequest(null); openPhotoModal(urls, i) }}>
                          <img
                            src={url}
                            alt={`Evidence ${i + 1}`}
                            className={`w-16 h-16 object-cover rounded-lg border hover:opacity-80 transition-opacity ${isDark ? 'border-[#1E293B]' : 'border-gray-200'}`}
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null
              })()}

              {/* Date */}
              <div>
                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Date Submitted</label>
                <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{new Date(selectedRequest.created_at).toLocaleDateString()}</p>
              </div>

              {/* Status with Change */}
              <div>
                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Status</label>
                <div className="flex items-center gap-3">
                  <span className={`inline-block px-2.5 py-0.5 text-xs font-medium rounded-full ${statusColor[selectedRequest.status] || ''}`}>
                    {selectedRequest.status.replace('_', ' ')}
                  </span>
                </div>
              </div>

              {/* Status Change Buttons */}
              {selectedRequest.status === 'pending' && (
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Update Status</label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={async () => {
                        setStatusChangeLoading(true)
                        await performStatusChange(selectedRequest.id, 'in_progress')
                        setSelectedRequest({ ...selectedRequest, status: 'in_progress' })
                        setStatusChangeLoading(false)
                      }}
                      disabled={statusChangeLoading}
                      className="px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 transition-colors disabled:opacity-50"
                    >
                      Start (In Progress)
                    </button>
                  </div>
                </div>
              )}

              {/* Waiting for tenant */}
              {selectedRequest.status === 'in_progress' && (
                <div className={`rounded-lg border p-3 ${isDark ? 'border-blue-500/30 bg-blue-500/5' : 'border-blue-200 bg-blue-50'}`}>
                  <p className={`text-sm ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>In progress — waiting for tenant to mark as resolved.</p>
                </div>
              )}

              {/* Tenant Review */}
              {selectedRequest.status === 'resolved' && !selectedRequest.review_rating && (
                <div className={`rounded-lg border p-3 ${isDark ? 'border-yellow-500/30 bg-yellow-500/5' : 'border-yellow-200 bg-yellow-50'}`}>
                  <p className={`text-sm ${isDark ? 'text-yellow-400' : 'text-yellow-600'}`}>Waiting for tenant review before closing.</p>
                </div>
              )}
              {selectedRequest.review_rating && (
                <div>
                  <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Tenant Review</label>
                  <div className="flex items-center gap-1 mb-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`w-4 h-4 ${star <= selectedRequest.review_rating! ? 'fill-yellow-400 text-yellow-400' : isDark ? 'text-gray-600' : 'text-gray-300'}`}
                      />
                    ))}
                    <span className={`ml-1.5 text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                      {selectedRequest.review_rating}/5
                    </span>
                  </div>
                  {selectedRequest.review_comment && (
                    <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>"{selectedRequest.review_comment}"</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      <ConfirmationModal
        open={Boolean(requestToClose)}
        isDark={isDark}
        title="Close this maintenance request?"
        description="Use close only for invalid or cancelled requests. For completed work, use Resolve instead."
        confirmText="Close Request"
        loading={Boolean(requestToClose && updatingId === requestToClose.id)}
        onCancel={() => setRequestToClose(null)}
        onConfirm={async () => {
          if (!requestToClose) return
          await performStatusChange(requestToClose.id, 'closed')
          setRequestToClose(null)
        }}
      />
    </div>
  )
}
