import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { ClipboardList, Filter, X, RefreshCcw, Search, Download, ArrowUp, ArrowDown } from 'lucide-react'
import { useTheme } from '../../context/ThemeContext'
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription'
import { Button } from '@/components/ui/button'
import { TableSkeleton } from '@/components/ui/skeleton'
import TablePagination from '@/components/ui/table-pagination'
import {
  getManagerApartmentLogs,
  type ManagerApartmentLog,
} from '../../lib/managerApi'

interface ManagerApartmentLogsTabProps {
  managerId: string
  managerName: string
  ownerId?: string
}

function formatTimestamp(dateStr: string) {
  const d = new Date(dateStr)
  const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  return { date, time }
}

const FIELD_LABELS: Record<string, string> = {
  move_in_date: 'Move-in Date', lease_start: 'Lease Start', lease_end: 'Lease End',
  contract_duration: 'Duration (months)', rent_deadline: 'Rent Deadline', monthly_rent: 'Monthly Rent',
  apartment_id: 'Apartment', unit_id: 'Unit', tenant_id: 'Tenant',
  first_name: 'First Name', last_name: 'Last Name', email: 'Email', phone: 'Phone',
  status: 'Status', max_occupancy: 'Max Occupancy', updated_at: 'Last Updated',
  created_at: 'Created', contract_status: 'Contract Status', name: 'Name', start_at: 'Start Date',
}

function formatFieldLabel(field: string): string {
  return FIELD_LABELS[field] || field.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ISO_TS_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/

function formatFieldVal(value: string): string {
  if (!value || value === '—') return value
  if (UUID_RE.test(value)) return value.slice(0, 8) + '…'
  if (ISO_TS_RE.test(value)) {
    const d = new Date(value)
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ', ' +
        d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
    }
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const d = new Date(value + 'T00:00:00')
    if (!isNaN(d.getTime())) return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }
  return value
}

function cleanDescription(desc: string): string {
  return desc.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, (m) => m.slice(0, 8) + '…')
}

function formatFieldChanges(log: ManagerApartmentLog): { field: string; from: string; to: string }[] {
  const metadata = log.metadata
  if (!metadata || Object.keys(metadata).length === 0) return []

  if (metadata.changes && typeof metadata.changes === 'object') {
    const changes = metadata.changes as Record<string, { from?: string; to?: string }>
    return Object.entries(changes).map(([field, val]) => ({
      field: formatFieldLabel(field),
      from: formatFieldVal(String(val?.from ?? '—')),
      to: formatFieldVal(String(val?.to ?? '—')),
    }))
  }

  return Object.entries(metadata)
    .filter(([key]) => key !== 'entity_type' && key !== 'entity_id')
    .map(([key, val]) => ({
      field: formatFieldLabel(key),
      from: '',
      to: formatFieldVal(String(val ?? '—')),
    }))
}

export default function ManagerApartmentLogsTab({ managerId, ownerId }: ManagerApartmentLogsTabProps) {
  const { isDark } = useTheme()
  const [logs, setLogs] = useState<ManagerApartmentLog[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const pageSize = 15

  // Filters
  const [filterRole, setFilterRole] = useState('')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  // Detail modal
  const [selectedLog, setSelectedLog] = useState<ManagerApartmentLog | null>(null)
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  useEffect(() => {
    loadLogs()
  }, [managerId])

  // Real-time: auto-refresh when activity logs change
  useRealtimeSubscription(`mgr-logs-${managerId}`, [
    { table: 'apartment_logs', ...(ownerId ? { filter: `apartmentowner_id=eq.${ownerId}` } : {}), onChanged: () => loadLogs() },
  ])

  async function loadLogs() {
    try {
      setLoading(true)
      const data = await getManagerApartmentLogs(managerId)
      setLogs(data)
    } catch (err) {
      console.error('Failed to load logs:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleDownloadExcel() {
    const XLSX = await import('xlsx')
    const sortedAll = [...filtered].sort((a, b) => {
      const numA = parseInt((a.arc_id || '').replace(/\D/g, '')) || 0
      const numB = parseInt((b.arc_id || '').replace(/\D/g, '')) || 0
      return sortOrder === 'asc' ? numA - numB : numB - numA
    })
    const rows = sortedAll.map((log) => {
      const { date, time } = formatTimestamp(log.created_at)
      const changes = formatFieldChanges(log)
      const changesText = changes.map((c) =>
        c.from ? `${c.field}: ${c.from} → ${c.to}` : `${c.field}: ${c.to}`
      ).join('\n')
      return {
        'Archive ID': log.arc_id || '',
        'Role': log.actor_role || '',
        'User Name': log.actor_name || '',
        'Description': cleanDescription(log.description || ''),
        'Field Changes': changesText,
        'Date': date,
        'Time': time,
      }
    })
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Activity Logs')
    XLSX.writeFile(wb, `Management Activity Logs.xlsx`)
  }

  // Apply filters
  const filtered = logs.filter((log) => {
    if (filterRole && log.actor_role !== filterRole) return false
    if (filterDateFrom) {
      const logDate = new Date(log.created_at).toISOString().slice(0, 10)
      if (logDate < filterDateFrom) return false
    }
    if (filterDateTo) {
      const logDate = new Date(log.created_at).toISOString().slice(0, 10)
      if (logDate > filterDateTo) return false
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      if (
        !log.description.toLowerCase().includes(q) &&
        !log.actor_name.toLowerCase().includes(q) &&
        !(log.actor_role && log.actor_role.toLowerCase().includes(q)) &&
        !(log.arc_id && log.arc_id.toLowerCase().includes(q)) &&
        !log.id.toLowerCase().includes(q)
      ) return false
    }
    return true
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const sorted = [...filtered].sort((a, b) => {
    const numA = parseInt((a.arc_id || '').replace(/\D/g, '')) || 0
    const numB = parseInt((b.arc_id || '').replace(/\D/g, '')) || 0
    return sortOrder === 'asc' ? numA - numB : numB - numA
  })
  const paginated = sorted.slice((page - 1) * pageSize, page * pageSize)

  useEffect(() => { setPage(1) }, [filterRole, filterDateFrom, filterDateTo, searchQuery])
  useEffect(() => { if (page > totalPages) setPage(totalPages) }, [page, totalPages])

  const cardClass = `rounded-xl border ${isDark ? 'bg-navy-card border-[#1E293B]' : 'bg-white border-gray-200 shadow-sm'}`
  const inputClass = isDark
    ? 'bg-[#0A1628] border-[#1E293B] text-white'
    : 'bg-gray-50 border-gray-200 text-gray-900'

  const uniqueRoles = [...new Set(logs.map((l) => l.actor_role).filter(Boolean))]

  const ROLE_COLORS: Record<string, string> = {
    owner: isDark ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-blue-50 text-blue-700 border-blue-200',
    manager: isDark ? 'bg-purple-500/20 text-purple-400 border-purple-500/30' : 'bg-purple-50 text-purple-700 border-purple-200',
    tenant: isDark ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-emerald-50 text-emerald-700 border-emerald-200',
    system: isDark ? 'bg-gray-500/20 text-gray-400 border-gray-500/30' : 'bg-gray-100 text-gray-600 border-gray-200',
  }

  return (
    <section className="flex flex-col flex-1 min-h-0 space-y-4">
      {/* Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Activity Logs
          </h3>
          <p className={`text-sm mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            {filtered.length} log entr{filtered.length !== 1 ? 'ies' : 'y'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search logs..."
              className={`pl-9 pr-3 py-2 rounded-lg border text-sm w-56 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50 ${inputClass}`}
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className={showFilters ? 'ring-2 ring-primary' : ''}
          >
            <Filter className="w-4 h-4 mr-1" />
            Filters
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            title={sortOrder === 'asc' ? 'Showing oldest first' : 'Showing newest first'}
          >
            {sortOrder === 'asc' ? <ArrowUp className="w-4 h-4 mr-1" /> : <ArrowDown className="w-4 h-4 mr-1" />}
            {sortOrder === 'asc' ? 'Oldest' : 'Newest'}
          </Button>
          <Button variant="outline" size="sm" onClick={loadLogs} disabled={loading}>
            <RefreshCcw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          {filtered.length > 0 && (
            <Button variant="outline" size="sm" onClick={handleDownloadExcel}>
              <Download className="w-4 h-4 mr-1" />
              Download
            </Button>
          )}
        </div>
      </div>

      {/* Filters Bar */}
      {showFilters && (
        <div className={`${cardClass} p-4 flex flex-wrap gap-4 items-end`}>
          <div className="flex flex-col gap-1">
            <label className={`text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Role</label>
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className={`${inputClass} rounded-lg border px-3 py-2 text-sm min-w-[140px]`}
            >
              <option value="">All Roles</option>
              {uniqueRoles.map((r) => (
                <option key={r} value={r!}>{String(r).charAt(0).toUpperCase() + String(r).slice(1)}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className={`text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Date From</label>
            <input
              type="date"
              value={filterDateFrom}
              onChange={(e) => setFilterDateFrom(e.target.value)}
              className={`${inputClass} rounded-lg border px-3 py-2 text-sm`}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className={`text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Date To</label>
            <input
              type="date"
              value={filterDateTo}
              onChange={(e) => setFilterDateTo(e.target.value)}
              className={`${inputClass} rounded-lg border px-3 py-2 text-sm`}
            />
          </div>
          {(filterRole || filterDateFrom || filterDateTo) && (
            <Button variant="ghost" size="sm" onClick={() => { setFilterRole(''); setFilterDateFrom(''); setFilterDateTo('') }}>
              <X className="w-4 h-4 mr-1" /> Clear Filters
            </Button>
          )}
        </div>
      )}

      {/* Loading */}
      {loading && <TableSkeleton rows={6} />}

      {/* Empty State */}
      {!loading && filtered.length === 0 && (
        <div className={`text-center py-16 rounded-xl border ${isDark ? 'bg-navy-card border-[#1E293B]' : 'bg-white border-gray-200'}`}>
          <ClipboardList className={`w-12 h-12 mx-auto mb-3 ${isDark ? 'text-gray-600' : 'text-gray-300'}`} />
          <p className={`text-lg font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
            No activity logs yet
          </p>
          <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
            Logs will automatically appear here as changes are made in the apartment
          </p>
        </div>
      )}

      {/* Logs Timeline */}
      {!loading && filtered.length > 0 && (
        <div className="flex flex-col flex-1 min-h-0">
          <div className="overflow-auto flex-1 space-y-3 pr-1">
            {paginated.map((log) => {
              const { date, time } = formatTimestamp(log.created_at)
              const roleColor = ROLE_COLORS[log.actor_role] || ROLE_COLORS.system
              const changes = formatFieldChanges(log)
              const accentColor = {
                owner: 'border-l-blue-500',
                manager: 'border-l-purple-500',
                tenant: 'border-l-emerald-500',
                system: 'border-l-gray-500',
              }[log.actor_role] || 'border-l-gray-500'

              return (
                <div
                  key={log.id}
                  onClick={() => setSelectedLog(log)}
                  className={`${cardClass} border-l-4 ${accentColor} p-4 cursor-pointer transition-all ${isDark ? 'hover:bg-[#111D32]/80' : 'hover:shadow-md hover:bg-gray-50/50'}`}
                >
                  {/* Card Header */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className={`font-mono text-xs font-bold ${isDark ? 'text-primary-400' : 'text-primary-700'}`}>{log.arc_id}</span>
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium border capitalize ${roleColor}`}>{log.actor_role}</span>
                      <span className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{log.actor_name}</span>
                    </div>
                    <div className={`text-right shrink-0 ml-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                      <div className="text-xs font-medium">{date}</div>
                      <div className="text-[11px]">{time}</div>
                    </div>
                  </div>

                  {/* Description */}
                  <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{cleanDescription(log.description)}</p>

                  {/* Field Changes */}
                  {changes.length > 0 && (
                    <div className={`flex flex-wrap gap-2 mt-3 pt-3 border-t ${isDark ? 'border-[#1E293B]' : 'border-gray-100'}`}>
                      {changes.map((c, i) => (
                        <div key={i} className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs ${isDark ? 'bg-white/5' : 'bg-gray-50 border border-gray-100'}`}>
                          <span className={`font-semibold ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{c.field}:</span>
                          {c.from && c.from !== '—' ? (
                            <>
                              <span className="line-through text-red-400/80">{c.from}</span>
                              <span className={isDark ? 'text-gray-500' : 'text-gray-400'}>→</span>
                              <span className="text-emerald-400 font-medium">{c.to}</span>
                            </>
                          ) : (
                            <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>{c.to}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          {totalPages > 1 && (
            <div className="mt-3">
              <TablePagination
                currentPage={page}
                totalPages={totalPages}
                totalItems={filtered.length}
                pageSize={pageSize}
                onPageChange={setPage}
                isDark={isDark}
              />
            </div>
          )}
        </div>
      )}

      {/* Log Detail Modal — rendered via portal to cover full screen */}
      {selectedLog && createPortal((() => {
        const { date, time } = formatTimestamp(selectedLog.created_at)
        const changes = formatFieldChanges(selectedLog)
        const roleColor = ROLE_COLORS[selectedLog.actor_role] || ROLE_COLORS.system
        return (
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center animate-in fade-in duration-200"
            onClick={() => setSelectedLog(null)}
          >
            {/* Dark backdrop — full screen, no blur */}
            <div className="absolute inset-0 bg-black/60 animate-in fade-in duration-200" />

            {/* Modal content */}
            <div
              onClick={(e) => e.stopPropagation()}
              className={`relative z-10 w-full max-w-lg mx-4 rounded-xl border shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-4 duration-300 ${isDark ? 'bg-navy-card border-[#1E293B]' : 'bg-white border-gray-200'}`}
            >
              {/* Header */}
              <div className={`flex items-center justify-between px-6 py-4 border-b ${isDark ? 'border-[#1E293B]' : 'border-gray-100'}`}>
                <div className="flex items-center gap-3">
                  <span className={`font-mono text-sm font-bold ${isDark ? 'text-primary-400' : 'text-primary-700'}`}>
                    {selectedLog.arc_id}
                  </span>
                  <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium border capitalize ${roleColor}`}>
                    {selectedLog.actor_role}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedLog(null)}
                  className={`p-1 rounded-lg transition-colors ${isDark ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="px-6 py-5 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={`text-xs font-medium ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Performed By</label>
                    <p className={`mt-1 text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{selectedLog.actor_name}</p>
                  </div>
                  <div>
                    <label className={`text-xs font-medium ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Action</label>
                    <p className={`mt-1 text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                      {selectedLog.action.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                    </p>
                  </div>
                </div>

                <div>
                  <label className={`text-xs font-medium ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Description</label>
                  <p className={`mt-1 text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{cleanDescription(selectedLog.description)}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={`text-xs font-medium ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Date</label>
                    <p className={`mt-1 text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{date}</p>
                  </div>
                  <div>
                    <label className={`text-xs font-medium ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Time</label>
                    <p className={`mt-1 text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{time}</p>
                  </div>
                </div>

                {(selectedLog.entity_type || selectedLog.entity_id) && (
                  <div className="grid grid-cols-2 gap-4">
                    {selectedLog.entity_type && (
                      <div>
                        <label className={`text-xs font-medium ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Entity Type</label>
                        <p className={`mt-1 text-sm capitalize ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{selectedLog.entity_type}</p>
                      </div>
                    )}
                    {selectedLog.entity_id && (
                      <div>
                        <label className={`text-xs font-medium ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Entity ID</label>
                        <p className={`mt-1 text-sm font-mono text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{selectedLog.entity_id}</p>
                      </div>
                    )}
                  </div>
                )}

                {changes.length > 0 && (
                  <div>
                    <label className={`text-xs font-medium ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Field Changes</label>
                    <div className={`mt-2 rounded-lg border divide-y ${isDark ? 'border-[#1E293B] divide-[#1E293B] bg-[#0A1628]' : 'border-gray-200 divide-gray-100 bg-gray-50'}`}>
                      {changes.map((c, i) => (
                        <div key={i} className="px-4 py-2.5 flex items-start gap-3 text-sm">
                          <span className={`font-medium min-w-[100px] ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{c.field}</span>
                          <div className="flex items-center gap-2 flex-1">
                            {c.from ? (
                              <>
                                <span className="line-through text-red-400 text-xs">{c.from}</span>
                                <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>→</span>
                                <span className="text-emerald-400 text-xs font-medium">{c.to}</span>
                              </>
                            ) : (
                              <span className={`text-xs ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{c.to}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className={`px-6 py-4 border-t ${isDark ? 'border-[#1E293B]' : 'border-gray-100'}`}>
                <Button variant="outline" size="sm" onClick={() => setSelectedLog(null)} className="w-full">
                  Close
                </Button>
              </div>
            </div>
          </div>
        )
      })(), document.body)}
    </section>
  )
}
