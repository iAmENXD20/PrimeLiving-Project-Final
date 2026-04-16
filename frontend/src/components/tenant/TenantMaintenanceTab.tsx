import { useEffect, useState, useRef, useCallback } from 'react'
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Wrench, X, Camera, ChevronDown, ClipboardList, Search, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useTheme } from '@/context/ThemeContext'
import {
  getTenantMaintenanceRequests,
  createTenantMaintenanceRequest,
  uploadMaintenancePhoto,
  reviewMaintenanceRequest,
  updateMaintenanceStatus,
  type TenantMaintenanceRequest,
} from '@/lib/tenantApi'
import { TableSkeleton } from '@/components/ui/skeleton'
import TablePagination from '@/components/ui/table-pagination'

const MAX_PHOTOS = 4

const requestSchema = z.object({
  title: z.string().min(3, 'Title is required'),
  description: z.string().min(10, 'Please provide a detailed description'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
})

type RequestForm = z.infer<typeof requestSchema>

interface TenantMaintenanceTabProps {
  tenantId: string
  apartmentId: string | null
  ownerId: string | null
}

/** Parse photo_url field — may be a JSON array string or a single URL */
function parsePhotoUrls(photoUrl: string | null | undefined): string[] {
  if (!photoUrl) return []
  try {
    const parsed = JSON.parse(photoUrl)
    if (Array.isArray(parsed)) return parsed.filter(Boolean)
  } catch {
    // Legacy single URL
    return [photoUrl]
  }
  return [photoUrl]
}

export default function TenantMaintenanceTab({ tenantId, apartmentId, ownerId }: TenantMaintenanceTabProps) {
  const { isDark } = useTheme()
  const [requests, setRequests] = useState<TenantMaintenanceRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const pageSize = 10
  const [subTab, setSubTab] = useState<'request' | 'tracking'>('request')
  const [trackingSearch, setTrackingSearch] = useState('')

  // Review state
  const [reviewingId, setReviewingId] = useState<string | null>(null)
  const [reviewRating, setReviewRating] = useState(0)
  const [reviewHover, setReviewHover] = useState(0)
  const [reviewComment, setReviewComment] = useState('')
  const [submittingReview, setSubmittingReview] = useState(false)
  const [resolvingId, setResolvingId] = useState<string | null>(null)

  // 4 photo slots
  const [photos, setPhotos] = useState<(File | null)[]>([null, null, null, null])
  const [previews, setPreviews] = useState<(string | null)[]>([null, null, null, null])
  const fileInputRefs = useRef<(HTMLInputElement | null)[]>([null, null, null, null])

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RequestForm>({
    resolver: zodResolver(requestSchema),
    defaultValues: { priority: 'medium' },
  })

  const selectedPriority = watch('priority')
  const [priorityDropdownOpen, setPriorityDropdownOpen] = useState(false)
  const priorityDropdownRef = useRef<HTMLDivElement>(null)

  const loadRequests = useCallback(async () => {
    try {
      setLoading(true)
      const data = await getTenantMaintenanceRequests(tenantId)
      setRequests(data)
    } catch (err) {
      console.error('Failed to load maintenance requests:', err)
    } finally {
      setLoading(false)
    }
  }, [tenantId])

  useEffect(() => {
    loadRequests()
  }, [loadRequests])

  useRealtimeSubscription(`tenant-maintenance-${tenantId}`, [
    { table: 'maintenance_requests', filter: `tenant_id=eq.${tenantId}`, onChanged: loadRequests },
  ])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (priorityDropdownRef.current && !priorityDropdownRef.current.contains(e.target as Node)) {
        setPriorityDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const onSubmit = async (data: RequestForm) => {
    try {
      const filesToUpload = photos.filter((f): f is File => f !== null)
      let photoUrlValue: string | null = null

      if (filesToUpload.length > 0) {
        toast.info(`Uploading ${filesToUpload.length} photo(s)...`)
        const urls: string[] = []
        for (const file of filesToUpload) {
          const url = await uploadMaintenancePhoto(file, tenantId)
          urls.push(url)
        }
        photoUrlValue = JSON.stringify(urls)
      }

      await createTenantMaintenanceRequest({
        tenant_id: tenantId,
        unit_id: apartmentId,
        apartmentowner_id: ownerId,
        title: data.title,
        description: data.description,
        priority: data.priority,
        photo_url: photoUrlValue,
      })
      toast.success('Maintenance request submitted!')
      reset()
      setPhotos([null, null, null, null])
      setPreviews([null, null, null, null])
      loadRequests()
    } catch {
      toast.error('Failed to submit request')
    }
  }

  const handlePhotoSelect = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Photo must be less than 5MB')
        return
      }
      const newPhotos = [...photos]
      newPhotos[index] = file
      setPhotos(newPhotos)

      const reader = new FileReader()
      reader.onloadend = () => {
        const newPreviews = [...previews]
        newPreviews[index] = reader.result as string
        setPreviews(newPreviews)
      }
      reader.readAsDataURL(file)
    }
  }

  const removePhoto = (index: number) => {
    const newPhotos = [...photos]
    const newPreviews = [...previews]
    newPhotos[index] = null
    newPreviews[index] = null
    setPhotos(newPhotos)
    setPreviews(newPreviews)
    const ref = fileInputRefs.current[index]
    if (ref) ref.value = ''
  }

  const cardClass = `rounded-xl p-6 border ${
    isDark ? 'bg-navy-card border-[#1E293B]' : 'bg-white border-gray-200 shadow-sm'
  }`

  const inputClass = isDark
    ? 'bg-[#0A1628] border-[#1E293B] text-white placeholder:text-gray-500 focus:border-primary'
    : 'bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-primary'

  const labelClass = isDark ? 'text-gray-300' : 'text-gray-700'

  const priorityColor = (p: string) => {
    switch (p) {
      case 'urgent': return 'bg-red-500/15 text-red-400'
      case 'high': return 'bg-orange-500/15 text-orange-400'
      case 'medium': return 'bg-yellow-500/15 text-yellow-400'
      default: return 'bg-green-500/15 text-green-400'
    }
  }

  const totalPages = Math.max(1, Math.ceil(requests.length / pageSize))
  const paginatedRequests = requests.slice((page - 1) * pageSize, page * pageSize)

  useEffect(() => {
    setPage(1)
  }, [requests.length])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const statusSteps = ['pending', 'in_progress', 'resolved', 'closed'] as const
  const statusLabels: Record<string, string> = { pending: 'Pending', in_progress: 'In Progress', resolved: 'Resolved', closed: 'Closed' }

  const filteredTracking = requests.filter((r) => {
    if (!trackingSearch) return true
    const q = trackingSearch.toLowerCase()
    return (
      (r.maintenance_id ?? '').toLowerCase().includes(q) ||
      r.title.toLowerCase().includes(q) ||
      r.description.toLowerCase().includes(q)
    )
  })

  return (
    <div className="animate-fade-up flex flex-col flex-1 min-h-0 gap-4">
      {/* Header */}
      <div>
        <h2 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Maintenance</h2>
        <p className={`text-base mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          Submit and track your maintenance requests
        </p>
      </div>

      {/* Sub-tab Navigation */}
      <div className={`flex gap-1 p-1 rounded-lg w-fit ${isDark ? 'bg-[#0A1628]' : 'bg-gray-100'}`}>
        <button
          onClick={() => setSubTab('request')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            subTab === 'request'
              ? 'bg-primary text-white shadow-sm'
              : isDark ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Wrench className="w-4 h-4" />
          Request Maintenance
        </button>
        <button
          onClick={() => setSubTab('tracking')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            subTab === 'tracking'
              ? 'bg-primary text-white shadow-sm'
              : isDark ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <ClipboardList className="w-4 h-4" />
          Track Status
        </button>
      </div>

      {/* Sub-tab Content */}
      {subTab === 'request' ? (
      <div className="flex-1 flex flex-col lg:flex-row gap-4 min-h-0">
        {/* Left: New Request Form */}
        <div className={`${cardClass} lg:w-[400px] lg:shrink-0 overflow-y-auto`}>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center">
              <Wrench className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                New Maintenance Request
              </h3>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                Describe the issue and we'll handle it
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label className={labelClass}>Subject</Label>
              <Input
                placeholder="e.g. Leaking faucet in kitchen"
                className={inputClass}
                {...register('title')}
              />
              {errors.title && <p className="text-red-500 text-sm">{errors.title.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label className={labelClass}>Description</Label>
              <textarea
                placeholder="Please describe the issue in detail..."
                className={`w-full min-h-[100px] rounded-lg border px-3 py-2 text-sm ${inputClass}`}
                {...register('description')}
              />
              {errors.description && <p className="text-red-500 text-sm">{errors.description.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label className={labelClass}>Priority</Label>
              <div className="relative" ref={priorityDropdownRef}>
                <button
                  type="button"
                  onClick={() => setPriorityDropdownOpen(!priorityDropdownOpen)}
                  className={`w-full appearance-none rounded-lg px-3 py-2 pr-10 text-sm font-medium text-left border transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40 ${inputClass}`}
                >
                  {selectedPriority.charAt(0).toUpperCase() + selectedPriority.slice(1)}
                </button>
                <ChevronDown className={`absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none transition-transform ${priorityDropdownOpen ? 'rotate-180' : ''} ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />

                {priorityDropdownOpen && (
                  <div className={`absolute z-20 w-full mt-1 rounded-lg border shadow-lg overflow-hidden ${
                    isDark ? 'bg-[#111D32] border-[#1E293B]' : 'bg-white border-gray-200'
                  }`}>
                    {[
                      { value: 'low' as const, label: 'Low', dot: 'bg-green-400' },
                      { value: 'medium' as const, label: 'Medium', dot: 'bg-yellow-400' },
                      { value: 'high' as const, label: 'High', dot: 'bg-orange-400' },
                      { value: 'urgent' as const, label: 'Urgent', dot: 'bg-red-400' },
                    ].map((opt) => {
                      const isSelected = selectedPriority === opt.value
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => {
                            setValue('priority', opt.value)
                            setPriorityDropdownOpen(false)
                          }}
                          className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-left transition-colors ${
                            isSelected
                              ? isDark ? 'bg-primary/10 text-primary font-medium' : 'bg-primary/5 text-primary-700 font-medium'
                              : isDark ? 'text-white hover:bg-white/5' : 'text-gray-900 hover:bg-gray-50'
                          }`}
                        >
                          <span className={`w-2 h-2 rounded-full ${opt.dot}`} />
                          {opt.label}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Photo Upload — 4 Containers */}
            <div className="space-y-1.5">
              <Label className={labelClass}>Photo Evidence (optional — up to 4 photos)</Label>
              <div className="grid grid-cols-2 gap-3">
                {Array.from({ length: MAX_PHOTOS }).map((_, i) => (
                  <div key={i} className="relative">
                    <input
                      ref={(el) => { fileInputRefs.current[i] = el }}
                      type="file"
                      accept="image/*"
                      onChange={(e) => handlePhotoSelect(i, e)}
                      className="hidden"
                    />
                    {previews[i] ? (
                      <div className="relative aspect-square">
                        <img
                          src={previews[i]!}
                          alt={`Photo ${i + 1}`}
                          className="w-full h-full object-cover rounded-lg"
                        />
                        <button
                          type="button"
                          onClick={() => removePhoto(i)}
                          className="absolute top-1.5 right-1.5 p-1 rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => fileInputRefs.current[i]?.click()}
                        className={`w-full aspect-square flex flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed transition-colors ${
                          isDark
                            ? 'border-[#1E293B] hover:border-primary/50 text-gray-500 hover:text-gray-300'
                            : 'border-gray-300 hover:border-primary/50 text-gray-400 hover:text-gray-600'
                        }`}
                      >
                        <Camera className="w-5 h-5" />
                        <span className="text-xs font-medium">Photo {i + 1}</span>
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                Max 5MB each. JPG, PNG, or WEBP.
              </p>
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full px-8 py-2.5 bg-primary hover:bg-primary/90 text-white font-semibold rounded-lg"
              >
                {isSubmitting ? 'Submitting...' : 'Submit Request'}
              </Button>
            </div>
          </form>
        </div>

        {/* Right: Your Requests */}
        <div className={`${cardClass} flex-1 flex flex-col min-h-0`}>
          <h3 className={`text-xl font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Your Requests
          </h3>

          {loading && (
            <TableSkeleton rows={6} />
          )}

          <div className="overflow-auto flex-1 min-h-0 flex flex-col">
            {requests.length === 0 && !loading ? (
              <div className={`flex-1 flex items-center justify-center ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                No maintenance requests yet. Submit a request to get started.
              </div>
            ) : (
            <table className="w-full text-base">
              <thead>
                <tr className={`border-b ${isDark ? 'border-[#1E293B]' : 'border-gray-200'}`}>
                  {['No.', 'Maintenance ID', 'Subject', 'Description', 'Priority', 'Status', 'Timestamp', 'Action'].map((h) => (
                    <th key={h} className={`text-left py-3.5 px-4 font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginatedRequests.map((req, idx) => (
                  <tr
                    key={req.id}
                    className={`border-b last:border-0 transition-colors ${
                      isDark ? 'border-[#1E293B] hover:bg-white/[0.02]' : 'border-gray-100 hover:bg-gray-50'
                    }`}
                  >
                    <td className={`py-3.5 px-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      {(page - 1) * pageSize + idx + 1}
                    </td>
                    <td className={`py-3.5 px-4 font-mono text-sm font-medium ${isDark ? 'text-primary' : 'text-blue-600'}`}>
                      {req.maintenance_id || '—'}
                    </td>
                    <td className={`py-3.5 px-4 font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {req.title}
                    </td>
                    <td className={`py-3.5 px-4 max-w-[200px] truncate ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                      {req.description}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`inline-block px-2.5 py-0.5 text-xs font-medium rounded-full ${priorityColor(req.priority)}`}>
                        {req.priority}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-block px-2.5 py-0.5 text-xs font-medium rounded-full ${
                          req.status === 'resolved' || req.status === 'closed'
                            ? 'bg-emerald-500/15 text-emerald-400'
                            : req.status === 'in_progress'
                            ? 'bg-blue-500/15 text-blue-400'
                            : 'bg-yellow-500/15 text-yellow-400'
                        }`}
                      >
                        {req.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className={`py-3.5 px-4 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      <div>{new Date(req.created_at).toLocaleDateString()}</div>
                      <div className="text-xs">{new Date(req.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      {req.status === 'in_progress' && (
                        <button
                          onClick={async () => {
                            try {
                              await updateMaintenanceStatus(req.id, 'resolved')
                              toast.success('Marked as resolved')
                              setRequests(prev => prev.map(r => r.id === req.id ? { ...r, status: 'resolved' } : r))
                            } catch {
                              toast.error('Failed to resolve')
                            }
                          }}
                          className="px-3 py-1 text-xs font-medium rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
                        >
                          Resolve
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            )}
          </div>

          {!loading && (
            <TablePagination
              currentPage={page}
              totalPages={totalPages}
              totalItems={requests.length}
              pageSize={pageSize}
              onPageChange={setPage}
              isDark={isDark}
            />
          )}
        </div>
      </div>
      ) : (
        /* ── Tracking Sub-tab ── */
        <div className="flex-1 flex flex-col min-h-0 gap-4">
          {/* Search */}
          <div className="relative w-full max-w-sm">
            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
            <input
              type="text"
              placeholder="Search by Maintenance ID or title…"
              value={trackingSearch}
              onChange={(e) => setTrackingSearch(e.target.value)}
              className={`w-full pl-9 pr-3 py-2 rounded-lg border text-sm ${
                isDark ? 'bg-[#0A1628] border-[#1E293B] text-white placeholder:text-gray-500' : 'bg-white border-gray-200 text-gray-900 placeholder:text-gray-400'
              }`}
            />
          </div>

          {loading ? (
            <TableSkeleton rows={4} />
          ) : filteredTracking.length === 0 ? (
            <div className={`${cardClass} flex-1 flex items-center justify-center ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
              {requests.length === 0 ? 'No maintenance requests to track.' : 'No matching requests found.'}
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto space-y-4">
              {filteredTracking.map((req) => {
                const currentIdx = statusSteps.indexOf(req.status as typeof statusSteps[number])
                return (
                  <div key={req.id} className={`${cardClass}`}>
                    {/* Request Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-5">
                      <div className="flex items-center gap-3">
                        <span className={`font-mono text-sm font-bold ${isDark ? 'text-primary' : 'text-blue-600'}`}>
                          {req.maintenance_id || '—'}
                        </span>
                        <h4 className={`text-base font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                          {req.title}
                        </h4>
                      </div>
                      <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                        {new Date(req.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        {' · '}
                        {new Date(req.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>

                    <p className={`text-sm mb-5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      {req.description}
                    </p>

                    {/* Progress Map */}
                    <div className="flex items-center gap-0">
                      {statusSteps.map((step, i) => {
                        const isCompleted = i <= currentIdx
                        const isCurrent = i === currentIdx
                        return (
                          <div key={step} className="flex items-center flex-1 last:flex-none">
                            <div className="flex flex-col items-center">
                              <div
                                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                                  isCurrent
                                    ? 'bg-primary text-white ring-4 ring-primary/20'
                                    : isCompleted
                                    ? 'bg-emerald-500 text-white'
                                    : isDark ? 'bg-[#1E293B] text-gray-500' : 'bg-gray-200 text-gray-400'
                                }`}
                              >
                                {isCompleted && !isCurrent ? '✓' : i + 1}
                              </div>
                              <span className={`text-[11px] mt-1.5 font-medium whitespace-nowrap ${
                                isCurrent
                                  ? 'text-primary'
                                  : isCompleted
                                  ? isDark ? 'text-emerald-400' : 'text-emerald-600'
                                  : isDark ? 'text-gray-500' : 'text-gray-400'
                              }`}>
                                {statusLabels[step]}
                              </span>
                            </div>
                            {i < statusSteps.length - 1 && (
                              <div className={`flex-1 h-0.5 mx-2 mt-[-18px] ${
                                i < currentIdx
                                  ? 'bg-emerald-500'
                                  : isDark ? 'bg-[#1E293B]' : 'bg-gray-200'
                              }`} />
                            )}
                          </div>
                        )
                      })}
                    </div>

                    {/* Priority badge */}
                    <div className="mt-4 flex items-center gap-2">
                      <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Priority:</span>
                      <span className={`inline-block px-2 py-0.5 text-[11px] font-medium rounded-full ${priorityColor(req.priority)}`}>
                        {req.priority}
                      </span>
                    </div>

                    {/* Mark as Resolved — only when in_progress */}
                    {req.status === 'in_progress' && (
                      <div className={`mt-5 rounded-lg border p-4 ${isDark ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-emerald-200 bg-emerald-50'}`}>
                        <p className={`text-sm mb-3 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                          Has this issue been fixed? Mark it as resolved to proceed with your review.
                        </p>
                        <Button
                          disabled={resolvingId === req.id}
                          onClick={async () => {
                            setResolvingId(req.id)
                            try {
                              await updateMaintenanceStatus(req.id, 'resolved')
                              toast.success('Marked as resolved! You can now leave a review.')
                              await loadRequests()
                            } catch (err: any) {
                              toast.error(err.message || 'Failed to update status')
                            } finally {
                              setResolvingId(null)
                            }
                          }}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm px-6"
                        >
                          {resolvingId === req.id ? 'Updating...' : 'Mark as Resolved'}
                        </Button>
                      </div>
                    )}

                    {/* Review Section — Show form for resolved, show submitted review for closed */}
                    {req.status === 'resolved' && (
                      <div className={`mt-5 rounded-lg border p-4 ${isDark ? 'border-primary/30 bg-primary/5' : 'border-primary/20 bg-primary/5'}`}>
                        <p className={`text-sm font-semibold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                          How was the service? Leave a review to close this request.
                        </p>
                        <div className="flex items-center gap-1 mb-3">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              type="button"
                              onClick={() => { setReviewingId(req.id); setReviewRating(star) }}
                              onMouseEnter={() => { setReviewingId(req.id); setReviewHover(star) }}
                              onMouseLeave={() => setReviewHover(0)}
                              className="transition-transform hover:scale-110"
                            >
                              <Star
                                className={`w-7 h-7 ${
                                  star <= (reviewingId === req.id ? (reviewHover || reviewRating) : 0)
                                    ? 'fill-yellow-400 text-yellow-400'
                                    : isDark ? 'text-gray-600' : 'text-gray-300'
                                }`}
                              />
                            </button>
                          ))}
                          {reviewingId === req.id && reviewRating > 0 && (
                            <span className={`ml-2 text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                              {reviewRating}/5
                            </span>
                          )}
                        </div>
                        <textarea
                          placeholder="Comment (optional)"
                          value={reviewingId === req.id ? reviewComment : ''}
                          onChange={(e) => { setReviewingId(req.id); setReviewComment(e.target.value) }}
                          rows={2}
                          className={`w-full rounded-lg border px-3 py-2 text-sm mb-3 resize-none ${
                            isDark ? 'bg-[#0A1628] border-[#1E293B] text-white placeholder:text-gray-500' : 'bg-white border-gray-200 text-gray-900 placeholder:text-gray-400'
                          }`}
                        />
                        <Button
                          disabled={submittingReview || !(reviewingId === req.id && reviewRating > 0)}
                          onClick={async () => {
                            if (!reviewRating || reviewingId !== req.id) return
                            setSubmittingReview(true)
                            try {
                              await reviewMaintenanceRequest(req.id, reviewRating, reviewComment || undefined)
                              toast.success('Review submitted! Request is now closed.')
                              setReviewingId(null)
                              setReviewRating(0)
                              setReviewComment('')
                              await loadRequests()
                            } catch (err: any) {
                              toast.error(err.message || 'Failed to submit review')
                            } finally {
                              setSubmittingReview(false)
                            }
                          }}
                          className="bg-primary hover:bg-primary/90 text-white font-semibold text-sm px-6"
                        >
                          {submittingReview ? 'Submitting...' : 'Submit Review'}
                        </Button>
                      </div>
                    )}

                    {req.status === 'closed' && req.review_rating && (
                      <div className={`mt-5 rounded-lg border p-4 ${isDark ? 'border-[#1E293B] bg-[#0A1628]' : 'border-gray-200 bg-gray-50'}`}>
                        <p className={`text-xs font-medium mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Your Review</p>
                        <div className="flex items-center gap-1 mb-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              className={`w-4 h-4 ${star <= req.review_rating! ? 'fill-yellow-400 text-yellow-400' : isDark ? 'text-gray-600' : 'text-gray-300'}`}
                            />
                          ))}
                          <span className={`ml-1.5 text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                            {req.review_rating}/5
                          </span>
                        </div>
                        {req.review_comment && (
                          <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>"{req.review_comment}"</p>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
