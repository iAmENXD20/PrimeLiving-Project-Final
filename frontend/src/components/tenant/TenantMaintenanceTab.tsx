import { useEffect, useState, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Wrench, X, Camera, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useTheme } from '@/context/ThemeContext'
import {
  getTenantMaintenanceRequests,
  createTenantMaintenanceRequest,
  uploadMaintenancePhoto,
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
  clientId: string | null
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

export default function TenantMaintenanceTab({ tenantId, apartmentId, clientId }: TenantMaintenanceTabProps) {
  const { isDark } = useTheme()
  const [requests, setRequests] = useState<TenantMaintenanceRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const pageSize = 10

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

  const loadRequests = async () => {
    try {
      const data = await getTenantMaintenanceRequests(tenantId)
      setRequests(data)
    } catch (err) {
      console.error('Failed to load maintenance requests:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRequests()
  }, [tenantId])

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
        apartment_id: apartmentId,
        client_id: clientId,
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

  return (
    <div className="animate-fade-up flex flex-col flex-1 min-h-0 gap-4">
      {/* Header */}
      <div>
        <h2 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Maintenance</h2>
        <p className={`text-base mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          Submit and track your maintenance requests
        </p>
      </div>

      {/* Two-column layout */}
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
                  {['Subject', 'Description', 'Photo', 'Priority', 'Status', 'Date'].map((h) => (
                    <th key={h} className={`text-left py-3.5 px-4 font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginatedRequests.map((req) => (
                  <tr
                    key={req.id}
                    className={`border-b last:border-0 transition-colors ${
                      isDark ? 'border-[#1E293B] hover:bg-white/[0.02]' : 'border-gray-100 hover:bg-gray-50'
                    }`}
                  >
                    <td className={`py-3.5 px-4 font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {req.title}
                    </td>
                    <td className={`py-3.5 px-4 max-w-[200px] truncate ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                      {req.description}
                    </td>
                    <td className="py-3.5 px-4">
                      {(() => {
                        const urls = parsePhotoUrls(req.photo_url)
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
                    <td className={`py-3.5 px-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      {new Date(req.created_at).toLocaleDateString()}
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
    </div>
  )
}
