import { Search, Eye, CheckCircle, Clock, ShieldCheck, Ban, Copy, Check, XCircle, User, Mail, Phone, CalendarDays, MessageSquare, Send, Building2 } from 'lucide-react'
import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { useTheme } from '../../context/ThemeContext'
import { getInquiries, updateInquiryStatus, approveInquiry, type Inquiry } from '../../lib/api'
import { TableSkeleton } from '@/components/ui/skeleton'
import TablePagination from '@/components/ui/table-pagination'

const statusConfig: Record<Inquiry['status'], { icon: typeof Clock; bg: string; text: string }> = {
  pending: {
    icon: Clock,
    bg: 'bg-yellow-500/15',
    text: 'text-yellow-500',
  },
  responded: {
    icon: CheckCircle,
    bg: 'bg-blue-500/15',
    text: 'text-blue-400',
  },
  approved: {
    icon: ShieldCheck,
    bg: 'bg-emerald-500/15',
    text: 'text-emerald-400',
  },
  cancelled: {
    icon: Ban,
    bg: 'bg-red-500/15',
    text: 'text-red-400',
  },
}

export default function InquiriesTab() {
  const { isDark } = useTheme()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'pending' | 'history'>('all')
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

  // Credentials modal
  const [showCredentials, setShowCredentials] = useState(false)
  const [credentials, setCredentials] = useState({ email: '', password: '' })
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [emailSending, setEmailSending] = useState(false)
  const [emailSent, setEmailSent] = useState(false)

  useEffect(() => {
    loadInquiries()
  }, [])

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
      contactNumber: inquiry.phone || '',
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

    try {
      setApproving(true)
      const fullName = `${createFormData.firstName.trim()} ${createFormData.lastName.trim()}`
      const result = await approveInquiry(pendingInquiry, {
        name: fullName,
        email: createFormData.email.trim(),
        phone: createFormData.contactNumber.trim(),
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
      (inq.apartment_name ?? '').toLowerCase().includes(search.toLowerCase())
    const matchesFilter =
      filter === 'history'
        ? inq.status !== 'pending'
        : inq.status === 'pending'
    return matchesSearch && matchesFilter
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize)

  useEffect(() => {
    setPage(1)
  }, [search, filter, inquiries.length])

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
    <div className="space-y-6 animate-fade-up flex flex-col h-full overflow-hidden">
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
              onClick={() => setFilter(f)}
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
        </div>
      </div>

      {/* Table */}
      <div className={`${cardClass} overflow-hidden flex-1 flex flex-col min-h-0`}>
        <div className="overflow-auto flex-1">
          <table className="w-full text-base">
            <thead className={`sticky top-0 z-10 ${isDark ? 'bg-navy-card' : 'bg-white'}`}>
              <tr className={`border-b ${isDark ? 'border-[#1E293B]' : 'border-gray-200'}`}>
                {['Name', 'Email', 'Apartment', 'Message', 'Status', 'Date', ''].map((h) => (
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
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={7} className="py-3 px-4">
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
                    <td className={`py-3.5 px-4 font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {inq.name}
                    </td>
                    <td className={`py-3.5 px-4 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                      {inq.email}
                    </td>
                    <td className={`py-3.5 px-4 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                      {inq.apartment_name || '—'}
                    </td>
                    <td className={`py-3.5 px-4 max-w-[260px] truncate ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                      {inq.message}
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
                    colSpan={7}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div
            className={`w-full max-w-lg mx-4 rounded-2xl border overflow-hidden ${
              isDark
                ? 'bg-[#111D32] border-[#1E293B]'
                : 'bg-white border-gray-200 shadow-2xl'
            }`}
          >
            {/* Header */}
            <div className={`px-6 py-5 border-b ${isDark ? 'border-[#1E293B]' : 'border-gray-100'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isDark ? 'bg-primary/15' : 'bg-primary/10'}`}>
                    <User className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {selectedInquiry.name}
                    </h3>
                    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-0.5 rounded-full capitalize ${statusConfig[selectedInquiry.status].bg} ${statusConfig[selectedInquiry.status].text}`}>
                      <span className="w-1.5 h-1.5 rounded-full bg-current" />
                      {selectedInquiry.status}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedInquiry(null)}
                  className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-gray-100 text-gray-400'}`}
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-4">
              {/* Info grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className={`flex items-start gap-3 p-3 rounded-xl ${isDark ? 'bg-[#0A1628]' : 'bg-gray-50'}`}>
                  <Mail className={`w-4 h-4 mt-0.5 shrink-0 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                  <div className="min-w-0">
                    <p className={`text-xs font-medium mb-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Email</p>
                    <p className={`text-sm truncate ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{selectedInquiry.email}</p>
                  </div>
                </div>
                <div className={`flex items-start gap-3 p-3 rounded-xl ${isDark ? 'bg-[#0A1628]' : 'bg-gray-50'}`}>
                  <Phone className={`w-4 h-4 mt-0.5 shrink-0 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                  <div className="min-w-0">
                    <p className={`text-xs font-medium mb-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Phone</p>
                    <p className={`text-sm ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{selectedInquiry.phone || '—'}</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className={`flex items-start gap-3 p-3 rounded-xl ${isDark ? 'bg-[#0A1628]' : 'bg-gray-50'}`}>
                  <Building2 className={`w-4 h-4 mt-0.5 shrink-0 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                  <div className="min-w-0">
                    <p className={`text-xs font-medium mb-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Apartment</p>
                    <p className={`text-sm ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{selectedInquiry.apartment_name || '—'}</p>
                  </div>
                </div>
                <div className={`flex items-start gap-3 p-3 rounded-xl ${isDark ? 'bg-[#0A1628]' : 'bg-gray-50'}`}>
                  <CalendarDays className={`w-4 h-4 mt-0.5 shrink-0 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                  <div>
                    <p className={`text-xs font-medium mb-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Date Submitted</p>
                    <p className={`text-sm ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                      {new Date(selectedInquiry.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                  </div>
                </div>
              </div>

              {/* Message */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <MessageSquare className={`w-4 h-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                  <p className={`text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Message</p>
                </div>
                <div className={`p-4 rounded-xl text-sm leading-relaxed ${isDark ? 'bg-[#0A1628] text-gray-300 border border-[#1E293B]' : 'bg-gray-50 text-gray-700 border border-gray-100'}`}>
                  {selectedInquiry.message.replace(/^Apartment:\s*/i, '')}
                </div>
              </div>
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
                  Cancel
                </button>
                <button
                  onClick={() => openCreateForm(selectedInquiry)}
                  className="px-5 py-2.5 rounded-lg text-sm font-semibold bg-primary hover:bg-primary-600 text-white transition-all"
                >
                  Create Account
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      {/* Create Owner Account Form Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => { setShowCreateForm(false); setPendingInquiry(null) }} />
          <div className={`relative w-full max-w-md mx-4 rounded-2xl border overflow-hidden ${isDark ? 'bg-[#111D32] border-[#1E293B]' : 'bg-white border-gray-200 shadow-2xl'}`}>
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
                  placeholder="owner@email.com"
                />
                {createFormErrors.email && <p className="text-xs text-red-500 mt-1">{createFormErrors.email}</p>}
              </div>

              <div>
                <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Contact Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={createFormData.contactNumber}
                  onChange={(e) => {
                    setCreateFormData(prev => ({ ...prev, contactNumber: e.target.value }))
                    setCreateFormErrors(prev => { const n = { ...prev }; delete n.contactNumber; return n })
                  }}
                  className={`w-full px-3 py-2.5 rounded-lg border text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50 ${
                    createFormErrors.contactNumber
                      ? 'border-red-500'
                      : isDark
                      ? 'bg-[#0A1628] border-[#1E293B] text-white placeholder-gray-500'
                      : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'
                  }`}
                  placeholder="09XX XXX XXXX"
                />
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
                disabled={approving}
                className="px-5 py-2.5 rounded-lg text-sm font-semibold bg-primary hover:bg-primary-600 text-white transition-all disabled:opacity-50"
              >
                {approving ? 'Creating...' : 'Create Account'}
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

            {/* Email Send Section */}
            <div className="mt-5 space-y-3">
              <p className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Send account details via Email
              </p>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Mail className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                  <input
                    type="email"
                    value={credentials.email}
                    readOnly
                    className={`w-full pl-10 pr-4 py-2.5 rounded-lg border text-sm transition-colors ${
                      isDark
                        ? 'bg-[#0A1628] border-[#1E293B] text-white placeholder-gray-500 focus:border-primary'
                        : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:border-primary'
                    } focus:outline-none`}
                  />
                </div>
                <button
                  onClick={async () => {
                    setEmailSending(true)
                    try {
                      await new Promise((resolve) => setTimeout(resolve, 1500))
                      setEmailSent(true)
                      toast.success(`Credentials sent to ${credentials.email}`)
                    } catch {
                      toast.error('Failed to send email')
                    } finally {
                      setEmailSending(false)
                    }
                  }}
                  disabled={emailSending || emailSent}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold bg-primary hover:bg-primary/90 text-white disabled:opacity-50 transition-colors"
                >
                  <Send className="w-4 h-4" />
                  {emailSending ? 'Sending...' : emailSent ? 'Sent!' : 'Send Email'}
                </button>
              </div>
              {emailSent && (
                <p className={`text-xs flex items-center gap-1 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                  <Check className="w-3.5 h-3.5" />
                  Credentials sent successfully to {credentials.email}
                </p>
              )}
            </div>

            <div className="flex justify-end mt-6">
              <button
                onClick={() => {
                  setShowCredentials(false)
                  setEmailSent(false)
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
