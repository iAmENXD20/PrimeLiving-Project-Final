import { useState, useEffect, useRef, useCallback } from 'react'
import { useTheme } from '../../context/ThemeContext'
import {
  getTenantPayments,
  getTenantMaintenanceRequests,
  type TenantPayment,
  type TenantMaintenanceRequest,
} from '../../lib/tenantApi'
import { Download, FileText, PhilippinePeso, Wrench, ChevronLeft, ChevronRight } from 'lucide-react'
import { TableSkeleton } from '@/components/ui/skeleton'

interface TenantReportsTabProps {
  tenantId: string
  ownerId: string | null
  apartmentId: string | null
}

type ReportSection = 'payments' | 'maintenance'

const ROWS_PER_PAGE = 15

export default function TenantReportsTab({ tenantId, ownerId, apartmentId }: TenantReportsTabProps) {
  const { isDark } = useTheme()
  const [section, setSection] = useState<ReportSection>('payments')
  const [payments, setPayments] = useState<TenantPayment[]>([])
  const [maintenance, setMaintenance] = useState<TenantMaintenanceRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [payPage, setPayPage] = useState(1)
  const [maintPage, setMaintPage] = useState(1)
  const loadVersion = useRef(0)

  const loadData = useCallback(() => {
    const version = ++loadVersion.current
    setLoading(true)
    Promise.all([
      getTenantPayments(tenantId, { skipCache: true }),
      getTenantMaintenanceRequests(tenantId, { skipCache: true }),
    ])
      .then(([pay, maint]) => {
        if (loadVersion.current !== version) return
        setPayments(pay)
        setMaintenance(maint)
      })
      .catch(() => {
        if (loadVersion.current !== version) return
        setPayments([]); setMaintenance([])
      })
      .finally(() => { if (loadVersion.current === version) setLoading(false) })
  }, [tenantId])

  useEffect(() => { loadData() }, [loadData])

  const cardClass = `rounded-2xl border ${isDark ? 'bg-[#111D32] border-[#1E293B]' : 'bg-white border-gray-200'}`
  const today = new Date().toISOString().slice(0, 10)

  // ── Export helpers ──────────────────────────────────────
  function downloadCSV(headers: string[], rows: (string | number)[][], filename: string) {
    const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = filename; a.click()
    URL.revokeObjectURL(url)
  }

  async function downloadExcel(headers: string[], rows: (string | number)[][], filename: string) {
    const XLSX = await import('xlsx')
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Report')
    XLSX.writeFile(wb, filename)
  }

  async function downloadPDF(title: string, subtitle: string, head: string[], body: (string | number)[][], filename: string) {
    const { default: jsPDF } = await import('jspdf')
    const autoTable = (await import('jspdf-autotable')).default
    const doc = new jsPDF()
    doc.setFontSize(18)
    doc.text(title, 14, 20)
    doc.setFontSize(11)
    doc.text(subtitle, 14, 28)
    autoTable(doc, { startY: 36, head: [head], body, styles: { fontSize: 9 } })
    doc.save(filename)
  }

  // ── Payment export actions ─────────────────────────────
  function exportPayCSV() {
    const headers = ['No.', 'Amount (₱)', 'Date', 'Mode', 'Status', 'Period From', 'Period To', 'Description']
    const rows = payments.map((p, i) => [
      i + 1, Number(p.amount),
      new Date(p.payment_date).toLocaleDateString(),
      p.payment_mode?.replace('_', ' ') || '—',
      p.status,
      p.period_from ? new Date(p.period_from).toLocaleDateString() : '—',
      p.period_to ? new Date(p.period_to).toLocaleDateString() : '—',
      p.description || '—',
    ] as (string | number)[])
    downloadCSV(headers, rows, `My_Payment_History_${today}.csv`)
  }

  function exportPayExcel() {
    const headers = ['No.', 'Amount (₱)', 'Date', 'Mode', 'Status', 'Period From', 'Period To', 'Description']
    const rows = payments.map((p, i) => [
      i + 1, Number(p.amount),
      new Date(p.payment_date).toLocaleDateString(),
      p.payment_mode?.replace('_', ' ') || '—',
      p.status,
      p.period_from ? new Date(p.period_from).toLocaleDateString() : '—',
      p.period_to ? new Date(p.period_to).toLocaleDateString() : '—',
      p.description || '—',
    ] as (string | number)[])
    downloadExcel(headers, rows, `My_Payment_History_${today}.xlsx`)
  }

  function exportPayPDF() {
    const paidTotal = payments.filter(p => p.status === 'paid').reduce((s, p) => s + Number(p.amount), 0)
    downloadPDF(
      'My Payment History',
      `Generated: ${new Date().toLocaleDateString()}  —  Total Paid: PHP ${paidTotal.toLocaleString()}`,
      ['No.', 'Amount (PHP)', 'Date', 'Mode', 'Status'],
      payments.map((p, i) => [
        i + 1, Number(p.amount).toLocaleString(),
        new Date(p.payment_date).toLocaleDateString(),
        p.payment_mode?.replace('_', ' ') || '—',
        p.status,
      ]),
      `My_Payment_History_${today}.pdf`,
    )
  }

  // ── Maintenance export actions ─────────────────────────
  function exportMaintCSV() {
    const headers = ['No.', 'Title', 'Description', 'Priority', 'Status', 'Date Submitted', 'Date Resolved', 'Review Comment', 'Rating']
    const rows = maintenance.map((m, i) => [
      i + 1, m.title, m.description, m.priority, m.status,
      new Date(m.created_at).toLocaleDateString(),
      m.reviewed_at ? new Date(m.reviewed_at).toLocaleDateString() : '—',
      m.review_comment || '—',
      m.review_rating != null ? m.review_rating : '—',
    ] as (string | number)[])
    downloadCSV(headers, rows, `My_Maintenance_History_${today}.csv`)
  }

  function exportMaintExcel() {
    const headers = ['No.', 'Title', 'Description', 'Priority', 'Status', 'Date Submitted', 'Date Resolved', 'Review Comment', 'Rating']
    const rows = maintenance.map((m, i) => [
      i + 1, m.title, m.description, m.priority, m.status,
      new Date(m.created_at).toLocaleDateString(),
      m.reviewed_at ? new Date(m.reviewed_at).toLocaleDateString() : '—',
      m.review_comment || '—',
      m.review_rating != null ? m.review_rating : '—',
    ] as (string | number)[])
    downloadExcel(headers, rows, `My_Maintenance_History_${today}.xlsx`)
  }

  function exportMaintPDF() {
    downloadPDF(
      'My Maintenance History',
      `Generated: ${new Date().toLocaleDateString()}  —  Total: ${maintenance.length} request(s)`,
      ['No.', 'Title', 'Priority', 'Status', 'Date Submitted', 'Review Comment', 'Rating'],
      maintenance.map((m, i) => [
        i + 1, m.title, m.priority, m.status.replace('_', ' '),
        new Date(m.created_at).toLocaleDateString(),
        m.review_comment || '—',
        m.review_rating != null ? `${m.review_rating}/5` : '—',
      ]),
      `My_Maintenance_History_${today}.pdf`,
    )
  }

  // ── Pagination Controls ────────────────────────────────
  function PaginationControls({ page, total, onChange }: { page: number; total: number; onChange: (p: number) => void }) {
    const pages = Math.ceil(total / ROWS_PER_PAGE)
    if (pages <= 1) return null
    return (
      <div className={`flex items-center justify-between px-5 py-3 border-t ${isDark ? 'border-[#1E293B]' : 'border-gray-200'}`}>
        <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
          {((page - 1) * ROWS_PER_PAGE) + 1}–{Math.min(page * ROWS_PER_PAGE, total)} of {total}
        </p>
        <div className="flex items-center gap-1">
          <button onClick={() => onChange(page - 1)} disabled={page <= 1}
            className={`p-1.5 rounded-lg ${page <= 1 ? 'opacity-30 cursor-not-allowed' : isDark ? 'hover:bg-white/10 text-gray-300' : 'hover:bg-gray-100 text-gray-600'}`}>
            <ChevronLeft className="w-4 h-4" />
          </button>
          {Array.from({ length: pages }, (_, i) => i + 1)
            .filter(p => p === 1 || p === pages || Math.abs(p - page) <= 1)
            .reduce<(number | string)[]>((acc, p, i, arr) => {
              if (i > 0 && (p as number) - (arr[i - 1] as number) > 1) acc.push('...')
              acc.push(p); return acc
            }, [])
            .map((p, i) => p === '...' ? (
              <span key={`d${i}`} className={`px-1.5 text-xs ${isDark ? 'text-gray-600' : 'text-gray-300'}`}>…</span>
            ) : (
              <button key={p} onClick={() => onChange(p as number)}
                className={`w-8 h-8 rounded-lg text-xs font-medium ${p === page ? 'bg-primary text-white' : isDark ? 'text-gray-300 hover:bg-white/10' : 'text-gray-600 hover:bg-gray-100'}`}>
                {p}
              </button>
            ))}
          <button onClick={() => onChange(page + 1)} disabled={page >= pages}
            className={`p-1.5 rounded-lg ${page >= pages ? 'opacity-30 cursor-not-allowed' : isDark ? 'hover:bg-white/10 text-gray-300' : 'hover:bg-gray-100 text-gray-600'}`}>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    )
  }

  // ── Export Buttons Row ─────────────────────────────────
  function ExportButtons({ onCSV, onExcel, onPDF }: { onCSV: () => void; onExcel: () => void; onPDF: () => void }) {
    return (
      <div className="flex gap-2 flex-wrap">
        <button onClick={onPDF}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border bg-red-600/10 border-red-500/30 text-red-400 hover:bg-red-600/20 transition-all">
          <Download className="w-3 h-3" />PDF
        </button>
        <button onClick={onCSV}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-all ${isDark ? 'bg-[#111D32] border-[#1E293B] text-white hover:border-primary/40' : 'bg-gray-50 border-gray-200 text-gray-900 hover:border-primary/40'}`}>
          <Download className="w-3 h-3" />CSV
        </button>
        <button onClick={onExcel}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-all ${isDark ? 'bg-[#111D32] border-[#1E293B] text-white hover:border-primary/40' : 'bg-gray-50 border-gray-200 text-gray-900 hover:border-primary/40'}`}>
          <FileText className="w-3 h-3" />Excel
        </button>
      </div>
    )
  }

  const paidCount = payments.filter(p => p.status === 'paid').length
  const paidTotal = payments.filter(p => p.status === 'paid').reduce((s, p) => s + Number(p.amount), 0)
  const pendingTotal = payments.filter(p => p.status === 'pending').reduce((s, p) => s + Number(p.amount), 0)

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Header */}
      <div>
        <h2 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>My Reports</h2>
        <p className={`text-base mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          Download your payment history and maintenance records
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className={`${cardClass} p-4`}>
          <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Total Payments</p>
          <p className={`text-xl font-bold mt-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>{payments.length}</p>
        </div>
        <div className={`${cardClass} p-4`}>
          <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Total Paid</p>
          <p className="text-xl font-bold mt-1 text-emerald-400">₱{paidTotal.toLocaleString()}</p>
        </div>
        <div className={`${cardClass} p-4`}>
          <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Pending Amount</p>
          <p className="text-xl font-bold mt-1 text-amber-400">₱{pendingTotal.toLocaleString()}</p>
        </div>
        <div className={`${cardClass} p-4`}>
          <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Maintenance Requests</p>
          <p className={`text-xl font-bold mt-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>{maintenance.length}</p>
        </div>
      </div>

      {/* Section Tabs */}
      <div className={`${cardClass} p-1 inline-flex rounded-xl`}>
        {[
          { key: 'payments' as ReportSection, label: 'Payment History', icon: PhilippinePeso },
          { key: 'maintenance' as ReportSection, label: 'Maintenance History', icon: Wrench },
        ].map(tab => (
          <button key={tab.key} onClick={() => { setSection(tab.key); setPayPage(1); setMaintPage(1) }}
            className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-xl transition-colors ${
              section === tab.key ? 'bg-primary text-white' : isDark ? 'text-gray-400 hover:bg-white/5' : 'text-gray-500 hover:bg-gray-50'
            }`}>
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ══════ PAYMENT HISTORY ══════ */}
      {section === 'payments' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              {paidCount} paid payment{paidCount !== 1 ? 's' : ''} — ₱{paidTotal.toLocaleString()} total
            </p>
            <ExportButtons onCSV={exportPayCSV} onExcel={exportPayExcel} onPDF={exportPayPDF} />
          </div>
          {loading ? <TableSkeleton rows={5} /> : (
            <div className={`${cardClass} overflow-x-auto`}>
              <table className="w-full text-sm">
                <thead>
                  <tr className={`border-b ${isDark ? 'border-[#1E293B]' : 'border-gray-200'}`}>
                    {['No.', 'Amount', 'Date', 'Mode', 'Verification', 'Period', 'Description', 'Status'].map(h => (
                      <th key={h} className={`text-left py-3 px-4 font-medium text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {payments.length === 0 ? (
                    <tr><td colSpan={8} className={`text-center py-12 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>No payment records yet</td></tr>
                  ) : [...payments].sort((a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime())
                      .slice((payPage - 1) * ROWS_PER_PAGE, payPage * ROWS_PER_PAGE).map((p, i) => (
                    <tr key={p.id} className={`border-b last:border-0 ${isDark ? 'border-[#1E293B]' : 'border-gray-100'}`}>
                      <td className={`py-2.5 px-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{(payPage - 1) * ROWS_PER_PAGE + i + 1}</td>
                      <td className="py-2.5 px-4 font-medium text-emerald-400">₱{Number(p.amount).toLocaleString()}</td>
                      <td className={`py-2.5 px-4 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{new Date(p.payment_date).toLocaleDateString()}</td>
                      <td className={`py-2.5 px-4 capitalize ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{p.payment_mode?.replace('_', ' ') || '—'}</td>
                      <td className="py-2.5 px-4">
                        {p.verification_status ? (
                          <span className={`inline-block px-2 py-0.5 text-xs rounded-full font-medium ${
                            p.verification_status === 'approved' ? 'bg-emerald-500/15 text-emerald-400'
                            : p.verification_status === 'rejected' ? 'bg-red-500/15 text-red-400'
                            : 'bg-amber-500/15 text-amber-400'
                          }`}>{p.verification_status.replace('_', ' ')}</span>
                        ) : <span className={isDark ? 'text-gray-500' : 'text-gray-400'}>—</span>}
                      </td>
                      <td className={`py-2.5 px-4 whitespace-nowrap ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                        {p.period_from && p.period_to
                          ? `${new Date(p.period_from).toLocaleDateString('en', { month: 'short', year: 'numeric' })} – ${new Date(p.period_to).toLocaleDateString('en', { month: 'short', year: 'numeric' })}`
                          : '—'}
                      </td>
                      <td className={`py-2.5 px-4 max-w-[140px] truncate ${isDark ? 'text-gray-300' : 'text-gray-600'}`} title={p.description || ''}>
                        {p.description || '—'}
                      </td>
                      <td className="py-2.5 px-4">
                        <span className={`inline-block px-2 py-0.5 text-xs rounded-full font-medium ${
                          p.status === 'paid' ? 'bg-emerald-500/15 text-emerald-400'
                          : p.status === 'pending' ? 'bg-amber-500/15 text-amber-400'
                          : 'bg-red-500/15 text-red-400'
                        }`}>{p.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <PaginationControls page={payPage} total={payments.length} onChange={setPayPage} />
            </div>
          )}
        </div>
      )}

      {/* ══════ MAINTENANCE HISTORY ══════ */}
      {section === 'maintenance' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              {maintenance.length} request{maintenance.length !== 1 ? 's' : ''} submitted
            </p>
            <ExportButtons onCSV={exportMaintCSV} onExcel={exportMaintExcel} onPDF={exportMaintPDF} />
          </div>
          {loading ? <TableSkeleton rows={5} /> : (
            <div className={`${cardClass} overflow-x-auto`}>
              <table className="w-full text-sm">
                <thead>
                  <tr className={`border-b ${isDark ? 'border-[#1E293B]' : 'border-gray-200'}`}>
                    {['No.', 'Title', 'Description', 'Priority', 'Status', 'Date', 'Review Comment', 'Rating'].map(h => (
                      <th key={h} className={`text-left py-3 px-4 font-medium text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {maintenance.length === 0 ? (
                    <tr><td colSpan={8} className={`text-center py-12 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>No maintenance requests yet</td></tr>
                  ) : [...maintenance].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                      .slice((maintPage - 1) * ROWS_PER_PAGE, maintPage * ROWS_PER_PAGE).map((m, i) => (
                    <tr key={m.id} className={`border-b last:border-0 ${isDark ? 'border-[#1E293B]' : 'border-gray-100'}`}>
                      <td className={`py-2.5 px-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{(maintPage - 1) * ROWS_PER_PAGE + i + 1}</td>
                      <td className={`py-2.5 px-4 font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{m.title}</td>
                      <td className={`py-2.5 px-4 max-w-[160px] truncate ${isDark ? 'text-gray-300' : 'text-gray-600'}`} title={m.description}>{m.description}</td>
                      <td className="py-2.5 px-4">
                        <span className={`inline-block px-2 py-0.5 text-xs rounded-full font-medium ${
                          m.priority === 'urgent' ? 'bg-red-500/15 text-red-400'
                          : m.priority === 'high' ? 'bg-orange-500/15 text-orange-400'
                          : m.priority === 'medium' ? 'bg-amber-500/15 text-amber-400'
                          : 'bg-gray-500/15 text-gray-400'
                        }`}>{m.priority}</span>
                      </td>
                      <td className="py-2.5 px-4">
                        <span className={`inline-block px-2 py-0.5 text-xs rounded-full font-medium ${
                          m.status === 'resolved' || m.status === 'closed' ? 'bg-emerald-500/15 text-emerald-400'
                          : m.status === 'in_progress' ? 'bg-blue-500/15 text-blue-400'
                          : 'bg-amber-500/15 text-amber-400'
                        }`}>{m.status.replace('_', ' ')}</span>
                      </td>
                      <td className={`py-2.5 px-4 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{new Date(m.created_at).toLocaleDateString()}</td>
                      <td className={`py-2.5 px-4 max-w-[140px] truncate ${isDark ? 'text-gray-300' : 'text-gray-600'}`} title={m.review_comment || ''}>
                        {m.review_comment || '—'}
                      </td>
                      <td className={`py-2.5 px-4 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                        {m.review_rating != null ? `${m.review_rating}/5` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <PaginationControls page={maintPage} total={maintenance.length} onChange={setMaintPage} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
