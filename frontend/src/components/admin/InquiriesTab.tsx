import { Search, Eye, CheckCircle, Clock, ShieldCheck, Ban, Copy, Check, XCircle, Mail, Phone, MessageSquare, Send, Building2, MapPin, Layers, Building, User, Calendar, DoorOpen } from 'lucide-react'
import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { useTheme } from '../../context/ThemeContext'
import { getInquiries, updateInquiryStatus, approveInquiry, type Inquiry } from '../../lib/api'
import { useEmailValidation } from '@/hooks/useEmailValidation'
import { TableSkeleton } from '@/components/ui/skeleton'
import TablePagination from '@/components/ui/table-pagination'

/** Format a Philippine phone number to start with +63 */
function formatPhoneTo63(phone: string): string {
  if (!phone) return ''
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('63')) return `+63 ${digits.slice(2)}`
  if (digits.startsWith('0')) return `+63 ${digits.slice(1)}`
  if (digits.startsWith('9') && digits.length === 10) return `+63 ${digits}`
  return phone
}

const statusConfig: Record<Inquiry['status'], { icon: typeof Clock; bg: string; text: string }> = {
  pending: {
    icon: Clock,
    bg: 'bg-amber-100 dark:bg-yellow-500/15',
    text: 'text-amber-700 dark:text-yellow-500',
  },
  responded: {
    icon: CheckCircle,
    bg: 'bg-blue-100 dark:bg-blue-500/15',
    text: 'text-blue-700 dark:text-blue-400',
  },
  approved: {
    icon: ShieldCheck,
    bg: 'bg-emerald-100 dark:bg-emerald-500/15',
    text: 'text-emerald-700 dark:text-emerald-400',
  },
  cancelled: {
    icon: Ban,
    bg: 'bg-red-100 dark:bg-red-500/15',
    text: 'text-red-700 dark:text-red-400',
  },
}

export default function InquiriesTab() {
  const { isDark } = useTheme()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'pending' | 'history'>('all')
  const [showApproved, setShowApproved] = useState(true)
  const [showCancelled, setShowCancelled] = useState(true)
  const [selectedInquiry, setSelectedInquiry] = useState<Inquiry | null>(null)
  const [inquiries, setInquiries] = useState<Inquiry[]>([])
  const [loading, setLoading] = useState(true)
  const [approving, setApproving] = useState(false)
  const [page, setPage] = useState(1)
  const pageSize = 10

  // Create account form
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [createFormData, setCreateFormData] = useState({ firstName: '', lastName: '', email: '', contactNumber: '' })
  const [createFormErrors, setCreateFormErrors] = useState<Record<string, string>>({})
  const [pendingInquiry, setPendingInquiry] = useState<Inquiry | null>(null)
  const ownerEmailValidation = useEmailValidation(createFormData.email)

  // Credentials modal
  const [showCredentials, setShowCredentials] = useState(false)
  const [credentials, setCredentials] = useState({ email: '', password: '' })
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [emailSending, setEmailSending] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const [emailCooldown, setEmailCooldown] = useState(0)

  useEffect(() => {
    loadInquiries()
  }, [])

  useEffect(() => {
    if (emailCooldown <= 0) return

    const timerId = window.setInterval(() => {
      setEmailCooldown((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)

    return () => window.clearInterval(timerId)
  }, [emailCooldown])

  // Compute counts per status
  const statusCounts = {
    all: inquiries.filter(i => i.status === 'pending').length,
    pending: inquiries.filter(i => i.status === 'pending').length,
    history: inquiries.filter(i => i.status !== 'pending').length,
  }

  async function loadInquiries() {
    try {
      setLoading(true)
      const data = await getInquiries()
      setInquiries(data)
    } catch (err) {
      console.error('Failed to load inquiries:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleMarkResponded(id: string) {
    try {
      const updated = await updateInquiryStatus(id, 'responded')
      setInquiries((prev) => prev.map((i) => (i.id === id ? updated : i)))
      setSelectedInquiry(null)
      toast.success('Inquiry marked as responded')
    } catch (err) {
      console.error('Failed to update inquiry:', err)
      toast.error('Failed to update inquiry')
    }
  }

  function openCreateForm(inquiry: Inquiry) {
    // Pre-fill form from inquiry data
    const nameParts = inquiry.name.trim().split(/\s+/)
    const firstName = nameParts[0] || ''
    const lastName = nameParts.slice(1).join(' ') || ''
    setCreateFormData({
      firstName,
      lastName,
      email: inquiry.email,
      contactNumber: (inquiry.phone || '').replace(/\D/g, '').replace(/^63/, '').replace(/^0/, '').slice(0, 10),
    })
    setCreateFormErrors({})
    setPendingInquiry(inquiry)
    setSelectedInquiry(null)
    setShowCreateForm(true)
  }

  async function handleCreateAccountSubmit() {
    if (!pendingInquiry || approving) return

    // Validate
    const errors: Record<string, string> = {}
    if (!createFormData.firstName.trim()) errors.firstName = 'First name is required'
    if (!createFormData.lastName.trim()) errors.lastName = 'Last name is required'
    if (!createFormData.email.trim()) errors.email = 'Email is required'
    if (!createFormData.contactNumber.trim()) errors.contactNumber = 'Contact number is required'
    if (Object.keys(errors).length > 0) {
      setCreateFormErrors(errors)
      return
    }

    if (!ownerEmailValidation.isValid) {
      setCreateFormErrors((prev) => ({
        ...prev,
        email: ownerEmailValidation.message || 'Email could not be verified',
      }))
      return
    }

    try {
      setApproving(true)
      const fullName = `${createFormData.firstName.trim()} ${createFormData.lastName.trim()}`
      const result = await approveInquiry(pendingInquiry, {
        name: fullName,
        email: createFormData.email.trim(),
        phone: createFormData.contactNumber.trim() ? `+63${createFormData.contactNumber.trim()}` : '',
      })
      setInquiries((prev) => prev.map((i) => (i.id === pendingInquiry.id ? result.inquiry : i)))
      setShowCreateForm(false)
      setPendingInquiry(null)

      // Show credentials/verification modal
      setCredentials({ email: createFormData.email.trim(), password: result.generatedPassword || '' })
      setShowCredentials(true)
      toast.success('Inquiry approved — owner invitation sent for email verification!')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to approve inquiry'
      toast.error(message)
    } finally {
      setApproving(false)
    }
  }

  async function handleCancel(id: string) {
    try {
      const updated = await updateInquiryStatus(id, 'cancelled')
      setInquiries((prev) => prev.map((i) => (i.id === id ? updated : i)))
      setSelectedInquiry(null)
      toast.success('Inquiry cancelled')
    } catch (err) {
      console.error('Failed to cancel inquiry:', err)
      toast.error('Failed to cancel inquiry')
    }
  }

  function copyToClipboard(text: string, field: string) {
    navigator.clipboard.writeText(text)
    setCopiedField(field)
    toast.success(`${field} copied to clipboard`)
    setTimeout(() => setCopiedField(null), 2000)
  }

  const filtered = inquiries.filter((inq) => {
    const matchesSearch =
      inq.name.toLowerCase().includes(search.toLowerCase()) ||
      inq.email.toLowerCase().includes(search.toLowerCase()) ||
      (inq.apartment_classification ?? '').toLowerCase().includes(search.toLowerCase())
    const matchesFilter =
      filter === 'history'
        ? inq.status !== 'pending' && ((showApproved && inq.status === 'approved') || (showCancelled && inq.status === 'cancelled') || (!showApproved && !showCancelled))
        : inq.status === 'pending'
    return matchesSearch && matchesFilter
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize)

  useEffect(() => {
    setPage(1)
  }, [search, filter, showApproved, showCancelled, inquiries.length])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const cardClass = `rounded-xl border ${
    isDark
      ? 'bg-navy-card border-[#1E293B]'
      : 'bg-white border-gray-200 shadow-sm'
  }`

  return (
    <>
    <div className="space-y-6 animate-fade-up flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* Header */}
      <div>
        <h2 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
          Inquiries
        </h2>
        <p className={`text-base mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          View and manage all customer inquiries
        </p>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative max-w-sm flex-1">
          <Search
            className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${
              isDark ? 'text-gray-500' : 'text-gray-400'
            }`}
          />
          <input
            type="text"
            placeholder="Search inquiries..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`w-full pl-10 pr-4 py-3 rounded-lg text-base border focus:outline-none focus:ring-2 focus:ring-primary/50 ${
              isDark
                ? 'bg-[#0A1628] border-[#1E293B] text-white placeholder-gray-500'
                : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'
            }`}
          />
        </div>
        <div className="flex gap-2">
          {(['all', 'pending', 'history'] as const).map((f) => (
            <button
              key={f}
              onClick={() => { setFilter(f); if (f !== 'history') setHistoryFilter('all') }}
              className={`px-4 py-2.5 text-base rounded-lg font-medium capitalize transition-colors flex items-center gap-2 ${
                filter === f
                  ? 'bg-primary/15 text-primary'
                  : isDark
                  ? 'text-gray-400 hover:bg-white/5'
                  : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              {f}
              {f !== 'history' && (
                <span
                  className={`inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 text-xs font-semibold rounded-full ${
                    filter === f
                      ? statusCounts[f] > 0
                        ? 'bg-primary text-white'
                        : 'bg-primary/30 text-primary'
                      : statusCounts[f] > 0
                      ? isDark
                        ? 'bg-white/10 text-gray-300'
                        : 'bg-gray-200 text-gray-600'
                      : isDark
                      ? 'bg-white/5 text-gray-500'
                      : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  {statusCounts[f]}
                </span>
              )}
            </button>
          ))}

          {/* Checkboxes for History */}
          {filter === 'history' && (
            <div className={`flex items-center gap-4 ml-2 pl-2 border-l ${isDark ? 'border-[#1E293B]' : 'border-gray-200'}`}>
              <label className={`flex items-center gap-2 cursor-pointer text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                <input
                  type="checkbox"
                  checked={showApproved}
                  onChange={(e) => setShowApproved(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-emerald-500 focus:ring-emerald-500"
                />
                Approved
              </label>
              <label className={`flex items-center gap-2 cursor-pointer text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                <input
                  type="checkbox"
                  checked={showCancelled}
                  onChange={(e) => setShowCancelled(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-red-500 focus:ring-red-500"
                />
                Cancelled
              </label>
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className={`${cardClass} overflow-hidden flex-1 flex flex-col min-h-0`}>
        <div className="overflow-auto flex-1">
          <table className="w-full text-base table-fixed">
            <colgroup>
              <col className="w-1/6" />
              <col className="w-1/6" />
              <col className="w-1/6" />
              <col className="w-1/6" />
              <col className="w-1/6" />
              <col className="w-1/6" />
            </colgroup>
            <thead className={`sticky top-0 z-10 ${isDark ? 'bg-navy-card' : 'bg-white'}`}>
              <tr className={`border-b ${isDark ? 'border-[#1E293B]' : 'border-gray-200'}`}>
                {['Name', 'Email', 'Contact Number', 'Status', 'Date', 'View'].map((h) => (
                  <th
                    key={h}
                    className={`text-left py-3.5 px-4 font-medium ${
                      isDark ? 'text-gray-400' : 'text-gray-500'
                    }`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody key={filter} className="animate-fade-up">
              {loading && (
                <tr>
                  <td colSpan={6} className="py-3 px-4">
                    <TableSkeleton rows={5} />
                  </td>
                </tr>
              )}
              {!loading && paginated.map((inq) => {
                const config = statusConfig[inq.status]
                return (
                  <tr
                    key={inq.id}
                    className={`border-b last:border-0 transition-colors ${
                      isDark
                        ? 'border-[#1E293B] hover:bg-white/[0.02]'
                        : 'border-gray-100 hover:bg-gray-50'
                    }`}
                  >
                    <td className={`py-3.5 px-4 font-medium truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {inq.name}
                    </td>
                    <td className={`py-3.5 px-4 truncate ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                      {inq.email}
                    </td>
                    <td className={`py-3.5 px-4 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                      {inq.phone ? formatPhoneTo63(inq.phone) : '—'}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-medium rounded-full ${config.bg} ${config.text}`}>
                        <config.icon className="w-3 h-3" />
                        {inq.status}
                      </span>
                    </td>
                    <td className={`py-3.5 px-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      {new Date(inq.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3.5 px-4">
                      <button
                        onClick={() => setSelectedInquiry(inq)}
                        className={`p-1.5 rounded-lg transition-colors ${
                          isDark ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-gray-100 text-gray-500'
                        }`}
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                )
              })}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className={`py-8 text-center ${isDark ? 'text-gray-500' : 'text-gray-400'}`}
                  >
                    No inquiries found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

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
    </div>

      {/* Detail Modal */}
      {selectedInquiry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 animate-in fade-in duration-200">
          <div
            className={`w-full max-w-lg mx-4 rounded-2xl border overflow-hidden animate-in zoom-in-95 fade-in duration-200 ${
              isDark
                ? 'bg-[#111D32] border-[#1E293B]'
                : 'bg-white border-gray-200 shadow-2xl'
            }`}
          >
            {/* Header */}
            <div className={`px-6 pt-8 pb-5 ${isDark ? 'bg-gradient-to-b from-primary/10 to-transparent' : 'bg-gradient-to-b from-primary/5 to-transparent'}`}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center text-base font-bold ${isDark ? 'bg-primary/20 text-primary' : 'bg-primary/10 text-primary'}`}>
                    {selectedInquiry.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {selectedInquiry.name}
                    </h3>
                    <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                      {new Date(selectedInquiry.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {(() => {
                    const StatusIcon = statusConfig[selectedInquiry.status].icon
                    return (
                      <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${statusConfig[selectedInquiry.status].bg} ${statusConfig[selectedInquiry.status].text}`}>
                        <StatusIcon className="w-3 h-3" />
                        {selectedInquiry.status}
                      </span>
                    )
                  })()}
                  <button
                    onClick={() => setSelectedInquiry(null)}
                    className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-gray-100 text-gray-400'}`}
                  >
                    <XCircle className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="px-6 pb-5 space-y-5 max-h-[60vh] overflow-y-auto">
              {/* Contact Information */}
              <div>
                <p className={`text-xs font-semibold uppercase tracking-wider mb-3 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Contact Information</p>
                <div className={`rounded-xl divide-y ${isDark ? 'bg-[#0A1628] border border-[#1E293B] divide-[#1E293B]' : 'bg-gray-50 border border-gray-100 divide-gray-100'}`}>
                  <div className="flex items-center gap-3 px-4 py-3">
                    <Mail className={`w-4 h-4 shrink-0 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                    <div className="min-w-0 flex-1">
                      <p className={`text-xs font-medium ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Email</p>
                      <p className={`text-sm truncate ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{selectedInquiry.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 px-4 py-3">
                    <Phone className={`w-4 h-4 shrink-0 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                    <div className="min-w-0 flex-1">
                      <p className={`text-xs font-medium ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Contact Number</p>
                      <p className={`text-sm ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{selectedInquiry.phone ? formatPhoneTo63(selectedInquiry.phone) : '—'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 px-4 py-3">
                    <User className={`w-4 h-4 shrink-0 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                    <div className="min-w-0 flex-1">
                      <p className={`text-xs font-medium ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Sex</p>
                      <p className={`text-sm ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{selectedInquiry.sex || '—'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 px-4 py-3">
                    <Calendar className={`w-4 h-4 shrink-0 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                    <div className="min-w-0 flex-1">
                      <p className={`text-xs font-medium ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Age</p>
                      <p className={`text-sm ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{selectedInquiry.age || '—'}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Property Information */}
              {(() => {
                const classification = selectedInquiry.apartment_classification || null
                const location = [
                  selectedInquiry.street_building,
                  selectedInquiry.barangay,
                  selectedInquiry.city_municipality,
                  selectedInquiry.province,
                ].filter(Boolean).join(', ') || null

                const propertySpecs = [
                  { label: 'Units', value: selectedInquiry.number_of_units, icon: Layers },
                  { label: classification === 'Townhouse' ? 'Residential Units' : 'Floors', value: selectedInquiry.number_of_floors, icon: Building },
                  { label: 'Rooms', value: selectedInquiry.number_of_rooms, icon: DoorOpen },
                  { label: 'Other Details', value: selectedInquiry.other_property_details, icon: MessageSquare },
                ].filter(item => item.value)

                return (
                  <div>
                    <p className={`text-xs font-semibold uppercase tracking-wider mb-3 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Property Information</p>
                    <div className={`rounded-xl divide-y ${isDark ? 'bg-[#0A1628] border border-[#1E293B] divide-[#1E293B]' : 'bg-gray-50 border border-gray-100 divide-gray-100'}`}>
                      <div className="flex items-center gap-3 px-4 py-3">
                        <Building2 className={`w-4 h-4 shrink-0 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                        <div className="min-w-0 flex-1">
                          <p className={`text-xs font-medium ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Classification</p>
                          <p className={`text-sm ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{classification || '—'}</p>
                        </div>
                      </div>
                      {propertySpecs.map(({ label, value, icon: Icon }) => (
                        <div key={label} className="flex items-center gap-3 px-4 py-3">
                          <Icon className={`w-4 h-4 shrink-0 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                          <div className="min-w-0 flex-1">
                            <p className={`text-xs font-medium ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{label}</p>
                            <p className={`text-sm ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{value}</p>
                          </div>
                        </div>
                      ))}
                      {location && (
                        <div className="flex items-start gap-3 px-4 py-3">
                          <MapPin className={`w-4 h-4 shrink-0 mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                          <div className="min-w-0 flex-1">
                            <p className={`text-xs font-medium ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Location</p>
                            <p className={`text-sm leading-relaxed ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{location}</p>
                          </div>
                        </div>
                      )}
                      {!location && propertySpecs.length === 0 && !classification && (
                        <div className="flex items-center gap-3 px-4 py-3">
                          <MessageSquare className={`w-4 h-4 shrink-0 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                          <div className="min-w-0 flex-1">
                            <p className={`text-xs font-medium ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>No Details</p>
                            <p className={`text-sm leading-relaxed ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>—</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })()}
            </div>

            {/* Footer */}
            {selectedInquiry.status === 'pending' && (
              <div className={`px-6 py-4 border-t flex gap-3 justify-end ${isDark ? 'border-[#1E293B] bg-[#0D1526]' : 'border-gray-100 bg-gray-50/50'}`}>
                <button
                  onClick={() => handleCancel(selectedInquiry.id)}
                  className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                    isDark
                      ? 'bg-red-500/15 text-red-400 hover:bg-red-500/25 border border-red-500/30'
                      : 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200'
                  }`}
                >
                  Reject
                </button>
                <button
                  onClick={() => openCreateForm(selectedInquiry)}
                  className="px-5 py-2.5 rounded-lg text-sm font-semibold bg-primary hover:bg-primary-600 text-white transition-all"
                >
                  Approved
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      {/* Create Owner Account Form Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/65 animate-in fade-in duration-200" onClick={() => { setShowCreateForm(false); setPendingInquiry(null) }} />
          <div className={`relative w-full max-w-md mx-4 rounded-2xl border overflow-hidden animate-in zoom-in-95 fade-in duration-200 ${isDark ? 'bg-[#111D32] border-[#1E293B]' : 'bg-white border-gray-200 shadow-2xl'}`}>
            {/* Header */}
            <div className={`px-6 py-5 border-b ${isDark ? 'border-[#1E293B]' : 'border-gray-100'}`}>
              <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Create Owner Account
              </h3>
              <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                Fill in the owner's details to create their account
              </p>
            </div>

            {/* Form */}
            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    First Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={createFormData.firstName}
                    onChange={(e) => {
                      setCreateFormData(prev => ({ ...prev, firstName: e.target.value }))
                      setCreateFormErrors(prev => { const n = { ...prev }; delete n.firstName; return n })
                    }}
                    className={`w-full px-3 py-2.5 rounded-lg border text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50 ${
                      createFormErrors.firstName
                        ? 'border-red-500'
                        : isDark
                        ? 'bg-[#0A1628] border-[#1E293B] text-white placeholder-gray-500'
                        : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'
                    }`}
                    placeholder="Juan"
                  />
                  {createFormErrors.firstName && <p className="text-xs text-red-500 mt-1">{createFormErrors.firstName}</p>}
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    Last Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={createFormData.lastName}
                    onChange={(e) => {
                      setCreateFormData(prev => ({ ...prev, lastName: e.target.value }))
                      setCreateFormErrors(prev => { const n = { ...prev }; delete n.lastName; return n })
                    }}
                    className={`w-full px-3 py-2.5 rounded-lg border text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50 ${
                      createFormErrors.lastName
                        ? 'border-red-500'
                        : isDark
                        ? 'bg-[#0A1628] border-[#1E293B] text-white placeholder-gray-500'
                        : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'
                    }`}
                    placeholder="Dela Cruz"
                  />
                  {createFormErrors.lastName && <p className="text-xs text-red-500 mt-1">{createFormErrors.lastName}</p>}
                </div>
              </div>

              <div>
                <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={createFormData.email}
                  onChange={(e) => {
                    setCreateFormData(prev => ({ ...prev, email: e.target.value }))
                    setCreateFormErrors(prev => { const n = { ...prev }; delete n.email; return n })
                  }}
                  className={`w-full px-3 py-2.5 rounded-lg border text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50 ${
                    createFormErrors.email
                      ? 'border-red-500'
                      : isDark
                      ? 'bg-[#0A1628] border-[#1E293B] text-white placeholder-gray-500'
                      : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'
                  }`}
                  placeholder="juandelacruz@gmail.com"
                />
                {createFormErrors.email && <p className="text-xs text-red-500 mt-1">{createFormErrors.email}</p>}
                {!createFormErrors.email && createFormData.email.trim() && (
                  <p
                    className={`text-xs mt-1 ${
                      ownerEmailValidation.isValid
                        ? 'text-emerald-500'
                        : ownerEmailValidation.isInvalid
                        ? 'text-red-500'
                        : isDark
                        ? 'text-gray-400'
                        : 'text-gray-500'
                    }`}
                  >
                    {ownerEmailValidation.message}
                  </p>
                )}
              </div>

              <div>
                <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Contact Number <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>+63</span>
                  <input
                    type="text"
                    value={createFormData.contactNumber}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/\D/g, '').slice(0, 10)
                      setCreateFormData(prev => ({ ...prev, contactNumber: raw }))
                      setCreateFormErrors(prev => { const n = { ...prev }; delete n.contactNumber; return n })
                    }}
                    className={`w-full pl-12 pr-3 py-2.5 rounded-lg border text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50 ${
                      createFormErrors.contactNumber
                        ? 'border-red-500'
                        : isDark
                        ? 'bg-[#0A1628] border-[#1E293B] text-white placeholder-gray-500'
                        : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'
                    }`}
                    placeholder="9XXXXXXXXX"
                    maxLength={10}
                  />
                </div>
                {createFormErrors.contactNumber && <p className="text-xs text-red-500 mt-1">{createFormErrors.contactNumber}</p>}
              </div>
            </div>

            {/* Footer */}
            <div className={`px-6 py-4 border-t flex gap-3 justify-end ${isDark ? 'border-[#1E293B] bg-[#0D1526]' : 'border-gray-100 bg-gray-50/50'}`}>
              <button
                onClick={() => { setShowCreateForm(false); setPendingInquiry(null) }}
                className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  isDark
                    ? 'bg-white/5 text-gray-300 hover:bg-white/10 border border-[#1E293B]'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200'
                }`}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateAccountSubmit}
                disabled={
                  approving ||
                  !createFormData.email.trim() ||
                  ownerEmailValidation.isChecking ||
                  ownerEmailValidation.isInvalid
                }
                className="px-5 py-2.5 rounded-lg text-sm font-semibold bg-primary hover:bg-primary-600 text-white transition-all disabled:opacity-50"
              >
                {approving ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Credentials Modal — shown after approving an inquiry */}
      {showCredentials && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div className={`relative w-full max-w-md mx-4 rounded-xl border p-6 ${isDark ? 'bg-[#111C32] border-[#1E293B]' : 'bg-white border-gray-200'}`}>
            <h3 className={`text-xl font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Owner Account Created
            </h3>

            <div className={`rounded-lg p-4 mb-4 ${isDark ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-emerald-50 border border-emerald-200'}`}>
              <p className={`text-sm font-medium ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>
                A verification email has been sent. The owner must verify their email before logging in.
              </p>
            </div>

            <div className="space-y-3">
              <div className={`flex items-center justify-between rounded-lg p-3 ${isDark ? 'bg-[#0A1628] border border-[#1E293B]' : 'bg-gray-50 border border-gray-200'}`}>
                <div>
                  <p className={`text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Email</p>
                  <p className={`text-sm font-mono mt-0.5 ${isDark ? 'text-white' : 'text-gray-900'}`}>{credentials.email}</p>
                </div>
                <button
                  onClick={() => copyToClipboard(credentials.email, 'Email')}
                  className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-gray-200 text-gray-500'}`}
                >
                  {copiedField === 'Email' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>

              {credentials.password && (
                <div className={`flex items-center justify-between rounded-lg p-3 ${isDark ? 'bg-[#0A1628] border border-[#1E293B]' : 'bg-gray-50 border border-gray-200'}`}>
                  <div>
                    <p className={`text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Password</p>
                    <p className={`text-sm font-mono mt-0.5 ${isDark ? 'text-white' : 'text-gray-900'}`}>{credentials.password}</p>
                  </div>
                  <button
                    onClick={() => copyToClipboard(credentials.password, 'Password')}
                    className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-gray-200 text-gray-500'}`}
                  >
                    {copiedField === 'Password' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              )}
            </div>

            {credentials.password && (
              <div className={`mt-4 rounded-lg p-3 ${isDark ? 'bg-yellow-500/10 border border-yellow-500/20' : 'bg-yellow-50 border border-yellow-200'}`}>
                <p className={`text-xs ${isDark ? 'text-yellow-400' : 'text-yellow-700'}`}>
                  ⚠️ Save these credentials now. The password cannot be retrieved after closing this dialog.
                </p>
              </div>
            )}

            <div className="flex justify-end mt-6">
              <button
                onClick={() => {
                  setShowCredentials(false)
                  setEmailSent(false)
                  setEmailCooldown(0)
                }}
                className="px-5 py-2.5 rounded-lg text-sm font-semibold bg-primary hover:bg-primary-600 text-white transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
