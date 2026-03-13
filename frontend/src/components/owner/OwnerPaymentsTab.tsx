import { useEffect, useState, useRef, useMemo } from 'react'
import { Search, PhilippinePeso, Upload, Trash2, QrCode, Image as ImageIcon, Eye, ChevronDown } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { useTheme } from '../../context/ThemeContext'
import { toast } from 'sonner'
import {
  getOwnerPayments,
  uploadPaymentQr,
  getPaymentQrUrl,
  deletePaymentQr,
  updateOwnerPaymentStatus,
  type OwnerPayment,
} from '../../lib/ownerApi'

interface OwnerPaymentsTabProps {
  clientId: string
}

const STATUS_OPTIONS = ['all', 'paid', 'pending', 'overdue'] as const
type StatusFilter = (typeof STATUS_OPTIONS)[number]

const statusBadge: Record<OwnerPayment['status'], { bg: string; text: string }> = {
  paid: { bg: 'bg-green-400/15', text: 'text-green-500' },
  pending: { bg: 'bg-yellow-400/15', text: 'text-yellow-500' },
  overdue: { bg: 'bg-red-400/15', text: 'text-red-400' },
}

export default function OwnerPaymentsTab({ clientId }: OwnerPaymentsTabProps) {
  const { isDark } = useTheme()
  const [payments, setPayments] = useState<OwnerPayment[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<StatusFilter>('all')

  // QR state
  const [qrUrl, setQrUrl] = useState<string | null>(null)
  const [qrUploading, setQrUploading] = useState(false)
  const [showQrPreview, setShowQrPreview] = useState(false)
  const qrInputRef = useRef<HTMLInputElement>(null)

  // Filter dropdown
  const [filterDropdownOpen, setFilterDropdownOpen] = useState(false)
  const filterDropdownRef = useRef<HTMLDivElement>(null)

  // Revenue chart year
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [yearDropdownOpen, setYearDropdownOpen] = useState(false)
  const yearDropdownRef = useRef<HTMLDivElement>(null)

  async function load() {
    try {
      const data = await getOwnerPayments(clientId)

      // Auto-update: mark pending payments past due date as overdue
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const overdueUpdates: Promise<void>[] = []
      for (const p of data) {
        if (p.status === 'pending' && new Date(p.payment_date) < today) {
          p.status = 'overdue'
          overdueUpdates.push(updateOwnerPaymentStatus(p.id, 'overdue'))
        }
      }
      if (overdueUpdates.length > 0) {
        await Promise.allSettled(overdueUpdates)
      }

      setPayments(data)
      const currentQrUrl = await getPaymentQrUrl(clientId)
      setQrUrl(currentQrUrl)
    } catch (err) {
      console.error('Failed to load payments:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [clientId])

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (yearDropdownRef.current && !yearDropdownRef.current.contains(e.target as Node)) {
        setYearDropdownOpen(false)
      }
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(e.target as Node)) {
        setFilterDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function handleQrUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be under 5MB')
      return
    }
    setQrUploading(true)
    try {
      const url = await uploadPaymentQr(clientId, file)
      setQrUrl(url)
      toast.success('Payment QR code uploaded successfully')
    } catch (err: any) {
      console.error('Failed to upload QR:', err)
      toast.error(err?.message || 'Failed to upload QR code')
    } finally {
      setQrUploading(false)
      if (qrInputRef.current) qrInputRef.current.value = ''
    }
  }

  async function handleQrDelete() {
    try {
      await deletePaymentQr(clientId)
      setQrUrl(null)
      toast.success('Payment QR code removed')
    } catch (err: any) {
      toast.error(err?.message || 'Failed to remove QR code')
    }
  }

  const filtered = payments.filter((p) => {
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

  // Current month payments
  const now = new Date()
  const currentMonth = now.getMonth()
  const currentYear = now.getFullYear()
  const monthlyPayments = payments.filter((p) => {
    const d = new Date(p.payment_date)
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear
  })

  const totalRevenue = monthlyPayments
    .filter((p) => p.status === 'paid')
    .reduce((sum, p) => sum + Number(p.amount), 0)

  const paidCount = monthlyPayments.filter((p) => p.status === 'paid').length
  const notPaidCount = monthlyPayments.filter((p) => p.status !== 'paid').length

  const monthLabel = now.toLocaleString('default', { month: 'long', year: 'numeric' })

  // Revenue trend – 12 months of selected year
  const revenueTrend = useMemo(() => {
    const months: { month: string; paid: number; unpaid: number }[] = []
    for (let m = 0; m < 12; m++) {
      const d = new Date(selectedYear, m, 1)
      const label = d.toLocaleString('default', { month: 'short' })
      const monthPayments = payments.filter((p) => {
        const pd = new Date(p.payment_date)
        return pd.getMonth() === m && pd.getFullYear() === selectedYear
      })
      const paid = monthPayments
        .filter((p) => p.status === 'paid')
        .reduce((s, p) => s + Number(p.amount), 0)
      const unpaid = monthPayments
        .filter((p) => p.status !== 'paid')
        .reduce((s, p) => s + Number(p.amount), 0)
      months.push({ month: label, paid, unpaid })
    }
    return months
  }, [payments, selectedYear])

  // Available years: current year and 4 years back, plus any from payment data
  const availableYears = useMemo(() => {
    const thisYear = new Date().getFullYear()
    const years = new Set<number>()
    for (let i = 0; i < 5; i++) years.add(thisYear - i)
    payments.forEach((p) => years.add(new Date(p.payment_date).getFullYear()))
    return Array.from(years).sort((a, b) => b - a)
  }, [payments])

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Header */}
      <div>
        <h2 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Payments</h2>
        <p className={`text-base mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          Monitor tenant rent payment records and history
        </p>
      </div>

      {/* Search + Filter */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
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
        <div className="relative w-full sm:w-auto" ref={filterDropdownRef}>
          <button
            onClick={() => setFilterDropdownOpen(!filterDropdownOpen)}
            className={`w-full sm:w-auto flex items-center justify-between sm:justify-start gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border transition-all ${
              isDark
                ? 'bg-[#111D32] border-[#1E293B] text-white hover:border-primary/40'
                : 'bg-white border-gray-200 text-gray-900 hover:border-primary/40'
            }`}
          >
            <span className="capitalize">{filter}</span>
            <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${filterDropdownOpen ? 'rotate-180' : ''}`} />
          </button>
          <div
            className={`absolute left-0 sm:left-auto sm:right-0 top-full mt-1 z-20 w-full sm:min-w-[120px] rounded-lg border shadow-lg overflow-hidden transition-all duration-200 origin-top ${
              filterDropdownOpen
                ? 'opacity-100 scale-y-100'
                : 'opacity-0 scale-y-0 pointer-events-none'
            } ${isDark ? 'bg-[#111D32] border-[#1E293B]' : 'bg-white border-gray-200'}`}
          >
            {STATUS_OPTIONS.map((s) => (
              <button
                key={s}
                onClick={() => {
                  setFilter(s)
                  setFilterDropdownOpen(false)
                }}
                className={`w-full text-left px-4 py-2 text-sm transition-colors capitalize ${
                  s === filter
                    ? 'bg-primary text-white font-medium'
                    : isDark
                    ? 'text-gray-300 hover:bg-white/5'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className={`text-center py-8 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Loading payments…</div>
      )}

      {/* Table */}
      {!loading && (
        <div className={`${cardClass} flex flex-col`} style={{ height: '480px' }}>
          {/* Fixed header */}
          <div className="overflow-x-auto flex-shrink-0">
            <table className="w-full text-base">
              <thead>
                <tr className={`border-b ${isDark ? 'border-[#1E293B]' : 'border-gray-200'}`}>
                  {['Names', 'Unit', 'Amount', 'Date', 'Status', 'Description', ''].map((h) => (
                    <th key={h} className={`text-left py-3 px-4 font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
            </table>
          </div>
          {/* Scrollable body */}
          <div className="overflow-y-auto overflow-x-auto flex-1">
            {filtered.length > 0 ? (
            <table className="w-full text-base">
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
            </tbody>
          </table>
            ) : (
              <div className={`flex flex-col items-center justify-center h-full ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                {payments.length === 0 ? (
                  <>
                    <PhilippinePeso className={`w-12 h-12 mb-3 ${isDark ? 'text-gray-600' : 'text-gray-300'}`} />
                    <p className="text-lg font-medium">No payment records yet</p>
                  </>
                ) : (
                  <p className="text-lg font-medium">No matching payments</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
          Showing {filtered.length} of {payments.length} payments
        </p>
      )}

      {/* QR Code + Stats Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Payment QR Code Section */}
        <div className={`${cardClass} p-5`}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-blue-500/15 flex items-center justify-center">
              <QrCode className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Payment QR Code
              </h3>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                Upload your payment QR code so tenants can scan it for payments
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 items-start">
            {/* QR Preview */}
            {qrUrl ? (
              <div className="relative group">
                <div
                  onClick={() => setShowQrPreview(true)}
                  className={`w-56 h-56 rounded-xl border-2 border-dashed overflow-hidden cursor-pointer transition-all hover:scale-[1.02] ${
                    isDark ? 'border-[#1E293B] bg-[#0A1628]' : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  <img
                    src={qrUrl}
                    alt="Payment QR Code"
                    className="w-full h-full object-contain p-2"
                  />
                </div>
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => qrInputRef.current?.click()}
                    disabled={qrUploading}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      isDark
                        ? 'bg-[#111D32] text-gray-300 hover:bg-[#1E293B] border border-[#1E293B]'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200'
                    }`}
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Replace
                  </button>
                  <button
                    onClick={handleQrDelete}
                    className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-400 transition-colors bg-red-500/10 hover:bg-red-500/20"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => qrInputRef.current?.click()}
                disabled={qrUploading}
                className={`w-56 h-56 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-3 transition-all hover:scale-[1.02] ${
                  isDark
                    ? 'border-[#1E293B] bg-[#0A1628] hover:border-primary/50 text-gray-500'
                    : 'border-gray-200 bg-gray-50 hover:border-primary/50 text-gray-400'
                } ${qrUploading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                {qrUploading ? (
                  <>
                    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    <span className="text-xs">Uploading…</span>
                  </>
                ) : (
                  <>
                    <ImageIcon className="w-8 h-8" />
                    <span className="text-xs font-medium text-center px-2">Upload QR</span>
                  </>
                )}
              </button>
            )}

            <input
              ref={qrInputRef}
              type="file"
              accept="image/*"
              onChange={handleQrUpload}
              className="hidden"
            />

            {/* Info */}
            <div className={`flex-1 text-sm space-y-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              <p>• Upload a clear screenshot of your payment QR code</p>
              <p>• Supports JPG, PNG, or WEBP (max 5MB)</p>
              <p>• Tenants will see this QR code in their Payments section</p>
              {qrUrl && (
                <p className="text-emerald-400 font-medium mt-2">
                  ✓ QR code is visible to your tenants
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Stats Column */}
        <div className="grid grid-cols-1 gap-4">
          {/* Total Revenue */}
          <div className={`${cardClass} p-5 flex items-center gap-4`}>
            <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center">
              <PhilippinePeso className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className={`text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Total Revenue</p>
              <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                ₱{totalRevenue.toLocaleString()}
              </p>
              <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{monthLabel}</p>
            </div>
          </div>

          {/* Paid */}
          <div className={`${cardClass} p-5 flex items-center gap-4`}>
            <div className="w-12 h-12 rounded-xl bg-green-500/15 flex items-center justify-center">
              <PhilippinePeso className="w-6 h-6 text-green-500" />
            </div>
            <div>
              <p className={`text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Paid</p>
              <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{paidCount}</p>
              <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{monthLabel}</p>
            </div>
          </div>

          {/* Not Paid */}
          <div className={`${cardClass} p-5 flex items-center gap-4`}>
            <div className="w-12 h-12 rounded-xl bg-red-500/15 flex items-center justify-center">
              <PhilippinePeso className="w-6 h-6 text-red-400" />
            </div>
            <div>
              <p className={`text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Not Paid</p>
              <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{notPaidCount}</p>
              <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{monthLabel}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Monthly Revenue Trend */}
      <div className={`${cardClass} p-6`}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Revenue Overview
            </h3>
            <p className={`text-sm mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              Monthly paid vs unpaid breakdown
            </p>
          </div>
          <div className="relative" ref={yearDropdownRef}>
            <button
              onClick={() => setYearDropdownOpen(!yearDropdownOpen)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                isDark
                  ? 'bg-[#111D32] border-[#1E293B] text-white hover:border-primary/40'
                  : 'bg-gray-50 border-gray-200 text-gray-900 hover:border-primary/40'
              }`}
            >
              {selectedYear}
              <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${yearDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            <div
              className={`absolute right-0 top-full mt-1 z-20 rounded-lg border shadow-lg overflow-hidden transition-all duration-200 origin-top ${
                yearDropdownOpen
                  ? 'opacity-100 scale-y-100'
                  : 'opacity-0 scale-y-0 pointer-events-none'
              } ${isDark ? 'bg-[#111D32] border-[#1E293B]' : 'bg-white border-gray-200'}`}
            >
              {availableYears.map((y) => (
                <button
                  key={y}
                  onClick={() => {
                    setSelectedYear(y)
                    setYearDropdownOpen(false)
                  }}
                  className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                    y === selectedYear
                      ? 'bg-primary text-white font-medium'
                      : isDark
                      ? 'text-gray-300 hover:bg-white/5'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {y}
                </button>
              ))}
            </div>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={revenueTrend} barCategoryGap="20%">
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={isDark ? '#1E293B' : '#e5e7eb'}
              vertical={false}
            />
            <XAxis
              dataKey="month"
              tick={{ fill: isDark ? '#94a3b8' : '#6b7280', fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: isDark ? '#94a3b8' : '#6b7280', fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => `₱${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: isDark ? '#111D32' : '#fff',
                border: `1px solid ${isDark ? '#1E293B' : '#e5e7eb'}`,
                borderRadius: 12,
                padding: '12px 16px',
                color: isDark ? '#fff' : '#1e293b',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              }}
              formatter={(value: any, name: any) => [
                `₱${Number(value).toLocaleString()}`,
                name === 'paid' ? 'Paid' : 'Unpaid',
              ]}
              labelStyle={{ color: isDark ? '#94a3b8' : '#6b7280' }}
            />
            <Bar dataKey="paid" fill="#059669" radius={[4, 4, 0, 0]} name="paid" />
            <Bar dataKey="unpaid" fill="#EF4444" radius={[4, 4, 0, 0]} name="unpaid" />
          </BarChart>
        </ResponsiveContainer>
        <div className="flex justify-center gap-6 mt-3">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm bg-primary" />
            <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Paid</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm bg-red-500" />
            <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Unpaid</span>
          </div>
        </div>
      </div>

      {/* QR Preview Modal */}
      {showQrPreview && qrUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setShowQrPreview(false)}
        >
          <div
            className={`rounded-2xl p-4 max-w-sm w-full mx-4 ${isDark ? 'bg-[#111D32]' : 'bg-white'}`}
            onClick={(e) => e.stopPropagation()}
          >
            <h4 className={`text-lg font-semibold text-center mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Payment QR Code
            </h4>
            <img
              src={qrUrl}
              alt="Payment QR Code"
              className="w-full rounded-lg"
            />
            <button
              onClick={() => setShowQrPreview(false)}
              className={`mt-4 w-full py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isDark
                  ? 'bg-[#1E293B] text-white hover:bg-[#2a3a52]'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
