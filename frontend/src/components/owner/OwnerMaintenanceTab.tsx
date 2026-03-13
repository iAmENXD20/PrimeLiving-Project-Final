import { useEffect, useState, useRef } from 'react'
import { Search, Bell, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'
import { useTheme } from '../../context/ThemeContext'
import {
  getOwnerMaintenanceRequests,
  createOwnerAnnouncement,
  type MaintenanceRequest,
} from '../../lib/ownerApi'

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

  async function loadRequests() {
    try {
      const data = await getOwnerMaintenanceRequests(clientId)
      setRequests(data)
    } catch (err) {
      console.error('Failed to load maintenance requests:', err)
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
        `The owner requests immediate attention on this maintenance issue.\n\nProblem: ${req.title}\nDescription: ${req.description}\nPriority: ${req.priority}\nTenant: ${req.tenant_name || 'Unknown'}\nUnit: ${req.apartment_name || 'Unknown'}\nStatus: ${req.status.replace('_', ' ')}`,
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

  const cardClass = `rounded-xl border ${isDark ? 'bg-navy-card border-[#1E293B]' : 'bg-white border-gray-200 shadow-sm'}`

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Header */}
      <div>
        <h2 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Maintenance Requests</h2>
        <p className={`text-base mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          Monitor maintenance requests from your tenants. The manager handles all actions.
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
        <input
          type="text"
          placeholder="Search by title, description, tenant, or unit…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={`w-full pl-10 pr-4 py-2.5 rounded-lg border text-base transition-colors ${
            isDark
              ? 'bg-[#111D32] border-[#1E293B] text-white placeholder-gray-500 focus:border-primary'
              : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-primary'
          } focus:outline-none`}
        />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
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
        <div className={`text-center py-8 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Loading maintenance requests…</div>
      )}

      {/* Table */}
      {!loading && (
        <div className={`${cardClass} overflow-x-auto min-h-[calc(100vh-340px)]`}>
          <table className="w-full text-base">
            <thead>
              <tr className={`border-b ${isDark ? 'border-[#1E293B]' : 'border-gray-200'}`}>
                {['Title', 'Names', 'Unit', 'Photo', 'Priority', 'Status', 'Date', 'Action'].map((h) => (
                  <th key={h} className={`text-left py-3 px-4 font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className={`border-b last:border-0 ${isDark ? 'border-[#1E293B]' : 'border-gray-100'}`}>
                  <td className="py-3 px-4">
                    <div className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{r.title}</div>
                    <div className={`text-xs mt-0.5 truncate max-w-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{r.description}</div>
                  </td>
                  <td className={`py-3 px-4 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{r.tenant_name || '—'}</td>
                  <td className={`py-3 px-4 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{r.apartment_name || '—'}</td>
                  <td className="py-3 px-4">
                    {(() => {
                      const urls = parsePhotoUrls(r.photo_url)
                      return urls.length > 0 ? (
                        <div className="flex gap-1.5">
                          {urls.map((url, i) => (
                            <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                              <img
                                src={url}
                                alt={`Evidence ${i + 1}`}
                                className="w-10 h-10 object-cover rounded-lg border border-gray-200 dark:border-[#1E293B] hover:opacity-80 transition-opacity"
                              />
                            </a>
                          ))}
                        </div>
                      ) : (
                        <span className={`text-xs ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>—</span>
                      )
                    })()}
                  </td>
                  <td className="py-3 px-4">
                    <span className={`inline-block px-2.5 py-0.5 text-xs font-medium rounded-full capitalize ${priorityColor[r.priority] || ''}`}>
                      {r.priority}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`inline-block px-2.5 py-0.5 text-xs font-medium rounded-full capitalize ${statusColor[r.status] || ''}`}>
                      {r.status === 'in_progress' ? 'In Progress' : r.status}
                    </span>
                  </td>
                  <td className={`py-3 px-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    {new Date(r.created_at).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-4">
                    {(r.status === 'pending' || r.status === 'in_progress') && (
                      alertedIds.has(r.id) ? (
                        <span className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-500/15 text-emerald-400">
                          <Bell className="w-3.5 h-3.5" />
                          Alert Sent
                        </span>
                      ) : (
                        <button
                          onClick={() => handleAlertManager(r)}
                          disabled={alertingId === r.id}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-primary hover:bg-primary/90 text-white transition-colors disabled:opacity-50"
                        >
                          <Bell className="w-3.5 h-3.5" />
                          {alertingId === r.id ? 'Sending...' : 'Alert Manager'}
                        </button>
                      )
                    )}
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
        <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
          Showing {filtered.length} of {requests.length} requests
        </p>
      )}
    </div>
  )
}
