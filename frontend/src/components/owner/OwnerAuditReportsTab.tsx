import { useState, useEffect, useMemo } from 'react'
import { useTheme } from '../../context/ThemeContext'
import { getOwnerPayments, type OwnerPayment } from '../../lib/ownerApi'
import { PhilippinePeso, TrendingUp, Calendar, Download, ChevronDown } from 'lucide-react'
import { TableSkeleton } from '@/components/ui/skeleton'

interface OwnerAuditReportsTabProps {
  ownerId: string
}

type PeriodMode = 'monthly' | 'quarterly' | 'annually'

interface RevenueRow {
  label: string
  totalRevenue: number
  paidCount: number
  pendingAmount: number
  pendingCount: number
}

const QUARTER_LABELS: Record<number, string> = {
  1: 'Q1 (Jan–Mar)',
  2: 'Q2 (Apr–Jun)',
  3: 'Q3 (Jul–Sep)',
  4: 'Q4 (Oct–Dec)',
}

function isPaid(p: OwnerPayment) {
  return p.status === 'paid' || p.verification_status === 'verified' || p.verification_status === 'approved'
}

function isPending(p: OwnerPayment) {
  return p.status === 'pending' || p.status === 'overdue'
}

export default function OwnerAuditReportsTab({ ownerId }: OwnerAuditReportsTabProps) {
  const { isDark } = useTheme()
  const [payments, setPayments] = useState<OwnerPayment[]>([])
  const [loading, setLoading] = useState(true)
  const [periodMode, setPeriodMode] = useState<PeriodMode>('monthly')
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [isYearOpen, setIsYearOpen] = useState(false)

  useEffect(() => {
    setLoading(true)
    getOwnerPayments(ownerId)
      .then(setPayments)
      .catch(() => setPayments([]))
      .finally(() => setLoading(false))
  }, [ownerId])

  const availableYears = useMemo(() => {
    const years = new Set<number>()
    years.add(new Date().getFullYear())
    payments.forEach(p => years.add(new Date(p.payment_date).getFullYear()))
    return Array.from(years).sort((a, b) => b - a)
  }, [payments])

  const revenueRows = useMemo((): RevenueRow[] => {
    const yearPayments = payments.filter(p => new Date(p.payment_date).getFullYear() === selectedYear)

    if (periodMode === 'monthly') {
      return Array.from({ length: 12 }, (_, i) => {
        const monthPayments = yearPayments.filter(p => new Date(p.payment_date).getMonth() === i)
        const paid = monthPayments.filter(isPaid)
        const pending = monthPayments.filter(isPending)
        return {
          label: new Date(selectedYear, i).toLocaleString('default', { month: 'long' }),
          totalRevenue: paid.reduce((sum, p) => sum + Number(p.amount), 0),
          paidCount: paid.length,
          pendingAmount: pending.reduce((sum, p) => sum + Number(p.amount), 0),
          pendingCount: pending.length,
        }
      })
    }

    if (periodMode === 'quarterly') {
      return [1, 2, 3, 4].map(q => {
        const startMonth = (q - 1) * 3
        const qPayments = yearPayments.filter(p => {
          const m = new Date(p.payment_date).getMonth()
          return m >= startMonth && m < startMonth + 3
        })
        const paid = qPayments.filter(isPaid)
        const pending = qPayments.filter(isPending)
        return {
          label: QUARTER_LABELS[q],
          totalRevenue: paid.reduce((sum, p) => sum + Number(p.amount), 0),
          paidCount: paid.length,
          pendingAmount: pending.reduce((sum, p) => sum + Number(p.amount), 0),
          pendingCount: pending.length,
        }
      })
    }

    // annually — last 5 years
    const currentYear = new Date().getFullYear()
    return Array.from({ length: 5 }, (_, i) => {
      const year = currentYear - i
      const yPayments = payments.filter(p => new Date(p.payment_date).getFullYear() === year)
      const paid = yPayments.filter(isPaid)
      const pending = yPayments.filter(isPending)
      return {
        label: String(year),
        totalRevenue: paid.reduce((sum, p) => sum + Number(p.amount), 0),
        paidCount: paid.length,
        pendingAmount: pending.reduce((sum, p) => sum + Number(p.amount), 0),
        pendingCount: pending.length,
      }
    })
  }, [payments, periodMode, selectedYear])

  const totalRevenue = revenueRows.reduce((sum, r) => sum + r.totalRevenue, 0)
  const totalPending = revenueRows.reduce((sum, r) => sum + r.pendingAmount, 0)
  const totalTransactions = revenueRows.reduce((sum, r) => sum + r.paidCount, 0)
  const totalPendingCount = revenueRows.reduce((sum, r) => sum + r.pendingCount, 0)

  const cardClass = `rounded-2xl border ${isDark ? 'bg-[#111D32] border-[#1E293B]' : 'bg-white border-gray-200'}`

  const handleExport = () => {
    const headers = ['Period', 'Revenue (₱)', 'Paid Transactions', 'Pending (₱)', 'Pending Count']
    const rows = revenueRows.map(r => [r.label, r.totalRevenue, r.paidCount, r.pendingAmount, r.pendingCount])
    rows.push(['', '', '', '', ''] as any)
    rows.push(['TOTAL', totalRevenue, totalTransactions, totalPending, totalPendingCount] as any)

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Revenue_Report_${periodMode}_${selectedYear}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Audit Reports</h2>
          <p className={`text-base mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            Revenue overview and tax reporting
          </p>
        </div>
        <button
          onClick={handleExport}
          disabled={loading}
          className={`flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-medium border transition-all ${
            isDark
              ? 'bg-[#111D32] border-[#1E293B] text-white hover:border-primary/40'
              : 'bg-gray-50 border-gray-200 text-gray-900 hover:border-primary/40'
          } disabled:opacity-50`}
        >
          <Download className="w-3.5 h-3.5" />
          Export CSV
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Total Revenue', value: `₱${totalRevenue.toLocaleString()}`, icon: PhilippinePeso, color: 'text-emerald-400', bg: 'bg-emerald-500/15' },
          { label: 'Pending Collection', value: `₱${totalPending.toLocaleString()}`, icon: Calendar, color: 'text-amber-400', bg: 'bg-amber-500/15' },
          { label: 'Paid Transactions', value: String(totalTransactions), icon: TrendingUp, color: 'text-blue-400', bg: 'bg-blue-500/15' },
        ].map(card => (
          <div key={card.label} className={`${cardClass} p-5`}>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl ${card.bg} flex items-center justify-center`}>
                <card.icon className={`w-5 h-5 ${card.color}`} />
              </div>
              <div>
                <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{card.label}</p>
                <p className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{card.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Period Controls */}
      <div className={`${cardClass} p-4`}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className={`inline-flex rounded-lg border ${isDark ? 'border-[#1E293B]' : 'border-gray-200'}`}>
            {(['monthly', 'quarterly', 'annually'] as PeriodMode[]).map(mode => (
              <button
                key={mode}
                onClick={() => setPeriodMode(mode)}
                className={`px-4 py-2 text-sm font-medium transition-colors first:rounded-l-lg last:rounded-r-lg ${
                  periodMode === mode
                    ? 'bg-primary text-white'
                    : isDark
                      ? 'text-gray-400 hover:bg-white/5'
                      : 'text-gray-500 hover:bg-gray-50'
                }`}
              >
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>

          {periodMode !== 'annually' && (
            <div className="relative">
              <button
                onClick={() => setIsYearOpen(!isYearOpen)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                  isDark
                    ? 'bg-[#0A1628] border-[#1E293B] text-white hover:border-primary/40'
                    : 'bg-white border-gray-200 text-gray-900 hover:border-primary/40'
                }`}
              >
                {selectedYear}
                <ChevronDown className={`w-4 h-4 transition-transform ${isYearOpen ? 'rotate-180' : ''}`} />
              </button>
              {isYearOpen && (
                <div className={`absolute right-0 top-full mt-1 z-20 rounded-lg border shadow-lg overflow-hidden ${
                  isDark ? 'bg-[#111D32] border-[#1E293B]' : 'bg-white border-gray-200'
                }`}>
                  {availableYears.map(y => (
                    <button
                      key={y}
                      onClick={() => { setSelectedYear(y); setIsYearOpen(false) }}
                      className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                        y === selectedYear
                          ? 'bg-primary text-white font-medium'
                          : isDark ? 'text-gray-300 hover:bg-white/5' : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {y}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Revenue Table */}
      {loading ? (
        <div className={cardClass}>
          <TableSkeleton rows={6} />
        </div>
      ) : (
        <div className={`${cardClass} overflow-x-auto`}>
          <table className="w-full text-base">
            <thead>
              <tr className={`border-b ${isDark ? 'border-[#1E293B]' : 'border-gray-200'}`}>
                {['Period', 'Revenue', 'Paid', 'Pending', 'Pending Count'].map(h => (
                  <th key={h} className={`text-left py-3 px-5 font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {revenueRows.map(row => {
                const hasData = row.totalRevenue > 0 || row.pendingAmount > 0
                return (
                  <tr key={row.label} className={`border-b last:border-0 ${isDark ? 'border-[#1E293B]' : 'border-gray-100'}`}>
                    <td className={`py-3 px-5 font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{row.label}</td>
                    <td className={`py-3 px-5 font-semibold ${hasData ? 'text-emerald-400' : isDark ? 'text-gray-600' : 'text-gray-300'}`}>
                      ₱{row.totalRevenue.toLocaleString()}
                    </td>
                    <td className={`py-3 px-5 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{row.paidCount}</td>
                    <td className={`py-3 px-5 ${row.pendingAmount > 0 ? 'text-amber-400 font-medium' : isDark ? 'text-gray-600' : 'text-gray-300'}`}>
                      ₱{row.pendingAmount.toLocaleString()}
                    </td>
                    <td className={`py-3 px-5 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{row.pendingCount}</td>
                  </tr>
                )
              })}
              {/* Totals row */}
              <tr className={`border-t-2 ${isDark ? 'border-[#1E293B] bg-[#0A1628]' : 'border-gray-200 bg-gray-50'}`}>
                <td className={`py-3 px-5 font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>TOTAL</td>
                <td className="py-3 px-5 font-bold text-emerald-400">₱{totalRevenue.toLocaleString()}</td>
                <td className={`py-3 px-5 font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{totalTransactions}</td>
                <td className={`py-3 px-5 font-bold ${totalPending > 0 ? 'text-amber-400' : isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                  ₱{totalPending.toLocaleString()}
                </td>
                <td className={`py-3 px-5 font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{totalPendingCount}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
