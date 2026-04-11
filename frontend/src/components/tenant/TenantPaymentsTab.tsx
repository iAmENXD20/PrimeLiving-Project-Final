import { useEffect, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { PhilippinePeso, QrCode, CreditCard, Upload, Trash2, Receipt, Eye, FileText, X, CheckCircle2, Clock, XCircle, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'
import { useTheme } from '../../context/ThemeContext'
import { getTenantPayments, getTenantDueSchedule, getClientPaymentQrUrl, getCurrentTenant, submitCashPaymentVerification, type TenantPayment, type TenantDueScheduleItem } from '../../lib/tenantApi'
import ConfirmationModal from '@/components/ui/ConfirmationModal'
import { TableSkeleton } from '@/components/ui/skeleton'
import TablePagination from '@/components/ui/table-pagination'

interface TenantPaymentsTabProps {
  tenantId: string
  clientId: string | null
  apartmentId: string | null
}

export default function TenantPaymentsTab({ tenantId, clientId, apartmentId }: TenantPaymentsTabProps) {
  const { isDark } = useTheme()
  const [payments, setPayments] = useState<TenantPayment[]>([])
  const [duePayments, setDuePayments] = useState<TenantDueScheduleItem[]>([])
  const [loading, setLoading] = useState(true)
  const [qrUrl, setQrUrl] = useState<string | null>(null)
  const [showQrModal, setShowQrModal] = useState(false)

  // Receipt upload state
  const RECEIPT_KEY = `receipt_${tenantId}`
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null)
  const [receiptUploading, setReceiptUploading] = useState(false)
  const [showReceiptModal, setShowReceiptModal] = useState(false)
  const [confirmReceiptDelete, setConfirmReceiptDelete] = useState(false)
  const receiptInputRef = useRef<HTMLInputElement>(null)
  const billingDropdownRef = useRef<HTMLDivElement>(null)

  // Payment form state
  const [tenantName, setTenantName] = useState('')
  const [selectedDuePaymentId, setSelectedDuePaymentId] = useState('')
  const [selectedPaymentMode, setSelectedPaymentMode] = useState<'gcash' | 'maya' | 'cash' | 'bank_transfer'>('gcash')
  const [isPaymentModeOpen, setIsPaymentModeOpen] = useState(false)
  const paymentModeRef = useRef<HTMLDivElement>(null)
  const [isBillingMenuOpen, setIsBillingMenuOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [duePage, setDuePage] = useState(1)
  const [historyPage, setHistoryPage] = useState(1)
  const pageSize = 10
  const [showGeneratedReceipt, setShowGeneratedReceipt] = useState(false)
  const [generatedReceipt, setGeneratedReceipt] = useState<{
    id: string
    date: string
    name: string
    mode: string
    periodFrom: string
    periodTo: string
    receiptImage?: string | null
  } | null>(null)

  async function refreshPaymentsAndDues() {
    const [paymentsResult, duesResult] = await Promise.allSettled([
      getTenantPayments(tenantId),
      getTenantDueSchedule(tenantId),
    ])

    if (paymentsResult.status === 'fulfilled') {
      setPayments(paymentsResult.value)
    }

    if (duesResult.status === 'fulfilled') {
      setDuePayments(duesResult.value)
    }
  }

  useEffect(() => {
    async function load() {
      try {
        const [paymentsResult, duesResult, qrResult, tenantResult] = await Promise.allSettled([
          getTenantPayments(tenantId),
          getTenantDueSchedule(tenantId),
          getClientPaymentQrUrl(clientId, apartmentId, tenantId),
          getCurrentTenant(),
        ])

        if (paymentsResult.status === 'fulfilled') {
          setPayments(paymentsResult.value)
        } else {
          console.error('Failed to load payments:', paymentsResult.reason)
          setPayments([])
        }

        if (duesResult.status === 'fulfilled') {
          setDuePayments(duesResult.value)
        } else {
          console.error('Failed to load due schedule:', duesResult.reason)
          setDuePayments([])
        }

        if (qrResult.status === 'fulfilled') {
          setQrUrl(qrResult.value)
        } else {
          console.error('Failed to load payment QR:', qrResult.reason)
          setQrUrl(null)
        }

        if (tenantResult.status === 'fulfilled' && tenantResult.value?.first_name) {
          setTenantName(`${tenantResult.value.first_name} ${tenantResult.value.last_name}`.trim())
        }

        // Load saved receipt
        const savedReceipt = localStorage.getItem(`receipt_${tenantId}`)
        if (savedReceipt) setReceiptUrl(savedReceipt)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [tenantId, clientId, apartmentId])

  useEffect(() => {
    const interval = setInterval(() => {
      refreshPaymentsAndDues().catch((error) => {
        console.error('Periodic payment sync failed:', error)
      })
    }, 300000)

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshPaymentsAndDues().catch((error) => {
          console.error('Visibility payment sync failed:', error)
        })
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [tenantId])

  const cardClass = `rounded-xl p-6 border ${
    isDark ? 'bg-navy-card border-[#1E293B]' : 'bg-white border-gray-200 shadow-sm'
  }`

  const totalPending = payments.filter(p => p.status === 'pending').reduce((sum, p) => sum + Number(p.amount), 0)
  const totalOverdue = payments.filter(p => p.status === 'overdue').reduce((sum, p) => sum + Number(p.amount), 0)
  const normalizedDuePayments = Array.from(
    new Map(
      duePayments
        .sort((a, b) => new Date(a.payment_date).getTime() - new Date(b.payment_date).getTime())
        .map((payment) => {
          const periodKey = payment.period_from
            ? payment.period_from.slice(0, 7)
            : new Date(payment.payment_date).toISOString().slice(0, 7)
          return [periodKey, payment]
        })
    ).values()
  )
  const dueTotalPages = Math.max(1, Math.ceil(normalizedDuePayments.length / pageSize))
  const paginatedDuePayments = normalizedDuePayments.slice((duePage - 1) * pageSize, duePage * pageSize)
  const historyTotalPages = Math.max(1, Math.ceil(payments.length / pageSize))
  const paginatedPayments = payments.slice((historyPage - 1) * pageSize, historyPage * pageSize)

  useEffect(() => {
    if (!selectedDuePaymentId && normalizedDuePayments.length > 0) {
      setSelectedDuePaymentId(normalizedDuePayments[0].id)
    }
  }, [normalizedDuePayments, selectedDuePaymentId])

  useEffect(() => {
    setDuePage(1)
    setHistoryPage(1)
  }, [payments.length, duePayments.length])

  useEffect(() => {
    if (duePage > dueTotalPages) setDuePage(dueTotalPages)
  }, [duePage, dueTotalPages])

  useEffect(() => {
    if (historyPage > historyTotalPages) setHistoryPage(historyTotalPages)
  }, [historyPage, historyTotalPages])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (billingDropdownRef.current && !billingDropdownRef.current.contains(event.target as Node)) {
        setIsBillingMenuOpen(false)
      }
      if (paymentModeRef.current && !paymentModeRef.current.contains(event.target as Node)) {
        setIsPaymentModeOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const statusColor = (s: string) => {
    switch (s) {
      case 'paid': return 'bg-emerald-500/15 text-emerald-400'
      case 'pending': return 'bg-yellow-500/15 text-yellow-400'
      case 'overdue': return 'bg-red-500/15 text-red-400'
      default: return 'bg-gray-500/15 text-gray-400'
    }
  }

  // Receipt upload handler
  const handleReceiptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File must be under 5MB')
      return
    }
    setReceiptUploading(true)
    try {
      const reader = new FileReader()
      reader.onload = () => {
        const dataUrl = reader.result as string
        localStorage.setItem(RECEIPT_KEY, dataUrl)
        setReceiptUrl(dataUrl)
        toast.success('Receipt uploaded successfully')
        setReceiptUploading(false)
      }
      reader.onerror = () => {
        toast.error('Failed to read file')
        setReceiptUploading(false)
      }
      reader.readAsDataURL(file)
    } catch {
      toast.error('Failed to upload receipt')
      setReceiptUploading(false)
    }
    if (receiptInputRef.current) receiptInputRef.current.value = ''
  }

  const handleReceiptDelete = () => {
    localStorage.removeItem(RECEIPT_KEY)
    setReceiptUrl(null)
    toast.success('Receipt removed')
  }

  const handleSubmitPayment = async () => {
    if (!selectedDuePaymentId) {
      toast.error('Please select a pending/overdue billing period')
      return
    }
    if (!receiptUrl) {
      toast.error('Please upload your payment receipt')
      return
    }

    const selectedDue = normalizedDuePayments.find((payment) => payment.id === selectedDuePaymentId)
    if (!selectedDue?.period_from || !selectedDue?.period_to) {
      toast.error('Selected billing period is invalid')
      return
    }

    if (!clientId) {
      toast.error('Tenant is not linked to an owner yet')
      return
    }

    // Generate local receipt for QR payment
    const receiptId = `PL-${Date.now().toString(36).toUpperCase()}`
    setSubmitting(true)
    try {
      await submitCashPaymentVerification({
        tenant_id: tenantId,
        apartmentowner_id: clientId,
        unit_id: apartmentId,
        amount: Number(selectedDue.amount || 0),
        receipt_url: receiptUrl,
        period_from: selectedDue.period_from,
        period_to: selectedDue.period_to,
        description: `Tenant payment proof submitted for ${selectedDue.period_from} to ${selectedDue.period_to}`,
        payment_mode: selectedPaymentMode,
      })

      await refreshPaymentsAndDues()
    } catch (error) {
      console.error('Failed to submit payment proof:', error)
      toast.error('Failed to submit payment proof')
      setSubmitting(false)
      return
    }

    const receipt = {
      id: receiptId,
      date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
      name: tenantName || 'Tenant',
      mode: 'QR Payment',
      periodFrom: new Date(selectedDue.period_from + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
      periodTo: new Date(selectedDue.period_to + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
      receiptImage: receiptUrl,
    }

    setGeneratedReceipt(receipt)
    setShowGeneratedReceipt(true)
    toast.success('Payment submitted! Receipt generated.')
    localStorage.removeItem(RECEIPT_KEY)
    setReceiptUrl(null)
    setSelectedDuePaymentId('')
    if (receiptInputRef.current) receiptInputRef.current.value = ''
    setSubmitting(false)
  }

  const currentDueSelection = normalizedDuePayments.find((payment) => payment.id === selectedDuePaymentId)
  const currentDueLabel = currentDueSelection
    ? currentDueSelection.period_from && currentDueSelection.period_to
      ? `${new Date(currentDueSelection.period_from).toLocaleDateString()} - ${new Date(currentDueSelection.period_to).toLocaleDateString()} · ₱${Number(currentDueSelection.amount).toLocaleString()} · ${currentDueSelection.status}`
      : `${new Date(currentDueSelection.payment_date).toLocaleDateString()} · ₱${Number(currentDueSelection.amount).toLocaleString()} · ${currentDueSelection.status}`
    : 'Select billing period'

  return (
    <div className="gap-6 animate-fade-up flex flex-col flex-1 min-h-0">
      <div>
        <h2 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Payments</h2>
        <p className={`text-base mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          View your payment history and balances
        </p>
      </div>

      {/* Summary Cards – Full Width */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className={cardClass}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-yellow-500/15 flex items-center justify-center">
              <PhilippinePeso className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Pending</p>
              <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>₱{totalPending.toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className={cardClass}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-500/15 flex items-center justify-center">
              <PhilippinePeso className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Overdue</p>
              <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>₱{totalOverdue.toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Middle Row: Payment QR (left) + Payment Information (right) */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-[2fr_3fr] items-stretch flex-1 min-h-0">
        {/* Left – Payment QR Code */}
        <div className={`${cardClass} flex flex-col`}>
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-lg bg-blue-500/15 flex items-center justify-center">
              <QrCode className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Payment QR
              </h3>
              <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                {qrUrl ? 'Scan to pay' : 'Not yet available'}
              </p>
            </div>
          </div>

          {qrUrl ? (
            <>
              <div className="flex justify-center">
                <div
                  onClick={() => setShowQrModal(true)}
                  className={`w-full aspect-square max-w-[320px] rounded-xl border-2 overflow-hidden cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg ${
                    isDark ? 'border-[#1E293B] bg-white' : 'border-gray-200 bg-white'
                  }`}
                >
                  <img
                    src={qrUrl}
                    alt="Payment QR Code"
                    className="w-full h-full object-contain p-3"
                  />
                </div>
              </div>
              <p className={`text-center text-xs mt-3 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                Tap to enlarge
              </p>
            </>
          ) : (
            <div className={`flex flex-col items-center justify-center flex-1 rounded-xl border-2 border-dashed ${
              isDark ? 'border-[#1E293B]' : 'border-gray-200'
            }`}>
              <QrCode className={`w-16 h-16 mb-4 ${isDark ? 'text-gray-600' : 'text-gray-300'}`} />
              <p className={`text-sm font-medium ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                No QR code uploaded
              </p>
              <p className={`text-xs mt-1 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
                Your landlord hasn't uploaded a payment QR yet
              </p>
            </div>
          )}
        </div>

        {/* Right – Payment Information */}
        <div className={`${cardClass} flex flex-col`}>
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-lg bg-purple-500/15 flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Payment Information
              </h3>
              <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                Fill in your payment details
              </p>
            </div>
          </div>

          <div className="space-y-4 flex-1">
            {/* Billing Period */}
            <div>
              <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                Billing Period (Pending/Overdue)
              </label>
              <div className="relative" ref={billingDropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsBillingMenuOpen((prev) => !prev)}
                  className={`w-full rounded-lg px-4 py-2.5 text-sm border transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-amber-500/40 flex items-center justify-between text-left ${
                    isDark
                      ? 'bg-[#0A1628] border-[#1E293B] text-white hover:border-[#2A3A52]'
                      : 'bg-gray-50 border-gray-200 text-gray-900 hover:border-gray-300'
                  }`}
                >
                  <span className="truncate pr-3">{currentDueLabel}</span>
                  <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isBillingMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {isBillingMenuOpen && (
                  <div
                    className={`absolute z-20 mt-2 w-full rounded-lg border shadow-xl max-h-64 overflow-y-auto animate-in fade-in zoom-in-95 duration-200 ${
                      isDark
                        ? 'bg-[#0A1628] border-[#1E293B]'
                        : 'bg-white border-gray-200'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedDuePaymentId('')
                        setIsBillingMenuOpen(false)
                      }}
                      className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                        isDark ? 'text-gray-300 hover:bg-white/5' : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      Select billing period
                    </button>
                    {normalizedDuePayments.map((payment) => {
                      const optionLabel = payment.period_from && payment.period_to
                        ? `${new Date(payment.period_from).toLocaleDateString()} - ${new Date(payment.period_to).toLocaleDateString()} · ₱${Number(payment.amount).toLocaleString()} · ${payment.status}`
                        : `${new Date(payment.payment_date).toLocaleDateString()} · ₱${Number(payment.amount).toLocaleString()} · ${payment.status}`

                      return (
                        <button
                          key={payment.id}
                          type="button"
                          onClick={() => {
                            setSelectedDuePaymentId(payment.id)
                            setIsBillingMenuOpen(false)
                          }}
                          className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-start justify-between gap-3 ${
                            selectedDuePaymentId === payment.id
                              ? isDark
                                ? 'bg-primary/20 text-white'
                                : 'bg-primary/10 text-gray-900'
                              : isDark
                                ? 'text-gray-300 hover:bg-white/5'
                                : 'text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          <span className="leading-5">{optionLabel}</span>
                          {selectedDuePaymentId === payment.id && (
                            <span className="mt-1 w-2 h-2 rounded-full bg-primary shrink-0" />
                          )}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Receipt Upload */}
              {/* Payment Mode Selector */}
              <div>
                <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Payment Mode
                </label>
                <div className="relative" ref={paymentModeRef}>
                  <button
                    type="button"
                    onClick={() => setIsPaymentModeOpen(!isPaymentModeOpen)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                      isDark
                        ? 'bg-[#111D32] border-[#1E293B] text-white hover:border-primary/40'
                        : 'bg-white border-gray-200 text-gray-900 hover:border-primary/40'
                    }`}
                  >
                    <span>{selectedPaymentMode === 'gcash' ? 'GCash' : selectedPaymentMode === 'maya' ? 'Maya' : selectedPaymentMode === 'cash' ? 'Cash' : 'Bank Transfer'}</span>
                    <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isPaymentModeOpen ? 'rotate-180' : ''}`} />
                  </button>
                  <div
                    className={`absolute left-0 top-full mt-1 z-50 w-full rounded-lg border shadow-lg overflow-hidden transition-all duration-200 origin-top ${
                      isPaymentModeOpen
                        ? 'opacity-100 scale-y-100'
                        : 'opacity-0 scale-y-0 pointer-events-none'
                    } ${isDark ? 'bg-[#111D32] border-[#1E293B]' : 'bg-white border-gray-200'}`}
                  >
                    {([['gcash', 'GCash'], ['maya', 'Maya'], ['cash', 'Cash'], ['bank_transfer', 'Bank Transfer']] as const).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => { setSelectedPaymentMode(value); setIsPaymentModeOpen(false) }}
                        className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                          value === selectedPaymentMode
                            ? 'bg-primary text-white font-medium'
                            : isDark ? 'text-gray-300 hover:bg-white/5' : 'text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className={`p-4 rounded-xl border-2 border-dashed ${isDark ? 'border-[#1E293B] bg-[#0A1628]' : 'border-gray-200 bg-gray-50'}`}>
                <div className="flex items-center gap-3 mb-3">
                  <Receipt className={`w-5 h-5 ${isDark ? 'text-emerald-400' : 'text-emerald-500'}`} />
                  <div>
                    <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Upload Receipt</p>
                    <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      Upload a photo of your payment receipt
                    </p>
                  </div>
                </div>

                <input
                  ref={receiptInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleReceiptUpload}
                  className="hidden"
                />

                {receiptUrl ? (
                  <div className="space-y-3">
                    <div
                      onClick={() => setShowReceiptModal(true)}
                      className={`relative w-full h-36 rounded-lg overflow-hidden cursor-pointer border transition-all hover:shadow-md ${
                        isDark ? 'border-[#1E293B]' : 'border-gray-200'
                      }`}
                    >
                      <img
                        src={receiptUrl}
                        alt="Payment Receipt"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                        <Eye className="w-6 h-6 text-white" />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => receiptInputRef.current?.click()}
                        disabled={receiptUploading}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-colors ${
                          isDark
                            ? 'bg-[#1E293B] text-gray-300 hover:bg-[#2a3a52]'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {receiptUploading && <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />}
                        <Upload className="w-3.5 h-3.5" /> Replace
                      </button>
                      <button
                        onClick={() => setConfirmReceiptDelete(true)}
                        className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => receiptInputRef.current?.click()}
                    disabled={receiptUploading}
                    className={`w-full flex flex-col items-center justify-center py-5 rounded-lg transition-colors ${
                      isDark ? 'hover:bg-white/[0.03]' : 'hover:bg-gray-100'
                    }`}
                  >
                    {receiptUploading ? (
                      <div className={`w-8 h-8 mb-2 border-2 border-current border-t-transparent rounded-full animate-spin ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                    ) : (
                      <Upload className={`w-8 h-8 mb-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                    )}
                    <p className={`text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      {receiptUploading ? 'Uploading...' : 'Upload Receipt'}
                    </p>
                    <p className={`text-xs mt-1 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
                      PNG, JPG up to 5MB
                    </p>
                  </button>
                )}
              </div>

            {/* Submit Button */}
            <button
              onClick={handleSubmitPayment}
              disabled={submitting}
              className={`w-full inline-flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-semibold text-white transition-colors shadow-sm ${
                submitting
                  ? 'bg-amber-400 cursor-not-allowed'
                  : 'bg-amber-500 hover:bg-amber-600'
              }`}
            >
              {submitting && <div className="w-4 h-4 border-2 border-white/90 border-t-transparent rounded-full animate-spin" />}
              {submitting ? 'Submitting...' : 'Submit Payment'}
            </button>
          </div>
        </div>
      </div>

      <div className={cardClass}>
        <h3 className={`text-xl font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
          Pending & Overdue Dues
        </h3>

        {normalizedDuePayments.length === 0 ? (
          <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            No pending or overdue dues.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className={`border-b ${isDark ? 'border-[#1E293B]' : 'border-gray-200'}`}>
                  {['Period', 'Due Date', 'Amount', 'Status'].map((header) => (
                    <th key={header} className={`text-left py-3 px-3 font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginatedDuePayments.map((payment) => (
                  <tr key={payment.id} className={`border-b last:border-0 ${isDark ? 'border-[#1E293B]' : 'border-gray-100'}`}>
                    <td className={`py-3 px-3 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      {payment.period_from && payment.period_to
                        ? `${new Date(payment.period_from).toLocaleDateString()} - ${new Date(payment.period_to).toLocaleDateString()}`
                        : '—'}
                    </td>
                    <td className={`py-3 px-3 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      {new Date(payment.payment_date).toLocaleDateString()}
                    </td>
                    <td className={`py-3 px-3 font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      ₱{Number(payment.amount).toLocaleString()}
                    </td>
                    <td className="py-3 px-3">
                      <span className={`inline-block px-2.5 py-0.5 text-xs font-medium rounded-full ${statusColor(payment.status)}`}>
                        {payment.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <TablePagination
          currentPage={duePage}
          totalPages={dueTotalPages}
          totalItems={normalizedDuePayments.length}
          pageSize={pageSize}
          onPageChange={setDuePage}
          isDark={isDark}
        />
      </div>

      {/* Payment History – Full Width Below */}
      <div className={cardClass}>
        <h3 className={`text-xl font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
          Payment History
        </h3>

        {loading && (
          <TableSkeleton rows={6} />
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-base">
            <thead>
              <tr className={`border-b ${isDark ? 'border-[#1E293B]' : 'border-gray-200'}`}>
                {['Date', 'Description', 'Amount', 'Mode', 'Status', 'Verification'].map((h) => (
                  <th key={h} className={`text-left py-3.5 px-4 font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {payments.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className={`py-8 text-center ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                    No payment records yet
                  </td>
                </tr>
              )}
              {paginatedPayments.map((p) => (
                <tr
                  key={p.id}
                  className={`border-b last:border-0 transition-colors ${
                    isDark ? 'border-[#1E293B] hover:bg-white/[0.02]' : 'border-gray-100 hover:bg-gray-50'
                  }`}
                >
                  <td className={`py-3.5 px-4 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                    {new Date(p.payment_date).toLocaleDateString()}
                  </td>
                  <td className={`py-3.5 px-4 font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {p.description || 'Monthly Rent'}
                  </td>
                  <td className={`py-3.5 px-4 font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    ₱{Number(p.amount).toLocaleString()}
                  </td>
                  <td className={`py-3.5 px-4 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                    {p.payment_mode === 'cash' ? 'Cash' : p.payment_mode === 'gcash' ? 'GCash' : p.payment_mode === 'maya' ? 'Maya' : p.payment_mode === 'bank_transfer' ? 'Bank Transfer' : '—'}
                  </td>
                  <td className="py-3.5 px-4">
                    {(() => {
                      const isWaitingVerification = p.verification_status === 'pending_verification'
                      const isAwaitingApproval = p.verification_status === 'verified'
                      const displayStatus = isWaitingVerification ? 'waiting verification' : isAwaitingApproval ? 'awaiting approval' : p.status
                      return (
                    <span className={`inline-block px-2.5 py-0.5 text-xs font-medium rounded-full ${statusColor(p.status)}`}>
                      {displayStatus}
                    </span>
                      )
                    })()}
                  </td>
                  <td className="py-3.5 px-4">
                    {p.verification_status === 'pending_verification' && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-medium rounded-full bg-yellow-500/15 text-yellow-400">
                        <Clock className="w-3 h-3" /> Pending Review
                      </span>
                    )}
                    {p.verification_status === 'verified' && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-medium rounded-full bg-amber-500/15 text-amber-400">
                        <Clock className="w-3 h-3" /> Awaiting Approval
                      </span>
                    )}
                    {p.verification_status === 'approved' && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-medium rounded-full bg-emerald-500/15 text-emerald-400">
                        <CheckCircle2 className="w-3 h-3" /> Approved
                      </span>
                    )}
                    {p.verification_status === 'rejected' && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-medium rounded-full bg-red-500/15 text-red-400">
                        <XCircle className="w-3 h-3" /> Rejected
                      </span>
                    )}
                    {!p.verification_status && (
                      <span className={`text-xs ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!loading && (
          <TablePagination
            currentPage={historyPage}
            totalPages={historyTotalPages}
            totalItems={payments.length}
            pageSize={pageSize}
            onPageChange={setHistoryPage}
            isDark={isDark}
          />
        )}

        <ConfirmationModal
          open={confirmReceiptDelete}
          isDark={isDark}
          title="Remove Uploaded Receipt?"
          description="This removes your currently uploaded proof image from local storage for this device."
          confirmText="Remove"
          onCancel={() => setConfirmReceiptDelete(false)}
          onConfirm={() => {
            handleReceiptDelete()
            setConfirmReceiptDelete(false)
          }}
        />
      </div>

      {/* QR Preview Modal */}
      {showQrModal && qrUrl && createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/65 animate-in fade-in duration-200"
          onClick={() => setShowQrModal(false)}
        >
          <div
            className={`rounded-2xl p-4 max-w-sm w-full mx-4 animate-in zoom-in-95 fade-in duration-200 ${isDark ? 'bg-[#111D32]' : 'bg-white'}`}
            onClick={(e) => e.stopPropagation()}
          >
            <h4 className={`text-lg font-semibold text-center mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Payment QR Code
            </h4>
            <div className="bg-white rounded-lg p-2">
              <img
                src={qrUrl}
                alt="Payment QR Code"
                className="w-full rounded-lg"
              />
            </div>
            <p className={`text-center text-sm mt-3 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              Scan this QR code to make your payment
            </p>
            <button
              onClick={() => setShowQrModal(false)}
              className={`mt-4 w-full py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isDark
                  ? 'bg-[#1E293B] text-white hover:bg-[#2a3a52]'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Close
            </button>
          </div>
        </div>,
        document.body
      )}


      {/* Receipt Preview Modal */}
      {showReceiptModal && receiptUrl && createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/65 animate-in fade-in duration-200"
          onClick={() => setShowReceiptModal(false)}
        >
          <div
            className={`rounded-2xl p-4 max-w-md w-full mx-4 animate-in zoom-in-95 fade-in duration-200 ${isDark ? 'bg-[#111D32]' : 'bg-white'}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h4 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Payment Receipt
              </h4>
              <button onClick={() => setShowReceiptModal(false)} className={`p-1 rounded-lg transition-colors ${isDark ? 'hover:bg-white/10' : 'hover:bg-gray-100'}`}>
                <X className={`w-5 h-5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
              </button>
            </div>
            <div className={`rounded-lg overflow-hidden border ${isDark ? 'border-[#1E293B]' : 'border-gray-200'}`}>
              <img src={receiptUrl} alt="Payment Receipt" className="w-full rounded-lg" />
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Generated Receipt Modal */}
      {showGeneratedReceipt && generatedReceipt && createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/65 animate-in fade-in duration-200"
          onClick={() => setShowGeneratedReceipt(false)}
        >
          <div
            className={`rounded-2xl p-6 max-w-md w-full mx-4 animate-in zoom-in-95 fade-in duration-200 ${isDark ? 'bg-[#111D32]' : 'bg-white'}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/15 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-emerald-400" />
                </div>
                <h4 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  Payment Receipt
                </h4>
              </div>
              <button onClick={() => setShowGeneratedReceipt(false)} className={`p-1 rounded-lg transition-colors ${isDark ? 'hover:bg-white/10' : 'hover:bg-gray-100'}`}>
                <X className={`w-5 h-5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
              </button>
            </div>

            {/* Receipt Content */}
            <div className={`rounded-xl p-5 space-y-4 border ${isDark ? 'bg-[#0A1628] border-[#1E293B]' : 'bg-gray-50 border-gray-200'}`}>
              <div className="text-center pb-4 border-b border-dashed ${isDark ? 'border-[#1E293B]' : 'border-gray-200'}">
                <p className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Payment Confirmation</p>
                <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}></p>
              </div>

              <div className="grid grid-cols-2 gap-y-3 gap-x-4">
                <div>
                  <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Receipt No.</p>
                  <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{generatedReceipt.id}</p>
                </div>
                <div>
                  <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Date</p>
                  <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{generatedReceipt.date}</p>
                </div>
                <div>
                  <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Name</p>
                  <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{generatedReceipt.name}</p>
                </div>
                <div>
                  <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Payment Mode</p>
                  <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{generatedReceipt.mode}</p>
                </div>
                <div className="col-span-2">
                  <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Payment Period</p>
                  <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {generatedReceipt.periodFrom} — {generatedReceipt.periodTo}
                  </p>
                </div>
              </div>

              {generatedReceipt.receiptImage && (
                <div>
                  <p className={`text-xs mb-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>QR Payment Receipt</p>
                  <div className={`rounded-lg overflow-hidden border h-32 ${isDark ? 'border-[#1E293B]' : 'border-gray-200'}`}>
                    <img src={generatedReceipt.receiptImage} alt="QR Receipt" className="w-full h-full object-cover" />
                  </div>
                </div>
              )}

              <div className={`text-center pt-3 border-t border-dashed ${isDark ? 'border-[#1E293B]' : 'border-gray-200'}`}>
                <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                  Thank you for your payment!
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowGeneratedReceipt(false)}
              className={`mt-4 w-full py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isDark
                  ? 'bg-[#1E293B] text-white hover:bg-[#2a3a52]'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Close
            </button>
          </div>
        </div>,
        document.body
      )}

    </div>
  )
}
