import { useEffect, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Search, PhilippinePeso, Eye, Calendar, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Clock, CheckCircle2, XCircle, X, Receipt, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { useTheme } from '../../context/ThemeContext'
import {
  getPayments,
  getPendingCashVerifications,
  approveCashPayment,
  rejectCashPayment,
  settleCashBilling,
  getManagerTenants,
  generateMonthlyBillings,
  type Payment,
  type TenantAccount,
} from '../../lib/managerApi'
import { TableSkeleton } from '@/components/ui/skeleton'
import TablePagination from '@/components/ui/table-pagination'

interface ManagerPaymentsTabProps {
  clientId: string
}

const STATUS_OPTIONS = ['all', 'paid', 'pending', 'overdue'] as const

type StatusFilter = (typeof STATUS_OPTIONS)[number]

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const statusBadge: Record<Payment['status'], { bg: string; text: string }> = {
  paid: { bg: 'bg-green-400/15', text: 'text-green-500' },
  pending: { bg: 'bg-yellow-400/15', text: 'text-yellow-500' },
  overdue: { bg: 'bg-red-400/15', text: 'text-red-400' },
}

export default function ManagerPaymentsTab({ clientId }: ManagerPaymentsTabProps) {
  const { isDark } = useTheme()
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<StatusFilter>('all')
  const [page, setPage] = useState(1)
  const pageSize = 10

  // Pending cash verifications
  const [pendingVerifications, setPendingVerifications] = useState<Payment[]>([])
  const [loadingVerifications, setLoadingVerifications] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [previewVerification, setPreviewVerification] = useState<Payment | null>(null)

  // Record cash payment modal
  const [showRecordModal, setShowRecordModal] = useState(false)
  const [tenants, setTenants] = useState<TenantAccount[]>([])
  const [recordForm, setRecordForm] = useState({ tenantId: '', paymentId: '', description: '', paymentMode: 'cash' as 'gcash' | 'maya' | 'cash' | 'bank_transfer' })
  const [recordLoading, setRecordLoading] = useState(false)

  // Month/Year filter
  const now = new Date()
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null)
  const [selectedYear, setSelectedYear] = useState(now.getFullYear())
  const [monthPickerOpen, setMonthPickerOpen] = useState(false)
  const monthPickerRef = useRef<HTMLDivElement>(null)

  async function load() {
    try {
      // Generate billings first, then load payments
      await generateMonthlyBillings(clientId)
      const data = await getPayments(clientId)
      setPayments(data)
    } catch (err) {
      console.error('Failed to load payments:', err)
    } finally {
      setLoading(false)
    }
  }

  async function loadVerifications() {
    try {
      const data = await getPendingCashVerifications(clientId)
      setPendingVerifications(data)
    } catch (err) {
      console.error('Failed to load verifications:', err)
    } finally {
      setLoadingVerifications(false)
    }
  }

  async function loadTenants() {
    try {
      const data = await getManagerTenants(clientId)
      setTenants(data.filter(t => t.status === 'active'))
    } catch (err) {
      console.error('Failed to load tenants:', err)
    }
  }

  const handleRecordCashPayment = async () => {
    if (!recordForm.tenantId || !recordForm.paymentId) {
      toast.error('Please select a tenant and billing period')
      return
    }

    const selectedPayment = payments.find((payment) => payment.id === recordForm.paymentId)
    if (!selectedPayment || (selectedPayment.status !== 'pending' && selectedPayment.status !== 'overdue')) {
      toast.error('Selected billing period is no longer pending/overdue')
      return
    }

    setRecordLoading(true)
    try {
      await settleCashBilling(recordForm.paymentId, recordForm.description || undefined, recordForm.paymentMode)
      toast.success('Payment recorded — awaiting owner approval')
      setShowRecordModal(false)
      setRecordForm({ tenantId: '', paymentId: '', description: '', paymentMode: 'cash' })
      await load()
    } catch (err) {
      console.error('Failed to record payment:', err)
      toast.error('Failed to record payment')
    } finally {
      setRecordLoading(false)
    }
  }

  useEffect(() => { load(); loadVerifications(); loadTenants() }, [clientId])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (monthPickerRef.current && !monthPickerRef.current.contains(e.target as Node)) {
        setMonthPickerOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const monthFiltered = payments.filter((p) => {
    if (selectedMonth === null) return true
    const d = new Date(p.payment_date)
    return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear
  })

  const periodLabel = selectedMonth !== null
    ? `${MONTHS[selectedMonth]} ${selectedYear}`
    : 'All Time'

  const recordDuePayments = recordForm.tenantId
    ? payments.filter((payment) => (
      payment.tenant_id === recordForm.tenantId &&
      (payment.status === 'pending' || payment.status === 'overdue')
    ))
    : []

  const selectedRecordPayment = recordDuePayments.find((payment) => payment.id === recordForm.paymentId) || null

  const filtered = monthFiltered.filter((p) => {
    if (filter !== 'all' && p.status !== filter) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        (p.tenant_name ?? '').toLowerCase().includes(q) ||
        (p.apartment_name ?? '').toLowerCase().includes(q) ||
        (p.description ?? '').toLowerCase().includes(q)
      )
    }
    return true
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize)

  useEffect(() => {
    setPage(1)
  }, [search, filter, selectedMonth, selectedYear, payments.length])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const cardClass = `rounded-xl border ${isDark ? 'bg-navy-card border-[#1E293B]' : 'bg-white border-gray-200 shadow-sm'}`

  const handleApprove = async (paymentId: string) => {
    setActionLoading(paymentId)
    try {
      await approveCashPayment(paymentId)
      toast.success('Payment verified! Awaiting owner approval.')
      await Promise.all([load(), loadVerifications()])
      setPreviewVerification(null)
    } catch (err) {
      console.error('Failed to verify:', err)
      toast.error('Failed to verify payment')
    } finally {
      setActionLoading(null)
    }
  }

  const handleReject = async (paymentId: string) => {
    setActionLoading(paymentId)
    try {
      await rejectCashPayment(paymentId)
      toast.success('Cash payment rejected')
      await Promise.all([load(), loadVerifications()])
      setPreviewVerification(null)
    } catch (err) {
      console.error('Failed to reject:', err)
      toast.error('Failed to reject payment')
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Header + Month/Year Picker */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Payments</h2>
          <p className={`text-base mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            View tenant payment records and history
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Record Cash Payment Button */}
          <button
            onClick={() => setShowRecordModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Record Cash Payment
          </button>

          {/* Month/Year Picker */}
        <div className="relative" ref={monthPickerRef}>
          <button
            onClick={() => setMonthPickerOpen(!monthPickerOpen)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
              isDark
                ? 'bg-[#111D32] border-[#1E293B] text-white hover:border-primary/50'
                : 'bg-white border-gray-200 text-gray-900 hover:border-primary/50'
            }`}
          >
            <Calendar className="w-4 h-4 text-primary" />
            {periodLabel}
            <ChevronUp className={`w-4 h-4 transition-transform ${monthPickerOpen ? '' : 'rotate-180'} ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
          </button>

          {monthPickerOpen && (
            <div className={`absolute right-0 mt-2 w-72 rounded-xl border shadow-xl z-30 p-4 ${
              isDark ? 'bg-[#111D32] border-[#1E293B]' : 'bg-white border-gray-200'
            }`}>
              <div className="flex items-center justify-between mb-3">
                <button
                  onClick={() => setSelectedYear(y => y - 1)}
                  className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  <input
                    type="number"
                    value={selectedYear}
                    onChange={(e) => {
                      const v = parseInt(e.target.value)
                      if (!isNaN(v)) setSelectedYear(v)
                    }}
                    className={`w-16 text-center text-sm font-semibold bg-transparent outline-none border-b-2 ${
                      isDark ? 'border-[#1E293B] text-white focus:border-primary' : 'border-gray-200 text-gray-900 focus:border-primary'
                    } [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
                  />
                </span>
                <button
                  onClick={() => setSelectedYear(y => y + 1)}
                  className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <button
                onClick={() => { setSelectedMonth(null); setMonthPickerOpen(false) }}
                className={`w-full mb-2 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedMonth === null
                    ? 'bg-primary text-white'
                    : isDark ? 'text-gray-400 hover:bg-white/5' : 'text-gray-500 hover:bg-gray-50'
                }`}
              >
                All Time
              </button>

              <div className="grid grid-cols-3 gap-1.5">
                {MONTHS.map((m, i) => {
                  const isSelected = selectedMonth === i
                  return (
                    <button
                      key={m}
                      onClick={() => { setSelectedMonth(i); setMonthPickerOpen(false) }}
                      className={`py-2 rounded-lg text-xs font-medium transition-colors ${
                        isSelected
                          ? 'bg-primary text-white'
                          : isDark
                          ? 'text-gray-400 hover:bg-white/5 hover:text-white'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                    >
                      {m.slice(0, 3)}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
        </div>
      </div>

      {/* Pending Cash Payment Verifications */}
      {!loadingVerifications && pendingVerifications.length > 0 && (
        <div className={`${cardClass} p-6`}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-amber-500/15 flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Pending Payment Verifications
              </h3>
              <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                {pendingVerifications.length} request{pendingVerifications.length !== 1 ? 's' : ''} waiting for your review
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {pendingVerifications.map((v) => (
              <div
                key={v.id}
                className={`rounded-xl p-4 border ${
                  isDark ? 'bg-[#0A1628] border-[#1E293B]' : 'bg-gray-50 border-gray-200'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  {/* Info */}
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {v.tenant_name}
                      </p>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${isDark ? 'bg-[#1E293B] text-gray-400' : 'bg-gray-200 text-gray-500'}`}>
                        {v.apartment_name}
                      </span>
                    </div>
                    <p className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      ₱{Number(v.amount).toLocaleString()}
                    </p>
                    <div className={`flex flex-wrap gap-x-4 gap-y-1 text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      <span>Submitted: {new Date(v.created_at).toLocaleDateString()}</span>
                      {v.period_from && v.period_to && (
                        <span>
                          Period: {new Date(v.period_from + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          {' — '}
                          {new Date(v.period_to + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPreviewVerification(v)}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                        isDark
                          ? 'bg-[#1E293B] text-gray-300 hover:bg-[#2a3a52]'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      <Receipt className="w-3.5 h-3.5" /> Preview & Verify
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search + Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
          <input
            type="text"
            placeholder="Search by tenant, unit, or description…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`w-full pl-10 pr-4 py-2.5 rounded-lg border text-base transition-colors ${
              isDark
                ? 'bg-[#111D32] border-[#1E293B] text-white placeholder-gray-500 focus:border-primary'
                : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-primary'
            } focus:outline-none`}
          />
        </div>
        <div className="flex gap-2">
          {STATUS_OPTIONS.map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-colors capitalize ${
                filter === s
                  ? 'bg-primary text-white'
                  : isDark
                  ? 'bg-[#111D32] text-gray-400 hover:text-white border border-[#1E293B]'
                  : 'bg-gray-100 text-gray-500 hover:text-gray-700 border border-gray-200'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <TableSkeleton rows={6} />
      )}

      {/* Table */}
      {!loading && (
        <div className={`${cardClass} overflow-x-auto min-h-[calc(100vh-300px)] max-h-[calc(100vh-300px)] overflow-y-auto`}>
          <table className="w-full text-base">
            <thead>
              <tr className={`border-b ${isDark ? 'border-[#1E293B]' : 'border-gray-200'}`}>
                {['Names', 'Unit', 'Amount', 'Date', 'Status', 'Description', ''].map((h) => (
                  <th key={h} className={`text-left py-3 px-4 font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.map((p) => {
                const badge = statusBadge[p.status]
                return (
                  <tr key={p.id} className={`border-b last:border-0 ${isDark ? 'border-[#1E293B]' : 'border-gray-100'}`}>
                    <td className={`py-3 px-4 font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{p.tenant_name}</td>
                    <td className={`py-3 px-4 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{p.apartment_name}</td>
                    <td className={`py-3 px-4 font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>₱{Number(p.amount).toLocaleString()}</td>
                    <td className={`py-3 px-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{new Date(p.payment_date).toLocaleDateString()}</td>
                    <td className="py-3 px-4">
                      <span className={`inline-block px-2.5 py-0.5 text-xs font-medium rounded-full capitalize ${badge.bg} ${badge.text}`}>
                        {p.status}
                      </span>
                    </td>
                    <td className={`py-3 px-4 max-w-xs truncate ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{p.description || '—'}</td>
                    <td className="py-3 px-4">
                      <button
                        onClick={() => setPreviewVerification(p)}
                        title="View payment details"
                        className={`p-2 rounded-lg transition-colors ${isDark ? 'text-gray-400 hover:text-primary hover:bg-primary/10' : 'text-gray-500 hover:text-primary hover:bg-primary/10'}`}
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className={`text-center ${isDark ? 'text-gray-500' : 'text-gray-400'}`} style={{ height: 'calc(100vh - 400px)' }}>
                    <div className="flex flex-col items-center justify-center h-full">
                    {payments.length === 0 ? (
                      <>
                        <PhilippinePeso className={`w-12 h-12 mb-3 ${isDark ? 'text-gray-600' : 'text-gray-300'}`} />
                        <p className="text-lg font-medium">No payment records yet</p>
                      </>
                    ) : <p className="text-lg font-medium">No matching payments</p>}
                    </div>
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

      {/* Verification Preview Modal */}
      {previewVerification && createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/65 animate-in fade-in duration-200"
          onClick={() => setPreviewVerification(null)}
        >
          <div
            className={`rounded-2xl p-4 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 fade-in duration-200 ${isDark ? 'bg-[#111D32]' : 'bg-white'}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h4 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Payment Verification Preview
              </h4>
              <button onClick={() => setPreviewVerification(null)} className={`p-1 rounded-lg transition-colors ${isDark ? 'hover:bg-white/10' : 'hover:bg-gray-100'}`}>
                <X className={`w-5 h-5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
              </button>
            </div>

            <div className={`rounded-xl border p-4 mb-4 ${isDark ? 'border-[#1E293B] bg-[#0A1628]' : 'border-gray-200 bg-gray-50'}`}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <p className={isDark ? 'text-gray-300' : 'text-gray-700'}><span className="font-semibold">Tenant:</span> {previewVerification.tenant_name || '—'}</p>
                <p className={isDark ? 'text-gray-300' : 'text-gray-700'}><span className="font-semibold">Unit:</span> {previewVerification.apartment_name || '—'}</p>
                <p className={isDark ? 'text-gray-300' : 'text-gray-700'}><span className="font-semibold">Submitted:</span> {new Date(previewVerification.created_at).toLocaleString()}</p>
                <p className={isDark ? 'text-gray-300' : 'text-gray-700'}><span className="font-semibold">Period:</span> {previewVerification.period_from && previewVerification.period_to
                  ? `${new Date(previewVerification.period_from + 'T00:00:00').toLocaleDateString()} — ${new Date(previewVerification.period_to + 'T00:00:00').toLocaleDateString()}`
                  : '—'}</p>
                <p className={isDark ? 'text-gray-300' : 'text-gray-700'}><span className="font-semibold">Mode:</span> {
                  previewVerification.payment_mode === 'gcash' ? 'GCash' :
                  previewVerification.payment_mode === 'maya' ? 'Maya' :
                  previewVerification.payment_mode === 'bank_transfer' ? 'Bank Transfer' :
                  previewVerification.payment_mode === 'cash' ? 'Cash' : 'Cash'
                }</p>
              </div>
              {previewVerification.description && (
                <p className={`mt-3 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  <span className="font-semibold">Description:</span> {previewVerification.description}
                </p>
              )}
            </div>

            {previewVerification.receipt_url ? (
              <div className={`rounded-lg overflow-hidden border ${isDark ? 'border-[#1E293B]' : 'border-gray-200'}`}>
                <img src={previewVerification.receipt_url} alt="Payment Receipt" className="w-full rounded-lg" />
              </div>
            ) : (
              <div className={`rounded-lg border p-6 text-center text-sm ${isDark ? 'border-[#1E293B] text-gray-500' : 'border-gray-200 text-gray-500'}`}>
                No receipt image uploaded.
              </div>
            )}

            {previewVerification.verification_status === 'pending_verification' ? (
              <div className="flex items-center justify-end gap-2 mt-4">
                <button
                  onClick={() => handleReject(previewVerification.id)}
                  disabled={actionLoading === previewVerification.id}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-colors disabled:opacity-50"
                >
                  <XCircle className="w-4 h-4" /> Reject
                </button>
                <button
                  onClick={() => handleApprove(previewVerification.id)}
                  disabled={actionLoading === previewVerification.id}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold bg-emerald-500 text-white hover:bg-emerald-600 transition-colors disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" /> Verify
                </button>
              </div>
            ) : (
              <div className="flex justify-end mt-4">
                <button
                  onClick={() => setPreviewVerification(null)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isDark ? 'bg-[#1E293B] text-gray-300 hover:bg-[#2a3a52]' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* Record Cash Payment Modal */}
      {showRecordModal && createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/65 animate-in fade-in duration-200"
          onClick={() => setShowRecordModal(false)}
        >
          <div
            className={`rounded-2xl p-6 max-w-md w-full mx-4 animate-in zoom-in-95 fade-in duration-200 ${isDark ? 'bg-[#111D32]' : 'bg-white'}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h4 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Record Cash Payment
              </h4>
              <button onClick={() => setShowRecordModal(false)} className={`p-1 rounded-lg transition-colors ${isDark ? 'hover:bg-white/10' : 'hover:bg-gray-100'}`}>
                <X className={`w-5 h-5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Tenant Selection */}
              <div>
                <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Tenant
                </label>
                <select
                  value={recordForm.tenantId}
                  onChange={(e) => setRecordForm(f => ({ ...f, tenantId: e.target.value, paymentId: '' }))}
                  className={`w-full px-3 py-2.5 rounded-lg border text-sm transition-colors ${
                    isDark
                      ? 'bg-[#0A1628] border-[#1E293B] text-white focus:border-primary'
                      : 'bg-white border-gray-200 text-gray-900 focus:border-primary'
                  } focus:outline-none`}
                >
                  <option value="">Select a tenant</option>
                  {tenants.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} {t.apartment_name ? `— ${t.apartment_name}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Billing Period (Pending/Overdue) */}
              <div>
                <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Billing Period
                </label>
                <select
                  value={recordForm.paymentId}
                  onChange={(e) => setRecordForm(f => ({ ...f, paymentId: e.target.value }))}
                  disabled={!recordForm.tenantId || recordDuePayments.length === 0}
                  className={`w-full px-3 py-2.5 rounded-lg border text-sm transition-colors ${
                    isDark
                      ? 'bg-[#0A1628] border-[#1E293B] text-white focus:border-primary'
                      : 'bg-white border-gray-200 text-gray-900 focus:border-primary'
                  } focus:outline-none ${(!recordForm.tenantId || recordDuePayments.length === 0) ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  <option value="">
                    {!recordForm.tenantId
                      ? 'Select tenant first'
                      : recordDuePayments.length === 0
                        ? 'No pending/overdue billings'
                        : 'Select billing period'}
                  </option>
                  {recordDuePayments.map((payment) => {
                    const periodLabelText = payment.period_from && payment.period_to
                      ? `${new Date(payment.period_from + 'T00:00:00').toLocaleDateString()} - ${new Date(payment.period_to + 'T00:00:00').toLocaleDateString()}`
                      : new Date(payment.payment_date).toLocaleDateString()
                    return (
                      <option key={payment.id} value={payment.id}>
                        {periodLabelText} • ₱{Number(payment.amount).toLocaleString()} • {payment.status}
                      </option>
                    )
                  })}
                </select>
              </div>

              {/* Payment Type */}
              <div>
                <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Payment Mode
                </label>
                <select
                  value={recordForm.paymentMode}
                  onChange={(e) => setRecordForm(f => ({ ...f, paymentMode: e.target.value as any }))}
                  className={`w-full px-3 py-2.5 rounded-lg border text-sm transition-colors ${
                    isDark
                      ? 'bg-[#0A1628] border-[#1E293B] text-white'
                      : 'bg-white border-gray-200 text-gray-900'
                  } focus:outline-none focus:border-primary`}
                >
                  <option value="cash">Cash</option>
                  <option value="gcash">GCash</option>
                  <option value="maya">Maya</option>
                  <option value="bank_transfer">Bank Transfer</option>
                </select>
              </div>

              {/* Amount */}
              <div>
                <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Amount Paid (₱)
                </label>
                <input
                  type="text"
                  readOnly
                  placeholder="Select billing period"
                  value={selectedRecordPayment ? `₱${Number(selectedRecordPayment.amount).toLocaleString()}` : ''}
                  className={`w-full px-3 py-2.5 rounded-lg border text-sm transition-colors ${
                    isDark
                      ? 'bg-[#0A1628] border-[#1E293B] text-white placeholder-gray-500'
                      : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400'
                  } focus:outline-none`}
                />
              </div>

              {/* Description */}
              <div>
                <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Description (optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Monthly rent payment"
                  value={recordForm.description}
                  onChange={(e) => setRecordForm(f => ({ ...f, description: e.target.value }))}
                  className={`w-full px-3 py-2.5 rounded-lg border text-sm transition-colors ${
                    isDark
                      ? 'bg-[#0A1628] border-[#1E293B] text-white placeholder-gray-500 focus:border-primary'
                      : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-primary'
                  } focus:outline-none`}
                />
              </div>

              {/* Submit */}
              <button
                onClick={handleRecordCashPayment}
                disabled={recordLoading}
                className="w-full py-2.5 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {recordLoading ? 'Recording...' : 'Record Payment'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
