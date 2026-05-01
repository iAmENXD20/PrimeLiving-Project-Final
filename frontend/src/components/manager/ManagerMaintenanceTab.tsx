import { useEffect, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Search, Filter, ChevronDown, X, ChevronLeft, ChevronRight, Eye, Star, Wrench, Plus, Pencil, UserCheck, Grid3X3, Trash2 } from 'lucide-react'
import { useTheme } from '../../context/ThemeContext'
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription'
import { toast } from 'sonner'
import {
  getManagerMaintenanceRequests, updateMaintenanceStatus,
  getRepairmen, createRepairman, updateRepairman, deleteRepairman,
  type MaintenanceRequest, type Repairman,
} from '../../lib/managerApi'
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
  in_progress: 'bg-primary-400/15 text-primary-400',
  resolved: 'bg-primary-500/15 text-primary-500',
  closed: 'bg-gray-400/15 text-gray-400',
}

const priorityColor: Record<string, string> = {
  low: 'bg-primary-300/15 text-primary-300',
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
  const [mainTab, setMainTab] = useState<'requests' | 'monitoring' | 'repairmen'>('requests')
  const [requests, setRequests] = useState<MaintenanceRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all')
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all')
  const [statusOpen, setStatusOpen] = useState(false)
  const [priorityOpen, setPriorityOpen] = useState(false)
  const [categoryOpen, setCategoryOpen] = useState(false)
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
  const categoryRef = useRef<HTMLDivElement>(null)

  // Repairmen state
  const [repairmen, setRepairmen] = useState<Repairman[]>([])
  const [repairmenLoading, setRepairmenLoading] = useState(false)
  const [showAddRepairman, setShowAddRepairman] = useState(false)
  const [editingRepairman, setEditingRepairman] = useState<Repairman | null>(null)
  const [repairmanForm, setRepairmanForm] = useState({ name: '', phone: '', specialty: '', notes: '' })
  const [savingRepairman, setSavingRepairman] = useState(false)
  const [repairmanToDeactivate, setRepairmanToDeactivate] = useState<Repairman | null>(null)
  const [assigningRepairman, setAssigningRepairman] = useState(false)
  const [assignDropdownOpen, setAssignDropdownOpen] = useState(false)
  const assignRef = useRef<HTMLDivElement>(null)
  const [specialtyDropdownOpen, setSpecialtyDropdownOpen] = useState(false)
  const specialtyRef = useRef<HTMLDivElement>(null)

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (statusRef.current && !statusRef.current.contains(e.target as Node)) setStatusOpen(false)
      if (priorityRef.current && !priorityRef.current.contains(e.target as Node)) setPriorityOpen(false)
      if (categoryRef.current && !categoryRef.current.contains(e.target as Node)) setCategoryOpen(false)
      if (assignRef.current && !assignRef.current.contains(e.target as Node)) setAssignDropdownOpen(false)
      if (specialtyRef.current && !specialtyRef.current.contains(e.target as Node)) setSpecialtyDropdownOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const loadRepairmen = async () => {
    if (!managerId) return
    setRepairmenLoading(true)
    try {
      const data = await getRepairmen(managerId)
      setRepairmen(data)
    } catch { /* silent */ } finally {
      setRepairmenLoading(false)
    }
  }

  useEffect(() => {
    loadRepairmen()
  }, [managerId])

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
      // Update the selected request detail view if it's the one being changed
      if (selectedRequest?.id === requestId) {
        setSelectedRequest((prev) => prev ? { ...prev, status: nextStatus } : null)
      }
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

  // Repairman helpers
  const handleSaveRepairman = async () => {
    if (!repairmanForm.name.trim()) { toast.error('Name is required'); return }
    if (!ownerId) { toast.error('Owner context missing'); return }
    setSavingRepairman(true)
    try {
      if (editingRepairman) {
        await updateRepairman(editingRepairman.id, {
          name: repairmanForm.name,
          phone: repairmanForm.phone || undefined,
          specialty: repairmanForm.specialty || undefined,
          notes: repairmanForm.notes || undefined,
        })
        toast.success('Repairman updated')
      } else {
        await createRepairman({
          apartmentowner_id: ownerId,
          name: repairmanForm.name,
          phone: repairmanForm.phone || undefined,
          specialty: repairmanForm.specialty || undefined,
          notes: repairmanForm.notes || undefined,
        })
        toast.success('Repairman added')
      }
      await loadRepairmen()
      setShowAddRepairman(false)
      setEditingRepairman(null)
      setRepairmanForm({ name: '', phone: '', specialty: '', notes: '' })
    } catch { toast.error('Failed to save repairman') } finally {
      setSavingRepairman(false)
    }
  }

  const handleDeactivateRepairman = async (r: Repairman) => {
    try {
      await deleteRepairman(r.id)
      toast.success('Repairman deactivated')
      await loadRepairmen()
    } catch { toast.error('Failed to deactivate') } finally {
      setRepairmanToDeactivate(null)
    }
  }

  const handleAssignRepairman = async (repairmanId: string | null) => {
    if (!selectedRequest) return
    setAssigningRepairman(true)
    try {
      await updateMaintenanceStatus(selectedRequest.id, selectedRequest.status, repairmanId)
      setSelectedRequest({ ...selectedRequest, assigned_repairman_id: repairmanId })
      setRequests(prev => prev.map(r => r.id === selectedRequest.id ? { ...r, assigned_repairman_id: repairmanId } : r))
      toast.success(repairmanId ? 'Repairman assigned' : 'Repairman removed')
    } catch { toast.error('Failed to assign repairman') } finally {
      setAssigningRepairman(false)
      setAssignDropdownOpen(false)
    }
  }

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Header */}
      <div>
        <h2 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
          Maintenance
        </h2>
        <p className={`text-base mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          Manage requests, monitor units, and assign repairmen
        </p>
      </div>

      {/* Main Tab Navigation */}
      <div className={`flex gap-1 p-1 rounded-lg w-fit ${isDark ? 'bg-[#0A1628]' : 'bg-gray-100'}`}>
        {([
          { key: 'requests', label: 'Requests', icon: <Wrench className="w-4 h-4" /> },
          { key: 'monitoring', label: 'Monitoring', icon: <Grid3X3 className="w-4 h-4" /> },
          { key: 'repairmen', label: 'Repairmen', icon: <UserCheck className="w-4 h-4" /> },
        ] as const).map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => setMainTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              mainTab === key
                ? 'bg-primary text-white shadow-sm'
                : isDark ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {icon}{label}
          </button>
        ))}
      </div>

      {/* ── REQUESTS TAB ── */}
      {mainTab === 'requests' && (<>
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center flex-wrap">
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

          {/* Category filter */}
          <div className="flex items-center gap-2">
            <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Category:</span>
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
                {['No.', 'Maintenance ID', 'Name', 'Description', 'Category', 'Priority', 'Status', 'Repairman', 'Timestamp', 'View'].map((h) => (
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
                  <td className={`py-3 px-4 font-mono text-sm font-medium ${isDark ? 'text-primary' : 'text-primary-700'}`}>
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
                    <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${isDark ? 'bg-white/5 text-gray-400' : 'bg-gray-100 text-gray-600'}`}>
                      {req.category ? `${CATEGORY_ICONS[req.category] || ''} ${categoryLabel(req.category)}` : '—'}
                    </span>
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
                    {req.assigned_repairman_id
                      ? repairmen.find(r => r.id === req.assigned_repairman_id)?.name || '—'
                      : <span className="italic opacity-50">Unassigned</span>
                    }
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
                  <td colSpan={10} className={`py-8 text-center ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
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
      </>)}

      {/* ── MONITORING TAB ── */}
      {mainTab === 'monitoring' && (
        <div className="space-y-4">
          <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            Overview of maintenance activity per unit/tenant
          </p>
          {loading ? (
            <TableSkeleton rows={5} />
          ) : requests.length === 0 ? (
            <div className={`text-center py-12 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>No maintenance data available</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {Array.from(
                requests.reduce((acc, r) => {
                  const key = r.unit_id || 'unknown'
                  if (!acc.has(key)) acc.set(key, { unit_id: key, apartment_name: r.apartment_name || '—', tenant_name: r.tenant_name || '—', items: [] })
                  acc.get(key)!.items.push(r)
                  return acc
                }, new Map<string, { unit_id: string; apartment_name: string; tenant_name: string; items: MaintenanceRequest[] }>())
                .values()
              ).map((unit) => {
                const pending = unit.items.filter(i => i.status === 'pending').length
                const inProgress = unit.items.filter(i => i.status === 'in_progress').length
                const resolved = unit.items.filter(i => i.status === 'resolved' || i.status === 'closed').length
                const hasUrgent = unit.items.some(i => i.priority === 'urgent' && i.status === 'pending')
                return (
                  <div key={unit.unit_id} className={`rounded-2xl border p-4 ${isDark ? 'bg-[#111D32] border-[#1E293B]' : 'bg-white border-gray-200 shadow-sm'} ${hasUrgent ? 'border-red-500/40' : ''}`}>
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className={`font-semibold text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>{unit.apartment_name}</p>
                        <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{unit.tenant_name}</p>
                      </div>
                      {hasUrgent && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 font-medium">Urgent</span>
                      )}
                    </div>
                    <div className="flex gap-2 flex-wrap text-xs">
                      <span className={`px-2 py-0.5 rounded-full font-medium ${pending > 0 ? 'bg-yellow-500/15 text-yellow-500' : isDark ? 'bg-white/5 text-gray-500' : 'bg-gray-100 text-gray-400'}`}>
                        {pending} Pending
                      </span>
                      <span className={`px-2 py-0.5 rounded-full font-medium ${inProgress > 0 ? 'bg-primary-500/15 text-primary-400' : isDark ? 'bg-white/5 text-gray-500' : 'bg-gray-100 text-gray-400'}`}>
                        {inProgress} In Progress
                      </span>
                      <span className={`px-2 py-0.5 rounded-full font-medium ${isDark ? 'bg-white/5 text-gray-500' : 'bg-gray-100 text-gray-400'}`}>
                        {resolved} Done
                      </span>
                    </div>
                    {unit.items.filter(i => i.status !== 'closed').length > 0 && (
                      <div className="mt-3 space-y-1.5">
                        {unit.items.filter(i => i.status !== 'closed').slice(0, 3).map(item => (
                          <div key={item.id} className={`flex items-center justify-between text-xs rounded-lg px-2 py-1.5 ${isDark ? 'bg-white/5' : 'bg-gray-50'}`}>
                            <span className={`truncate max-w-[160px] ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                              {CATEGORY_ICONS[item.category] || ''} {item.title}
                            </span>
                            <span className={`ml-2 flex-shrink-0 font-medium ${statusColor[item.status]?.split(' ')[1] || ''}`}>
                              {item.status.replace('_', ' ')}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── REPAIRMEN TAB ── */}
      {mainTab === 'repairmen' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              Manage repairmen assigned to maintenance requests
            </p>
            <button
              onClick={() => { setShowAddRepairman(true); setEditingRepairman(null); setRepairmanForm({ name: '', phone: '', specialty: '', notes: '' }) }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              <Plus className="w-4 h-4" /> Add Repairman
            </button>
          </div>

          {/* Add/Edit form */}
          {(showAddRepairman || editingRepairman) && (
            <div className={`rounded-2xl border p-5 space-y-4 ${isDark ? 'bg-[#111D32] border-[#1E293B]' : 'bg-white border-gray-200 shadow-sm'}`}>
              <h4 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {editingRepairman ? 'Edit Repairman' : 'Add New Repairman'}
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Name *</label>
                  <input
                    value={repairmanForm.name}
                    onChange={e => setRepairmanForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Full name"
                    className={`w-full rounded-lg border px-3 py-2 text-sm ${isDark ? 'bg-[#0A1628] border-[#1E293B] text-white placeholder:text-gray-500' : 'bg-gray-50 border-gray-200 text-gray-900'} focus:outline-none focus:ring-2 focus:ring-primary/40`}
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Phone</label>
                  <input
                    value={repairmanForm.phone}
                    onChange={e => setRepairmanForm(f => ({ ...f, phone: e.target.value }))}
                    placeholder="Contact number"
                    className={`w-full rounded-lg border px-3 py-2 text-sm ${isDark ? 'bg-[#0A1628] border-[#1E293B] text-white placeholder:text-gray-500' : 'bg-gray-50 border-gray-200 text-gray-900'} focus:outline-none focus:ring-2 focus:ring-primary/40`}
                  />
                </div>
                <div ref={specialtyRef}>
                  <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Specialty (Category)</label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setSpecialtyDropdownOpen(!specialtyDropdownOpen)}
                      className={`w-full flex items-center justify-between rounded-lg border px-3 py-2 text-sm text-left ${isDark ? 'bg-[#0A1628] border-[#1E293B] text-white' : 'bg-gray-50 border-gray-200 text-gray-900'} focus:outline-none focus:ring-2 focus:ring-primary/40`}
                    >
                      <span className="flex items-center gap-2">
                        {repairmanForm.specialty
                          ? <><span>{CATEGORY_ICONS[repairmanForm.specialty] || ''}</span><span>{categoryLabel(repairmanForm.specialty)}</span></>
                          : <span className={isDark ? 'text-gray-500' : 'text-gray-400'}>Select specialty…</span>
                        }
                      </span>
                      <ChevronDown className={`w-4 h-4 transition-transform ${specialtyDropdownOpen ? 'rotate-180' : ''} ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                    </button>
                    {specialtyDropdownOpen && (
                      <div className={`absolute z-30 left-0 right-0 mt-1 rounded-xl border shadow-lg overflow-hidden ${isDark ? 'bg-[#111D32] border-[#1E293B]' : 'bg-white border-gray-200'}`}>
                        {(['plumbing','electrical','hvac','structural','appliances','pest_control','cleaning','other'] as const).map(cat => (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => { setRepairmanForm(f => ({ ...f, specialty: cat })); setSpecialtyDropdownOpen(false) }}
                            className={`w-full text-left px-3 py-2.5 text-sm flex items-center gap-2.5 transition-colors ${
                              repairmanForm.specialty === cat
                                ? isDark ? 'bg-primary/10 text-primary' : 'bg-primary/5 text-primary'
                                : isDark ? 'text-gray-300 hover:bg-white/5' : 'text-gray-700 hover:bg-gray-50'
                            }`}
                          >
                            <span>{CATEGORY_ICONS[cat]}</span>
                            <span>{categoryLabel(cat)}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Notes</label>
                  <input
                    value={repairmanForm.notes}
                    onChange={e => setRepairmanForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="Optional notes"
                    className={`w-full rounded-lg border px-3 py-2 text-sm ${isDark ? 'bg-[#0A1628] border-[#1E293B] text-white placeholder:text-gray-500' : 'bg-gray-50 border-gray-200 text-gray-900'} focus:outline-none focus:ring-2 focus:ring-primary/40`}
                  />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => { setShowAddRepairman(false); setEditingRepairman(null); setRepairmanForm({ name: '', phone: '', specialty: '', notes: '' }) }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium ${isDark ? 'bg-white/10 text-gray-300 hover:bg-white/15' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'} transition-colors`}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveRepairman}
                  disabled={savingRepairman}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-primary text-white hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {savingRepairman ? 'Saving…' : editingRepairman ? 'Save Changes' : 'Add Repairman'}
                </button>
              </div>
            </div>
          )}

          {/* Repairmen list */}
          {repairmenLoading ? (
            <TableSkeleton rows={3} />
          ) : repairmen.length === 0 ? (
            <div className={`text-center py-12 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>No repairmen added yet</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {repairmen.map(r => (
                <div key={r.id} className={`rounded-2xl border p-4 ${isDark ? 'bg-[#111D32] border-[#1E293B]' : 'bg-white border-gray-200 shadow-sm'} ${!r.is_active ? 'opacity-50' : ''}`}>
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-semibold text-sm ${isDark ? 'bg-primary/15 text-primary' : 'bg-primary-100 text-primary-700'}`}>
                        {r.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className={`font-semibold text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>{r.name}</p>
                        {r.specialty && <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{r.specialty}</p>}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => { setEditingRepairman(r); setShowAddRepairman(false); setRepairmanForm({ name: r.name, phone: r.phone || '', specialty: r.specialty || '', notes: r.notes || '' }) }}
                        className={`p-1.5 rounded-lg ${isDark ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-gray-100 text-gray-500'} transition-colors`}
                        title="Edit"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      {r.is_active && (
                        <button
                          onClick={() => setRepairmanToDeactivate(r)}
                          className={`p-1.5 rounded-lg hover:bg-red-500/10 text-red-400 transition-colors`}
                          title="Deactivate"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  {r.phone && <p className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>📞 {r.phone}</p>}
                  {r.notes && <p className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'} line-clamp-2`}>{r.notes}</p>}
                  <p className={`text-xs mt-2 font-medium ${r.is_active ? 'text-primary-400' : 'text-gray-500'}`}>
                    {r.is_active ? '● Active' : '● Inactive'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
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
            className={`rounded-2xl max-w-xl w-full mx-4 max-h-[92vh] overflow-y-auto animate-in zoom-in-95 fade-in duration-200 ${isDark ? 'bg-[#111D32]' : 'bg-white'} shadow-2xl`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className={`px-6 pt-6 pb-4 border-b ${isDark ? 'border-[#1E293B]' : 'border-gray-100'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className={`font-mono text-xs font-bold px-2.5 py-1 rounded-lg ${isDark ? 'bg-primary/15 text-primary' : 'bg-primary-50 text-primary-600'}`}>
                      {selectedRequest.maintenance_id || 'No ID'}
                    </span>
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-medium rounded-full capitalize ${statusColor[selectedRequest.status] || ''}`}>
                      {selectedRequest.status === 'in_progress' ? 'In Progress' : selectedRequest.status}
                    </span>
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-medium rounded-full capitalize ${priorityColor[selectedRequest.priority] || ''}`}>
                      {selectedRequest.priority}
                    </span>
                    {selectedRequest.category && (
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-medium rounded-full ${isDark ? 'bg-white/8 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>
                        {CATEGORY_ICONS[selectedRequest.category]} {categoryLabel(selectedRequest.category)}
                      </span>
                    )}
                  </div>
                  <h4 className={`text-lg font-semibold leading-snug ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {selectedRequest.title}
                  </h4>
                </div>
                <button onClick={() => setSelectedRequest(null)} className={`p-1.5 rounded-lg transition-colors flex-shrink-0 ${isDark ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}>
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="px-6 py-5 space-y-5">
              {/* Description */}
              <div className={`rounded-xl p-4 ${isDark ? 'bg-[#0A1628]' : 'bg-gray-50'}`}>
                <p className={`text-sm leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  {selectedRequest.description}
                </p>
              </div>

              {/* Info Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className={`rounded-xl p-3 ${isDark ? 'bg-[#0A1628]' : 'bg-gray-50'}`}>
                  <p className={`text-[11px] font-medium uppercase tracking-wide mb-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Tenant</p>
                  <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{selectedRequest.tenant_name || '—'}</p>
                </div>
                <div className={`rounded-xl p-3 ${isDark ? 'bg-[#0A1628]' : 'bg-gray-50'}`}>
                  <p className={`text-[11px] font-medium uppercase tracking-wide mb-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Branch</p>
                  <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{selectedRequest.apartment_name || '—'}</p>
                </div>
                <div className={`rounded-xl p-3 ${isDark ? 'bg-[#0A1628]' : 'bg-gray-50'}`}>
                  <p className={`text-[11px] font-medium uppercase tracking-wide mb-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Submitted</p>
                  <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{new Date(selectedRequest.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                </div>
                <div className={`rounded-xl p-3 ${isDark ? 'bg-[#0A1628]' : 'bg-gray-50'}`}>
                  <p className={`text-[11px] font-medium uppercase tracking-wide mb-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Time</p>
                  <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{new Date(selectedRequest.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              </div>

              {/* Assign Repairman */}
              <div>
                <p className={`text-sm font-semibold mb-2 flex items-center gap-1.5 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  <UserCheck className="w-4 h-4 text-primary" /> Assigned Repairman
                </p>
                <div className="relative" ref={assignRef}>
                  <button
                    onClick={() => setAssignDropdownOpen(!assignDropdownOpen)}
                    disabled={assigningRepairman}
                    className={`flex items-center justify-between gap-2 w-full px-3 py-2.5 rounded-xl border text-sm transition-colors ${
                      isDark ? 'bg-[#0A1628] border-[#1E293B] text-white' : 'bg-gray-50 border-gray-200 text-gray-900'
                    } hover:border-primary/50 focus:outline-none disabled:opacity-50`}
                  >
                    <span className="flex items-center gap-2">
                      {selectedRequest.assigned_repairman_id ? (
                        <>
                          <span className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold ${isDark ? 'bg-primary/20 text-primary' : 'bg-primary-100 text-primary-700'}`}>
                            {(repairmen.find(r => r.id === selectedRequest.assigned_repairman_id)?.name || '?').charAt(0)}
                          </span>
                          {repairmen.find(r => r.id === selectedRequest.assigned_repairman_id)?.name || 'Unknown'}
                        </>
                      ) : (
                        <span className={`italic ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Unassigned</span>
                      )}
                    </span>
                    <ChevronDown className={`w-4 h-4 flex-shrink-0 transition-transform ${assignDropdownOpen ? 'rotate-180' : ''} ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                  </button>
                  {assignDropdownOpen && (
                    <div className={`absolute z-30 left-0 right-0 mt-1 rounded-xl border shadow-lg overflow-hidden ${isDark ? 'bg-[#111D32] border-[#1E293B]' : 'bg-white border-gray-200'}`}>
                      <button
                        onClick={() => handleAssignRepairman(null)}
                        className={`w-full text-left px-3 py-2.5 text-sm ${isDark ? 'text-gray-400 hover:bg-white/5' : 'text-gray-500 hover:bg-gray-50'} italic`}
                      >
                        Remove assignment
                      </button>
                      {repairmen.filter(r => r.is_active).map(r => (
                        <button
                          key={r.id}
                          onClick={() => handleAssignRepairman(r.id)}
                          className={`w-full text-left px-3 py-2.5 text-sm flex items-center gap-2 ${
                            selectedRequest.assigned_repairman_id === r.id
                              ? isDark ? 'bg-primary/10 text-primary' : 'bg-primary/5 text-primary'
                              : isDark ? 'text-white hover:bg-white/5' : 'text-gray-900 hover:bg-gray-50'
                          }`}
                        >
                          <span className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold flex-shrink-0 ${isDark ? 'bg-primary/20 text-primary' : 'bg-primary-100 text-primary-700'}`}>
                            {r.name.charAt(0)}
                          </span>
                          <span className="flex-1">{r.name}</span>
                          {r.specialty && <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{r.specialty}</span>}
                        </button>
                      ))}
                      {repairmen.filter(r => r.is_active).length === 0 && (
                        <p className={`px-3 py-2.5 text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>No active repairmen. Add one in the Repairmen tab.</p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Photos */}
              {(() => {
                const urls = parsePhotoUrls(selectedRequest.photo_url)
                return urls.length > 0 ? (
                  <div>
                    <p className={`text-sm font-semibold mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Photos ({urls.length})</p>
                    <div className="flex gap-2 flex-wrap">
                      {urls.map((url, i) => (
                        <button key={i} type="button" onClick={() => { setSelectedRequest(null); openPhotoModal(urls, i) }} className="relative group">
                          <img
                            src={url}
                            alt={`Evidence ${i + 1}`}
                            className={`w-20 h-20 object-cover rounded-xl border transition-all group-hover:opacity-80 group-hover:scale-105 ${isDark ? 'border-[#1E293B]' : 'border-gray-200'}`}
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null
              })()}

              {/* Status Actions */}
              {selectedRequest.status === 'pending' && (
                <div className={`rounded-xl border p-4 ${isDark ? 'border-primary-500/30 bg-primary-500/5' : 'border-primary-200 bg-primary-50'}`}>
                  <p className={`text-sm mb-3 font-medium ${isDark ? 'text-primary-300' : 'text-primary-700'}`}>Ready to start working on this request?</p>
                  <button
                    onClick={async () => {
                      setStatusChangeLoading(true)
                      await performStatusChange(selectedRequest.id, 'in_progress')
                      setSelectedRequest({ ...selectedRequest, status: 'in_progress' })
                      setStatusChangeLoading(false)
                    }}
                    disabled={statusChangeLoading}
                    className="w-full py-2.5 rounded-lg text-sm font-semibold bg-primary-600 text-white hover:bg-primary-700 transition-colors disabled:opacity-50"
                  >
                    {statusChangeLoading ? 'Updating…' : 'Start — Mark as In Progress'}
                  </button>
                </div>
              )}
              {selectedRequest.status === 'in_progress' && (
                <div className={`rounded-xl border p-4 flex items-center gap-3 ${isDark ? 'border-primary-500/30 bg-primary-500/5' : 'border-primary-200 bg-primary-50'}`}>
                  <div className={`w-2 h-2 rounded-full bg-primary-500 animate-pulse flex-shrink-0`} />
                  <p className={`text-sm ${isDark ? 'text-primary-400' : 'text-primary-600'}`}>In progress — waiting for tenant to mark as resolved.</p>
                </div>
              )}
              {selectedRequest.status === 'resolved' && (
                <div className={`rounded-xl border p-4 space-y-3 ${isDark ? 'border-primary-500/30 bg-primary-500/5' : 'border-primary-200 bg-primary-50'}`}>
                  <p className={`text-sm font-medium ${isDark ? 'text-primary-400' : 'text-primary-700'}`}>✓ Tenant has confirmed this issue is resolved.</p>
                  <button
                    onClick={() => handleStatusChange(selectedRequest.id, 'closed')}
                    className="w-full py-2.5 rounded-lg text-sm font-semibold bg-primary-600 text-white hover:bg-primary-700 transition-colors"
                  >
                    Close Request
                  </button>
                </div>
              )}

              {/* Tenant Review */}
              {selectedRequest.review_rating && (
                <div className={`rounded-xl border p-4 ${isDark ? 'border-yellow-500/20 bg-yellow-500/5' : 'border-yellow-200 bg-yellow-50'}`}>
                  <p className={`text-xs font-semibold uppercase tracking-wide mb-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Tenant Review</p>
                  <div className="flex items-center gap-1 mb-1.5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`w-5 h-5 ${star <= selectedRequest.review_rating! ? 'fill-yellow-400 text-yellow-400' : isDark ? 'text-gray-600' : 'text-gray-300'}`}
                      />
                    ))}
                    <span className={`ml-2 text-sm font-semibold ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                      {selectedRequest.review_rating}/5
                    </span>
                  </div>
                  {selectedRequest.review_comment && (
                    <p className={`text-sm italic ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>"{selectedRequest.review_comment}"</p>
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
        description="This will mark the request as closed. The tenant has confirmed the issue is resolved."
        confirmText="Close Request"
        loading={Boolean(requestToClose && updatingId === requestToClose.id)}
        onCancel={() => setRequestToClose(null)}
        onConfirm={async () => {
          if (!requestToClose) return
          await performStatusChange(requestToClose.id, 'closed')
          setRequestToClose(null)
        }}
      />

      <ConfirmationModal
        open={Boolean(repairmanToDeactivate)}
        isDark={isDark}
        title="Deactivate repairman?"
        description={`"${repairmanToDeactivate?.name}" will be deactivated and removed from new assignments.`}
        confirmText="Deactivate"
        loading={false}
        onCancel={() => setRepairmanToDeactivate(null)}
        onConfirm={() => { if (repairmanToDeactivate) handleDeactivateRepairman(repairmanToDeactivate) }}
      />
    </div>
  )
}
