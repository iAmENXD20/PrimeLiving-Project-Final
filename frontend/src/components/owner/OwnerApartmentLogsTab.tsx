import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { ClipboardList, Filter, Trash2, X, RefreshCcw, Search } from 'lucide-react'
import { toast } from 'sonner'
import { useTheme } from '../../context/ThemeContext'
import { Button } from '@/components/ui/button'
import ConfirmationModal from '@/components/ui/ConfirmationModal'
import { TableSkeleton } from '@/components/ui/skeleton'
import TablePagination from '@/components/ui/table-pagination'
import {
  getOwnerApartmentLogs,
  clearOwnerApartmentLogs,
  type ApartmentLog,
} from '../../lib/ownerApi'

interface OwnerApartmentLogsTabProps {
  clientId: string
}

function formatTimestamp(dateStr: string) {
  const d = new Date(dateStr)
  const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  return { date, time }
}

function formatFieldChanges(log: ApartmentLog): { field: string; from: string; to: string }[] {
  const metadata = log.metadata
  if (!metadata || Object.keys(metadata).length === 0) return []

  // Structured changes format: { changes: { fieldName: { from, to } } }
  if (metadata.changes && typeof metadata.changes === 'object') {
    const changes = metadata.changes as Record<string, { from?: string; to?: string }>
    return Object.entries(changes).map(([field, val]) => ({
      field,
      from: String(val?.from ?? '—'),
      to: String(val?.to ?? '—'),
    }))
  }

  // Fallback: show any metadata key-value pairs
  return Object.entries(metadata)
    .filter(([key]) => key !== 'entity_type' && key !== 'entity_id')
    .map(([key, val]) => ({
      field: key,
      from: '',
      to: String(val ?? '—'),
    }))
}

export default function OwnerApartmentLogsTab({ clientId }: OwnerApartmentLogsTabProps) {
  const { isDark } = useTheme()
  const [logs, setLogs] = useState<ApartmentLog[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const pageSize = 15

  // Filters
  const [filterRole, setFilterRole] = useState('')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  // Clear all confirmation
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [clearing, setClearing] = useState(false)

  // Detail modal
  const [selectedLog, setSelectedLog] = useState<ApartmentLog | null>(null)

  useEffect(() => {
    loadLogs()
  }, [clientId])

  async function loadLogs() {
    try {
      setLoading(true)
      const data = await getOwnerApartmentLogs(clientId)
      setLogs(data)
    } catch (err) {
      console.error('Failed to load logs:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleClearAll() {
    setClearing(true)
    try {
      await clearOwnerApartmentLogs(clientId)
      setLogs([])
      toast.success('All logs cleared')
    } catch {
      toast.error('Failed to clear logs')
    } finally {
      setClearing(false)
      setShowClearConfirm(false)
    }
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
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize)

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
          <Button variant="outline" size="sm" onClick={loadLogs} disabled={loading}>
            <RefreshCcw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          {logs.length > 0 && (
            <Button variant="destructive" size="sm" onClick={() => setShowClearConfirm(true)}>
              <Trash2 className="w-4 h-4 mr-1" />
              Clear All
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
            Logs will automatically appear here as changes are made in your apartment
          </p>
        </div>
      )}

      {/* Logs Table */}
      {!loading && filtered.length > 0 && (
        <div className={`${cardClass} overflow-hidden flex flex-col flex-1 min-h-0`}>
          <div className="overflow-auto flex-1">
            <table className="w-full text-sm">
              <thead>
                <tr className={isDark ? 'bg-[#0A1628] text-gray-400' : 'bg-gray-50 text-gray-500'}>
                  <th className="text-left px-4 py-3 font-medium">Archive ID</th>
                  <th className="text-left px-4 py-3 font-medium">Role</th>
                  <th className="text-left px-4 py-3 font-medium">User Name</th>
                  <th className="text-left px-4 py-3 font-medium">Field Changes</th>
                  <th className="text-left px-4 py-3 font-medium">Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((log) => {
                  const { date, time } = formatTimestamp(log.created_at)
                  const roleColor = ROLE_COLORS[log.actor_role] || ROLE_COLORS.system
                  const changes = formatFieldChanges(log)
                  return (
                    <tr
                      key={log.id}
                      onClick={() => setSelectedLog(log)}
                      className={`border-t cursor-pointer transition-colors ${isDark ? 'border-[#1E293B] hover:bg-[#111D32]/50' : 'border-gray-100 hover:bg-gray-50/50'}`}
                    >
                      {/* Archive ID */}
                      <td className={`px-4 py-3 font-mono text-xs ${isDark ? 'text-primary-400' : 'text-primary-700'} font-semibold`}>
                        {log.arc_id}
                      </td>

                      {/* Role */}
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium border capitalize ${roleColor}`}>
                          {log.actor_role}
                        </span>
                      </td>

                      {/* User Name */}
                      <td className={`px-4 py-3 ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                        {log.actor_name}
                      </td>

                      {/* Field Changes */}
                      <td className={`px-4 py-3 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                        <div className="text-sm font-medium mb-0.5">{log.description}</div>
                        {changes.length > 0 && (
                          <div className="space-y-0.5 mt-1">
                            {changes.map((c, i) => (
                              <div key={i} className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                <span className="font-medium">{c.field}</span>
                                {c.from ? (
                                  <>: <span className="line-through text-red-400">{c.from}</span> → <span className="text-emerald-400">{c.to}</span></>
                                ) : (
                                  <>: {c.to}</>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </td>

                      {/* Timestamp */}
                      <td className={`px-4 py-3 whitespace-nowrap ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                        <div>{date}</div>
                        <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{time}</div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <TablePagination
              currentPage={page}
              totalPages={totalPages}
              totalItems={filtered.length}
              pageSize={pageSize}
              onPageChange={setPage}
              isDark={isDark}
            />
          )}
        </div>
      )}

      {/* Clear All Confirmation */}
      <ConfirmationModal
        open={showClearConfirm}
        isDark={isDark}
        title="Clear All Logs?"
        description="This will permanently delete all activity logs for this apartment. This action cannot be undone."
        confirmText="Clear All"
        loading={clearing}
        onCancel={() => setShowClearConfirm(false)}
        onConfirm={handleClearAll}
      />

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
                {/* User & Action */}
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

                {/* Description */}
                <div>
                  <label className={`text-xs font-medium ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Description</label>
                  <p className={`mt-1 text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{selectedLog.description}</p>
                </div>

                {/* Timestamp */}
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

                {/* Entity Info */}
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

                {/* Field Changes */}
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
