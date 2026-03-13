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
  recordCashPayment,
  getManagerTenants,
  getPaymentDueDay,
  setPaymentDueDay,
  generateMonthlyBillings,
  type Payment,
  type TenantAccount,
} from '../../lib/managerApi'

interface ManagerPaymentsTabProps {
  clientId: string
}

const STATUS_OPTIONS = ['all', 'paid', 'pending', 'overdue'] as const

const DUE_DATE_PRESETS = [
  { value: 1, label: 'Every 1st of the month' },
  { value: 5, label: 'Every 5th of the month' },
  { value: 10, label: 'Every 10th of the month' },
  { value: 15, label: 'Every 15th of the month' },
  { value: 25, label: 'Every 25th of the month' },
  { value: 30, label: 'End of the month' },
]
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

  // Pending cash verifications
  const [pendingVerifications, setPendingVerifications] = useState<Payment[]>([])
  const [loadingVerifications, setLoadingVerifications] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [previewReceipt, setPreviewReceipt] = useState<string | null>(null)

  // Record cash payment modal
  const [showRecordModal, setShowRecordModal] = useState(false)
  const [tenants, setTenants] = useState<TenantAccount[]>([])
  const [recordForm, setRecordForm] = useState({ tenantId: '', amount: '', description: '', periodFrom: '', periodTo: '' })
  const [recordLoading, setRecordLoading] = useState(false)

  // Due date configuration
  const [dueDay, setDueDay] = useState<number | null>(null)
  const [dueDayLoading, setDueDayLoading] = useState(false)
  const [dueDateDropdownOpen, setDueDateDropdownOpen] = useState(false)
  const dueDateDropdownRef = useRef<HTMLDivElement>(null)

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

  async function loadDueDay() {
    try {
      const day = await getPaymentDueDay(clientId)
      setDueDay(day)
    } catch (err) {
      console.error('Failed to load due day:', err)
    }
  }

  async function handleSaveDueDay(day: number) {
    setDueDayLoading(true)
    try {
      await setPaymentDueDay(clientId, day)
      setDueDay(day)
      setDueDateDropdownOpen(false)
      const preset = DUE_DATE_PRESETS.find(p => p.value === day)
      toast.success(preset ? `Due date set: ${preset.label}` : `Payment due date set to day ${day}`)
      await generateMonthlyBillings(clientId)
      await load()
    } catch (err) {
      console.error('Failed to set due day:', err)
      toast.error('Failed to save due date')
    } finally {
      setDueDayLoading(false)
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
    if (!recordForm.tenantId || !recordForm.amount) {
      toast.error('Please select a tenant and enter the amount')
      return
    }
    const amount = parseFloat(recordForm.amount)
    if (isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid amount')
      return
    }

    const selectedTenant = tenants.find(t => t.id === recordForm.tenantId)
    setRecordLoading(true)
    try {
      await recordCashPayment({
        client_id: clientId,
        tenant_id: recordForm.tenantId,
        apartment_id: selectedTenant?.apartment_id || null,
        amount,
        description: recordForm.description || undefined,
        period_from: recordForm.periodFrom || undefined,
        period_to: recordForm.periodTo || undefined,
      })
      toast.success('Cash payment recorded successfully!')
      setShowRecordModal(false)
      setRecordForm({ tenantId: '', amount: '', description: '', periodFrom: '', periodTo: '' })
      await load()
    } catch (err) {
      console.error('Failed to record payment:', err)
      toast.error('Failed to record payment')
    } finally {
      setRecordLoading(false)
    }
  }

  useEffect(() => { load(); loadVerifications(); loadTenants(); loadDueDay() }, [clientId])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (monthPickerRef.current && !monthPickerRef.current.contains(e.target as Node)) {
        setMonthPickerOpen(false)
      }
      if (dueDateDropdownRef.current && !dueDateDropdownRef.current.contains(e.target as Node)) {
        setDueDateDropdownOpen(false)
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

  const cardClass = `rounded-xl border ${isDark ? 'bg-navy-card border-[#1E293B]' : 'bg-white border-gray-200 shadow-sm'}`

  const handleApprove = async (paymentId: string) => {
    setActionLoading(paymentId)
    try {
      await approveCashPayment(paymentId)
      toast.success('Cash payment approved!')
      await Promise.all([load(), loadVerifications()])
    } catch (err) {
      console.error('Failed to approve:', err)
      toast.error('Failed to approve payment')
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

      {/* Payment Due Date Configuration */}
      <div className={`${cardClass} p-4`}>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Payment Due Date
            </h3>
            <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              {dueDay
                ? DUE_DATE_PRESETS.find(p => p.value === dueDay)?.label || `Rent is due on day ${dueDay} of each month`
                : 'Select the monthly payment due date for your tenants'}
            </p>
          </div>
          <div className="relative" ref={dueDateDropdownRef}>
            <button
              type="button"
              onClick={() => setDueDateDropdownOpen(!dueDateDropdownOpen)}
              disabled={dueDayLoading}
              className={`w-64 px-3 py-2 rounded-lg border text-sm text-left flex items-center justify-between transition-colors ${
                isDark
                  ? 'bg-[#0A1628] border-[#1E293B] text-white hover:border-primary/50'
                  : 'bg-gray-50 border-gray-200 text-gray-900 hover:border-primary/50'
              } ${dueDayLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <span className={!dueDay ? (isDark ? 'text-gray-500' : 'text-gray-400') : ''}>
                {dueDayLoading
                  ? 'Saving...'
                  : dueDay
                    ? DUE_DATE_PRESETS.find(p => p.value === dueDay)?.label || `Day ${dueDay} of each month`
                    : 'Select due date'}
              </span>
              <ChevronDown className={`w-4 h-4 ml-2 flex-shrink-0 transition-transform ${dueDateDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            {dueDateDropdownOpen && (
              <div className={`absolute right-0 mt-1 w-64 rounded-lg border shadow-lg z-50 overflow-hidden ${
                isDark ? 'bg-[#0F1D32] border-[#1E293B]' : 'bg-white border-gray-200'
              }`}>
                {DUE_DATE_PRESETS.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => handleSaveDueDay(preset.value)}
                    disabled={dueDayLoading}
                    className={`w-full px-3 py-2.5 text-sm text-left flex items-center justify-between transition-colors ${
                      dueDay === preset.value
                        ? isDark ? 'bg-primary/20 text-primary font-medium' : 'bg-primary/10 text-primary font-medium'
                        : isDark ? 'text-gray-300 hover:bg-[#1E293B]' : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {preset.label}
                    {dueDay === preset.value && <CheckCircle2 className="w-4 h-4" />}
                  </button>
                ))}
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
                Pending Cash Verifications
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
                    {v.receipt_url && (
                      <button
                        onClick={() => setPreviewReceipt(v.receipt_url)}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                          isDark
                            ? 'bg-[#1E293B] text-gray-300 hover:bg-[#2a3a52]'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        <Receipt className="w-3.5 h-3.5" /> View Receipt
                      </button>
                    )}
                    <button
                      onClick={() => handleApprove(v.id)}
                      disabled={actionLoading === v.id}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-emerald-500 text-white hover:bg-emerald-600 transition-colors disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                    </button>
                    <button
                      onClick={() => handleReject(v.id)}
                      disabled={actionLoading === v.id}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-colors disabled:opacity-50"
                    >
                      <XCircle className="w-3.5 h-3.5" /> Reject
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
        <div className={`text-center py-8 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Loading payments…</div>
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
              {filtered.map((p) => {
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
        <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
          Showing {filtered.length} of {payments.length} payments
        </p>
      )}

      {/* Receipt Preview Modal */}
      {previewReceipt && createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-md"
          onClick={() => setPreviewReceipt(null)}
        >
          <div
            className={`rounded-2xl p-4 max-w-md w-full mx-4 ${isDark ? 'bg-[#111D32]' : 'bg-white'}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h4 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Payment Receipt
              </h4>
              <button onClick={() => setPreviewReceipt(null)} className={`p-1 rounded-lg transition-colors ${isDark ? 'hover:bg-white/10' : 'hover:bg-gray-100'}`}>
                <X className={`w-5 h-5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
              </button>
            </div>
            <div className={`rounded-lg overflow-hidden border ${isDark ? 'border-[#1E293B]' : 'border-gray-200'}`}>
              <img src={previewReceipt} alt="Payment Receipt" className="w-full rounded-lg" />
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Record Cash Payment Modal */}
      {showRecordModal && createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-md"
          onClick={() => setShowRecordModal(false)}
        >
          <div
            className={`rounded-2xl p-6 max-w-md w-full mx-4 ${isDark ? 'bg-[#111D32]' : 'bg-white'}`}
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
                  onChange={(e) => setRecordForm(f => ({ ...f, tenantId: e.target.value }))}
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

              {/* Payment Type */}
              <div>
                <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Payment Type
                </label>
                <div className={`w-full px-3 py-2.5 rounded-lg border text-sm ${
                  isDark
                    ? 'bg-[#0A1628] border-[#1E293B] text-white'
                    : 'bg-gray-50 border-gray-200 text-gray-900'
                }`}>
                  Cash
                </div>
              </div>

              {/* Amount */}
              <div>
                <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Amount Paid (₱)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Enter amount"
                  value={recordForm.amount}
                  onChange={(e) => setRecordForm(f => ({ ...f, amount: e.target.value }))}
                  className={`w-full px-3 py-2.5 rounded-lg border text-sm transition-colors ${
                    isDark
                      ? 'bg-[#0A1628] border-[#1E293B] text-white placeholder-gray-500 focus:border-primary'
                      : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-primary'
                  } focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
                />
              </div>

              {/* Period */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    Period From
                  </label>
                  <input
                    type="date"
                    value={recordForm.periodFrom}
                    onChange={(e) => setRecordForm(f => ({ ...f, periodFrom: e.target.value }))}
                    className={`w-full px-3 py-2.5 rounded-lg border text-sm transition-colors ${
                      isDark
                        ? 'bg-[#0A1628] border-[#1E293B] text-white focus:border-primary'
                        : 'bg-white border-gray-200 text-gray-900 focus:border-primary'
                    } focus:outline-none`}
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    Period To
                  </label>
                  <input
                    type="date"
                    value={recordForm.periodTo}
                    onChange={(e) => setRecordForm(f => ({ ...f, periodTo: e.target.value }))}
                    className={`w-full px-3 py-2.5 rounded-lg border text-sm transition-colors ${
                      isDark
                        ? 'bg-[#0A1628] border-[#1E293B] text-white focus:border-primary'
                        : 'bg-white border-gray-200 text-gray-900 focus:border-primary'
                    } focus:outline-none`}
                  />
                </div>
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
