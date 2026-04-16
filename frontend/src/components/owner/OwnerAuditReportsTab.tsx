import { useState, useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useTheme } from '../../context/ThemeContext'
import { getOwnerPayments, getOwnerProperties, getExpenses, createExpense, deleteExpense, type OwnerPayment, type Property, type Expense } from '../../lib/ownerApi'
import { PhilippinePeso, TrendingUp, Calendar, Download, ChevronDown, Plus, Trash2, X, Printer, FileText, AlertTriangle } from 'lucide-react'
import { TableSkeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'

interface OwnerAuditReportsTabProps {
  ownerId: string
}

type SectionTab = 'quarterly' | 'annual' | 'expenses'

interface RevenueRow {
  label: string
  totalRevenue: number
  paidCount: number
  pendingAmount: number
  pendingCount: number
  overdueAmount: number
  overdueCount: number
}

const QUARTER_LABELS: Record<number, string> = {
  1: 'Q1 (Jan–Mar)',
  2: 'Q2 (Apr–Jun)',
  3: 'Q3 (Jul–Sep)',
  4: 'Q4 (Oct–Dec)',
}

const EXPENSE_TYPES = [
  'Manager Salary',
  'Maintenance & Repairs',
  'Utilities',
  'Insurance',
  'Property Tax',
  'Cleaning Services',
  'Security',
  'Supplies',
  'Advertising',
  'Legal & Professional',
  'Other',
]

function isPaid(p: OwnerPayment) {
  return p.status === 'paid' || p.verification_status === 'verified' || p.verification_status === 'approved'
}

function isPending(p: OwnerPayment) {
  return p.status === 'pending'
}

function isOverdue(p: OwnerPayment) {
  return p.status === 'overdue'
}

export default function OwnerAuditReportsTab({ ownerId }: OwnerAuditReportsTabProps) {
  const { isDark } = useTheme()
  const [payments, setPayments] = useState<OwnerPayment[]>([])
  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<SectionTab>('quarterly')
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [selectedQuarter, setSelectedQuarter] = useState(Math.ceil((new Date().getMonth() + 1) / 3))
  const [selectedProperty, setSelectedProperty] = useState<string>('all')
  const [isYearOpen, setIsYearOpen] = useState(false)
  const [isQuarterOpen, setIsQuarterOpen] = useState(false)
  const [isPropertyOpen, setIsPropertyOpen] = useState(false)
  const yearRef = useRef<HTMLDivElement>(null)
  const quarterRef = useRef<HTMLDivElement>(null)
  const propRef = useRef<HTMLDivElement>(null)

  // Expense records (persisted to DB)
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [showExpenseForm, setShowExpenseForm] = useState(false)
  const [expenseForm, setExpenseForm] = useState({ date: '', type: '', description: '', amount: '' })

  // Tax forms reference popup
  const [showTaxNotice, setShowTaxNotice] = useState(false)
  const [pendingExportFn, setPendingExportFn] = useState<(() => void) | null>(null)

  useEffect(() => {
    setLoading(true)
    Promise.all([getOwnerPayments(ownerId), getOwnerProperties(ownerId), getExpenses(ownerId)])
      .then(([p, props, exp]) => { setPayments(p); setProperties(props); setExpenses(exp) })
      .catch(() => { setPayments([]); setProperties([]); setExpenses([]) })
      .finally(() => setLoading(false))
  }, [ownerId])

  // Close dropdowns on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (yearRef.current && !yearRef.current.contains(e.target as Node)) setIsYearOpen(false)
      if (quarterRef.current && !quarterRef.current.contains(e.target as Node)) setIsQuarterOpen(false)
      if (propRef.current && !propRef.current.contains(e.target as Node)) setIsPropertyOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  // Filter payments by selected property
  const filteredPayments = useMemo(() => {
    if (selectedProperty === 'all') return payments
    return payments.filter(p => p.apartment_id === selectedProperty)
  }, [payments, selectedProperty])

  const availableYears = useMemo(() => {
    const years = new Set<number>()
    years.add(new Date().getFullYear())
    payments.forEach(p => years.add(new Date(p.payment_date).getFullYear()))
    return Array.from(years).sort((a, b) => b - a)
  }, [payments])

  // Summary cards from all filtered payments for selected year
  const yearPayments = useMemo(
    () => filteredPayments.filter(p => new Date(p.payment_date).getFullYear() === selectedYear),
    [filteredPayments, selectedYear]
  )
  const totalIncome = yearPayments.filter(isPaid).reduce((s, p) => s + Number(p.amount), 0)
  const totalCollections = yearPayments.filter(isPaid).length
  const totalPendingAmt = yearPayments.filter(isPending).reduce((s, p) => s + Number(p.amount), 0)
  const totalOverdueAmt = yearPayments.filter(isOverdue).reduce((s, p) => s + Number(p.amount), 0)

  // ── Quarterly Report Data ─────────────────────────────────
  const quarterlyRows = useMemo((): RevenueRow[] => {
    const startMonth = (selectedQuarter - 1) * 3
    return Array.from({ length: 3 }, (_, i) => {
      const month = startMonth + i
      const monthPayments = yearPayments.filter(p => new Date(p.payment_date).getMonth() === month)
      const paid = monthPayments.filter(isPaid)
      const pending = monthPayments.filter(isPending)
      const overdue = monthPayments.filter(isOverdue)
      return {
        label: new Date(selectedYear, month).toLocaleString('default', { month: 'long' }),
        totalRevenue: paid.reduce((sum, p) => sum + Number(p.amount), 0),
        paidCount: paid.length,
        pendingAmount: pending.reduce((sum, p) => sum + Number(p.amount), 0),
        pendingCount: pending.length,
        overdueAmount: overdue.reduce((sum, p) => sum + Number(p.amount), 0),
        overdueCount: overdue.length,
      }
    })
  }, [yearPayments, selectedQuarter, selectedYear])

  const quarterlyTotal = useMemo(() => ({
    revenue: quarterlyRows.reduce((s, r) => s + r.totalRevenue, 0),
    paid: quarterlyRows.reduce((s, r) => s + r.paidCount, 0),
    pending: quarterlyRows.reduce((s, r) => s + r.pendingAmount, 0),
    overdue: quarterlyRows.reduce((s, r) => s + r.overdueAmount, 0),
  }), [quarterlyRows])

  // Quarterly payment records
  const quarterlyPaymentRecords = useMemo(() => {
    const startMonth = (selectedQuarter - 1) * 3
    return yearPayments
      .filter(p => {
        const m = new Date(p.payment_date).getMonth()
        return m >= startMonth && m < startMonth + 3
      })
      .sort((a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime())
  }, [yearPayments, selectedQuarter])

  // ── Annual Report Data ────────────────────────────────────
  const annualRows = useMemo((): RevenueRow[] => {
    return Array.from({ length: 12 }, (_, i) => {
      const monthPayments = yearPayments.filter(p => new Date(p.payment_date).getMonth() === i)
      const paid = monthPayments.filter(isPaid)
      const pending = monthPayments.filter(isPending)
      const overdue = monthPayments.filter(isOverdue)
      return {
        label: new Date(selectedYear, i).toLocaleString('default', { month: 'short' }),
        totalRevenue: paid.reduce((sum, p) => sum + Number(p.amount), 0),
        paidCount: paid.length,
        pendingAmount: pending.reduce((sum, p) => sum + Number(p.amount), 0),
        pendingCount: pending.length,
        overdueAmount: overdue.reduce((sum, p) => sum + Number(p.amount), 0),
        overdueCount: overdue.length,
      }
    })
  }, [yearPayments, selectedYear])

  const annualTotal = useMemo(() => ({
    revenue: annualRows.reduce((s, r) => s + r.totalRevenue, 0),
    paid: annualRows.reduce((s, r) => s + r.paidCount, 0),
    pending: annualRows.reduce((s, r) => s + r.pendingAmount, 0),
    overdue: annualRows.reduce((s, r) => s + r.overdueAmount, 0),
  }), [annualRows])

  // Annual payment records (individual payments for the whole year)
  const annualPaymentRecords = useMemo(() => {
    return yearPayments.sort((a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime())
  }, [yearPayments])

  // Year expenses for annual tab
  const yearExpenses = useMemo(() => {
    return expenses.filter(e => new Date(e.date).getFullYear() === selectedYear)
  }, [expenses, selectedYear])

  // Quarter expenses for quarterly tab
  const quarterExpenses = useMemo(() => {
    const startMonth = (selectedQuarter - 1) * 3
    return yearExpenses.filter(e => {
      const m = new Date(e.date).getMonth()
      return m >= startMonth && m < startMonth + 3
    })
  }, [yearExpenses, selectedQuarter])

  const totalQuarterExpenses = useMemo(
    () => quarterExpenses.reduce((s, e) => s + Number(e.amount), 0),
    [quarterExpenses]
  )

  // ── Expense handlers ──────────────────────────────────────
  const totalExpenses = yearExpenses.reduce((s, e) => s + Number(e.amount), 0)

  async function addExpense() {
    if (!expenseForm.date || !expenseForm.type || !expenseForm.amount) return
    try {
      const newExpense = await createExpense({
        apartmentowner_id: ownerId,
        apartment_id: selectedProperty !== 'all' ? selectedProperty : null,
        date: expenseForm.date,
        type: expenseForm.type,
        description: expenseForm.description || undefined,
        amount: Number(expenseForm.amount),
      })
      const freshExpenses = await getExpenses(ownerId)
      setExpenses(freshExpenses)
      setExpenseForm({ date: '', type: '', description: '', amount: '' })
      setShowExpenseForm(false)
      toast.success('Expense added')
    } catch {
      toast.error('Failed to add expense')
    }
  }

  async function removeExpense(id: string) {
    try {
      await deleteExpense(id)
      const freshExpenses = await getExpenses(ownerId)
      setExpenses(freshExpenses)
      toast.success('Expense deleted')
    } catch {
      toast.error('Failed to delete expense')
    }
  }

  // ── Export Functions ───────────────────────────────────────
  function triggerExport(fn: () => void) {
    setPendingExportFn(() => fn)
    setShowTaxNotice(true)
  }

  function confirmExport() {
    if (pendingExportFn) pendingExportFn()
    setShowTaxNotice(false)
    setPendingExportFn(null)
  }

  function exportCSV(headers: string[], rows: (string | number)[][], filename: string) {
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  async function exportExcel(headers: string[], rows: (string | number)[][], filename: string) {
    const XLSX = await import('xlsx')
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Report')
    XLSX.writeFile(wb, filename)
  }

  function handlePrint() {
    window.print()
  }

  function exportQuarterlyCSV() {
    const headers = ['Month', 'Revenue (₱)', 'Paid', 'Pending (₱)', 'Overdue (₱)']
    const rows = quarterlyRows.map(r => [r.label, r.totalRevenue, r.paidCount, r.pendingAmount, r.overdueAmount] as (string | number)[])
    rows.push(['TOTAL', quarterlyTotal.revenue, quarterlyTotal.paid, quarterlyTotal.pending, quarterlyTotal.overdue])
    rows.push([])
    rows.push(['Gross Collections', quarterlyTotal.revenue, '', '', ''])
    rows.push(['Total Expenses', totalQuarterExpenses, '', '', ''])
    rows.push(['Net Income', quarterlyTotal.revenue - totalQuarterExpenses, '', '', ''])
    exportCSV(headers, rows, `Quarterly_Report_Q${selectedQuarter}_${selectedYear}.csv`)
  }

  function exportQuarterlyExcel() {
    const headers = ['Month', 'Revenue (₱)', 'Paid', 'Pending (₱)', 'Overdue (₱)']
    const rows = quarterlyRows.map(r => [r.label, r.totalRevenue, r.paidCount, r.pendingAmount, r.overdueAmount] as (string | number)[])
    rows.push(['TOTAL', quarterlyTotal.revenue, quarterlyTotal.paid, quarterlyTotal.pending, quarterlyTotal.overdue])
    rows.push([])
    rows.push(['Gross Collections', quarterlyTotal.revenue, '', '', ''])
    rows.push(['Total Expenses', totalQuarterExpenses, '', '', ''])
    rows.push(['Net Income', quarterlyTotal.revenue - totalQuarterExpenses, '', '', ''])
    exportExcel(headers, rows, `Quarterly_Report_Q${selectedQuarter}_${selectedYear}.xlsx`)
  }

  function exportAnnualCSV() {
    const headers = ['Month', 'Revenue (₱)', 'Paid', 'Pending (₱)', 'Overdue (₱)']
    const rows = annualRows.map(r => [r.label, r.totalRevenue, r.paidCount, r.pendingAmount, r.overdueAmount] as (string | number)[])
    rows.push(['TOTAL', annualTotal.revenue, annualTotal.paid, annualTotal.pending, annualTotal.overdue])
    rows.push([])
    rows.push(['Gross Collections', annualTotal.revenue, '', '', ''])
    rows.push(['Total Expenses', totalExpenses, '', '', ''])
    rows.push(['Net Income', annualTotal.revenue - totalExpenses, '', '', ''])
    exportCSV(headers, rows, `Annual_Report_${selectedYear}.csv`)
  }

  function exportAnnualExcel() {
    const headers = ['Month', 'Revenue (₱)', 'Paid', 'Pending (₱)', 'Overdue (₱)']
    const rows = annualRows.map(r => [r.label, r.totalRevenue, r.paidCount, r.pendingAmount, r.overdueAmount] as (string | number)[])
    rows.push(['TOTAL', annualTotal.revenue, annualTotal.paid, annualTotal.pending, annualTotal.overdue])
    rows.push([])
    rows.push(['Gross Collections', annualTotal.revenue, '', '', ''])
    rows.push(['Total Expenses', totalExpenses, '', '', ''])
    rows.push(['Net Income', annualTotal.revenue - totalExpenses, '', '', ''])
    exportExcel(headers, rows, `Annual_Report_${selectedYear}.xlsx`)
  }

  function exportExpensesCSV() {
    const ye = expenses.filter(e => new Date(e.date).getFullYear() === selectedYear)
    const headers = ['Date', 'Type', 'Description', 'Amount (₱)']
    const rows = ye.map(e => [e.date, e.type, e.description || '', Number(e.amount)] as (string | number)[])
    rows.push([])
    rows.push(['', '', 'Gross Income', annualTotal.revenue])
    rows.push(['', '', 'Total Expenses', totalExpenses])
    rows.push(['', '', 'Net Income', annualTotal.revenue - totalExpenses])
    exportCSV(headers, rows, `Expense_Records_${selectedYear}.csv`)
  }

  // ── PDF Export Functions ──────────────────────────────────
  async function exportQuarterlyPDF() {
    const { default: jsPDF } = await import('jspdf')
    const autoTable = (await import('jspdf-autotable')).default
    const doc = new jsPDF()
    const propName = selectedProperty === 'all' ? 'All Apartments' : properties.find(p => p.id === selectedProperty)?.name || ''
    doc.setFontSize(18)
    doc.text(`Quarterly Report — ${QUARTER_LABELS[selectedQuarter]} ${selectedYear}`, 14, 20)
    doc.setFontSize(11)
    doc.text(`Property: ${propName}`, 14, 28)
    doc.text(`Gross Collections: PHP ${quarterlyTotal.revenue.toLocaleString()}`, 14, 35)
    doc.text(`Total Expenses: PHP ${totalQuarterExpenses.toLocaleString()}`, 14, 42)
    doc.text(`Net Income: PHP ${(quarterlyTotal.revenue - totalQuarterExpenses).toLocaleString()}`, 14, 49)

    autoTable(doc, {
      startY: 56,
      head: [['Month', 'Revenue (PHP)', 'Paid', 'Pending (PHP)', 'Overdue (PHP)']],
      body: [
        ...quarterlyRows.map(r => [r.label, r.totalRevenue.toLocaleString(), r.paidCount, r.pendingAmount.toLocaleString(), r.overdueAmount.toLocaleString()]),
        ['TOTAL', quarterlyTotal.revenue.toLocaleString(), quarterlyTotal.paid, quarterlyTotal.pending.toLocaleString(), quarterlyTotal.overdue.toLocaleString()],
      ],
    })

    let nextY = (doc as any).lastAutoTable?.finalY || 80

    if (quarterlyPaymentRecords.length > 0) {
      doc.setFontSize(13)
      doc.text('Payment Records', 14, nextY + 10)
      autoTable(doc, {
        startY: nextY + 15,
        head: [['No.', 'Tenant', 'Unit', 'Amount (PHP)', 'Date', 'Status']],
        body: quarterlyPaymentRecords.slice(0, 100).map((p, i) => [
          i + 1, p.tenant_name || '—', p.apartment_name || '—', Number(p.amount).toLocaleString(),
          new Date(p.payment_date).toLocaleDateString(), p.status,
        ]),
        styles: { fontSize: 8 },
      })
      nextY = (doc as any).lastAutoTable?.finalY || nextY + 50
    }

    if (quarterExpenses.length > 0) {
      if (nextY > 240) { doc.addPage(); nextY = 20 }
      doc.setFontSize(13)
      doc.text('Expense Records', 14, nextY + 10)
      autoTable(doc, {
        startY: nextY + 15,
        head: [['Date', 'Type', 'Description', 'Amount (PHP)']],
        body: quarterExpenses.map(e => [
          new Date(e.date).toLocaleDateString(), e.type, e.description || '—', Number(e.amount).toLocaleString(),
        ]),
        styles: { fontSize: 8 },
      })
    }

    doc.save(`Quarterly_Report_Q${selectedQuarter}_${selectedYear}.pdf`)
  }

  async function exportAnnualPDF() {
    const { default: jsPDF } = await import('jspdf')
    const autoTable = (await import('jspdf-autotable')).default
    const doc = new jsPDF()
    const propName = selectedProperty === 'all' ? 'All Apartments' : properties.find(p => p.id === selectedProperty)?.name || ''
    doc.setFontSize(18)
    doc.text(`Annual Report — ${selectedYear}`, 14, 20)
    doc.setFontSize(11)
    doc.text(`Property: ${propName}`, 14, 28)
    doc.text(`Total Collection: PHP ${annualTotal.revenue.toLocaleString()}`, 14, 35)
    doc.text(`Total Expenses: PHP ${totalExpenses.toLocaleString()}`, 14, 42)
    doc.text(`Net Income: PHP ${(annualTotal.revenue - totalExpenses).toLocaleString()}`, 14, 49)

    autoTable(doc, {
      startY: 56,
      head: [['Month', 'Revenue (PHP)', 'Paid', 'Pending (PHP)', 'Overdue (PHP)']],
      body: [
        ...annualRows.map(r => [r.label, r.totalRevenue.toLocaleString(), r.paidCount, r.pendingAmount.toLocaleString(), r.overdueAmount.toLocaleString()]),
        ['TOTAL', annualTotal.revenue.toLocaleString(), annualTotal.paid, annualTotal.pending.toLocaleString(), annualTotal.overdue.toLocaleString()],
      ],
    })

    let nextY = (doc as any).lastAutoTable?.finalY || 100

    if (annualPaymentRecords.length > 0) {
      doc.setFontSize(13)
      doc.text('Payment Records', 14, nextY + 10)
      autoTable(doc, {
        startY: nextY + 15,
        head: [['No.', 'Tenant', 'Unit', 'Amount (PHP)', 'Date', 'Status']],
        body: annualPaymentRecords.slice(0, 200).map((p, i) => [
          i + 1, p.tenant_name || '—', p.apartment_name || '—', Number(p.amount).toLocaleString(),
          new Date(p.payment_date).toLocaleDateString(), p.status,
        ]),
        styles: { fontSize: 8 },
      })
      nextY = (doc as any).lastAutoTable?.finalY || nextY + 50
    }

    if (yearExpenses.length > 0) {
      if (nextY > 240) { doc.addPage(); nextY = 20 }
      doc.setFontSize(13)
      doc.text('Expense Records', 14, nextY + 10)
      autoTable(doc, {
        startY: nextY + 15,
        head: [['Date', 'Type', 'Description', 'Amount (PHP)']],
        body: yearExpenses.map(e => [
          new Date(e.date).toLocaleDateString(), e.type, e.description || '—', Number(e.amount).toLocaleString(),
        ]),
        styles: { fontSize: 8 },
      })
    }

    doc.save(`Annual_Report_${selectedYear}.pdf`)
  }

  const cardClass = `rounded-2xl border ${isDark ? 'bg-[#111D32] border-[#1E293B]' : 'bg-white border-gray-200'}`
  const dropdownClass = `absolute right-0 top-full mt-1 z-30 rounded-lg border shadow-lg overflow-hidden ${isDark ? 'bg-[#111D32] border-[#1E293B]' : 'bg-white border-gray-200'}`

  // ── Dropdown Button Component ─────────────────────────────
  function DropdownBtn({ label, value, isOpen, onToggle, parentRef, options }: {
    label?: string; value: string; isOpen: boolean; onToggle: () => void
    parentRef: React.RefObject<HTMLDivElement | null>
    options: { key: string; label: string; onClick: () => void }[]
  }) {
    return (
      <div className="relative" ref={parentRef}>
        <button onClick={onToggle} className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
          isDark ? 'bg-[#0A1628] border-[#1E293B] text-white hover:border-primary/40' : 'bg-white border-gray-200 text-gray-900 hover:border-primary/40'
        }`}>
          {label && <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{label}</span>}
          {value}
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>
        {isOpen && (
          <div className={dropdownClass}>
            {options.map(o => (
              <button key={o.key} onClick={o.onClick} className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                o.label === value ? 'bg-primary text-white font-medium' : isDark ? 'text-gray-300 hover:bg-white/5' : 'text-gray-700 hover:bg-gray-50'
              }`}>
                {o.label}
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  // ── Revenue Table Renderer ────────────────────────────────
  function RevenueTable({ rows, total }: { rows: RevenueRow[]; total: { revenue: number; paid: number; pending: number; overdue: number } }) {
    return (
      <div className={`${cardClass} overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead>
            <tr className={`border-b ${isDark ? 'border-[#1E293B]' : 'border-gray-200'}`}>
              {['Period', 'Revenue', 'Paid', 'Pending', 'Overdue'].map(h => (
                <th key={h} className={`text-left py-3 px-5 font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.label} className={`border-b last:border-0 ${isDark ? 'border-[#1E293B]' : 'border-gray-100'}`}>
                <td className={`py-3 px-5 font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{row.label}</td>
                <td className={`py-3 px-5 font-semibold ${row.totalRevenue > 0 ? 'text-emerald-400' : isDark ? 'text-gray-600' : 'text-gray-300'}`}>₱{row.totalRevenue.toLocaleString()}</td>
                <td className={`py-3 px-5 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{row.paidCount}</td>
                <td className={`py-3 px-5 ${row.pendingAmount > 0 ? 'text-amber-400' : isDark ? 'text-gray-600' : 'text-gray-300'}`}>₱{row.pendingAmount.toLocaleString()}</td>
                <td className={`py-3 px-5 ${row.overdueAmount > 0 ? 'text-red-400' : isDark ? 'text-gray-600' : 'text-gray-300'}`}>₱{row.overdueAmount.toLocaleString()}</td>
              </tr>
            ))}
            <tr className={`border-t-2 ${isDark ? 'border-[#1E293B] bg-[#0A1628]' : 'border-gray-200 bg-gray-50'}`}>
              <td className={`py-3 px-5 font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>TOTAL</td>
              <td className="py-3 px-5 font-bold text-emerald-400">₱{total.revenue.toLocaleString()}</td>
              <td className={`py-3 px-5 font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{total.paid}</td>
              <td className={`py-3 px-5 font-bold ${total.pending > 0 ? 'text-amber-400' : isDark ? 'text-gray-500' : 'text-gray-400'}`}>₱{total.pending.toLocaleString()}</td>
              <td className={`py-3 px-5 font-bold ${total.overdue > 0 ? 'text-red-400' : isDark ? 'text-gray-500' : 'text-gray-400'}`}>₱{total.overdue.toLocaleString()}</td>
            </tr>
          </tbody>
        </table>
      </div>
    )
  }

  // ── Export Buttons Row ────────────────────────────────────
  function ExportRow({ onCSV, onExcel, onPDF, onPrint }: { onCSV: () => void; onExcel: () => void; onPDF?: () => void; onPrint?: () => void }) {
    return (
      <div className="flex gap-2 flex-wrap">
        {onPDF && (
          <button onClick={() => triggerExport(onPDF)} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-all bg-red-600/10 border-red-500/30 text-red-400 hover:bg-red-600/20`}>
            <Download className="w-3 h-3" />PDF
          </button>
        )}
        <button onClick={() => triggerExport(onCSV)} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
          isDark ? 'bg-[#111D32] border-[#1E293B] text-white hover:border-primary/40' : 'bg-gray-50 border-gray-200 text-gray-900 hover:border-primary/40'
        }`}><Download className="w-3 h-3" />CSV</button>
        <button onClick={() => triggerExport(onExcel)} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
          isDark ? 'bg-[#111D32] border-[#1E293B] text-white hover:border-primary/40' : 'bg-gray-50 border-gray-200 text-gray-900 hover:border-primary/40'
        }`}><FileText className="w-3 h-3" />Excel</button>
        {onPrint && (
          <button onClick={onPrint} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
            isDark ? 'bg-[#111D32] border-[#1E293B] text-white hover:border-primary/40' : 'bg-gray-50 border-gray-200 text-gray-900 hover:border-primary/40'
          }`}><Printer className="w-3 h-3" />Print</button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Header */}
      <div>
        <h2 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Audit Reports</h2>
        <p className={`text-base mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          Financial monitoring, reporting, and tax reference
        </p>
      </div>

      {/* Property Filter + Year */}
      <div className={`${cardClass} p-4`}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          {/* Property Filter */}
          <DropdownBtn
            label="Location:"
            value={selectedProperty === 'all' ? 'All Apartments' : properties.find(p => p.id === selectedProperty)?.name || 'All'}
            isOpen={isPropertyOpen}
            onToggle={() => setIsPropertyOpen(!isPropertyOpen)}
            parentRef={propRef}
            options={[
              { key: 'all', label: 'All Apartments', onClick: () => { setSelectedProperty('all'); setIsPropertyOpen(false) } },
              ...properties.map(p => ({
                key: p.id,
                label: p.name,
                onClick: () => { setSelectedProperty(p.id); setIsPropertyOpen(false) },
              })),
            ]}
          />

          {/* Year */}
          <DropdownBtn
            value={String(selectedYear)}
            isOpen={isYearOpen}
            onToggle={() => setIsYearOpen(!isYearOpen)}
            parentRef={yearRef}
            options={availableYears.map(y => ({
              key: String(y),
              label: String(y),
              onClick: () => { setSelectedYear(y); setIsYearOpen(false) },
            }))}
          />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Income', value: `₱${totalIncome.toLocaleString()}`, icon: PhilippinePeso, color: 'text-emerald-400', bg: 'bg-emerald-500/15' },
          { label: 'Total Collections', value: String(totalCollections), icon: TrendingUp, color: 'text-blue-400', bg: 'bg-blue-500/15' },
          { label: 'Pending', value: `₱${totalPendingAmt.toLocaleString()}`, icon: Calendar, color: 'text-amber-400', bg: 'bg-amber-500/15' },
          { label: 'Overdue', value: `₱${totalOverdueAmt.toLocaleString()}`, icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-500/15' },
        ].map(card => (
          <div key={card.label} className={`${cardClass} p-4`}>
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl ${card.bg} flex items-center justify-center`}>
                <card.icon className={`w-4 h-4 ${card.color}`} />
              </div>
              <div>
                <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{card.label}</p>
                <p className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{card.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Section Tabs */}
      <div className={`${cardClass} p-1 inline-flex rounded-xl`}>
        {([
          { key: 'quarterly' as SectionTab, label: 'Quarterly Report' },
          { key: 'annual' as SectionTab, label: 'Annual Report' },
          { key: 'expenses' as SectionTab, label: 'Expense Records' },
        ]).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-5 py-2.5 text-sm font-medium rounded-xl transition-colors ${
              activeTab === tab.key
                ? 'bg-primary text-white'
                : isDark ? 'text-gray-400 hover:bg-white/5' : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ══════════════ QUARTERLY REPORT ══════════════ */}
      {activeTab === 'quarterly' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <DropdownBtn
                label="Quarter:"
                value={QUARTER_LABELS[selectedQuarter]}
                isOpen={isQuarterOpen}
                onToggle={() => setIsQuarterOpen(!isQuarterOpen)}
                parentRef={quarterRef}
                options={[1, 2, 3, 4].map(q => ({
                  key: String(q),
                  label: QUARTER_LABELS[q],
                  onClick: () => { setSelectedQuarter(q); setIsQuarterOpen(false) },
                }))}
              />
            </div>
            <ExportRow onCSV={exportQuarterlyCSV} onExcel={exportQuarterlyExcel} onPDF={exportQuarterlyPDF} onPrint={handlePrint} />
          </div>

          {/* Quarterly Financial Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className={`${cardClass} p-5`}>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Gross Collections ({QUARTER_LABELS[selectedQuarter]})</p>
              <p className="text-2xl font-bold text-emerald-400">₱{quarterlyTotal.revenue.toLocaleString()}</p>
            </div>
            <div className={`${cardClass} p-5`}>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Total Expenses ({QUARTER_LABELS[selectedQuarter]})</p>
              <p className="text-2xl font-bold text-red-400">₱{totalQuarterExpenses.toLocaleString()}</p>
            </div>
            <div className={`${cardClass} p-5`}>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Net Income ({QUARTER_LABELS[selectedQuarter]})</p>
              <p className={`text-2xl font-bold ${(quarterlyTotal.revenue - totalQuarterExpenses) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                ₱{(quarterlyTotal.revenue - totalQuarterExpenses).toLocaleString()}
              </p>
            </div>
          </div>

          {loading ? <TableSkeleton rows={3} /> : <RevenueTable rows={quarterlyRows} total={quarterlyTotal} />}

          {/* Payment Records Table */}
          {!loading && quarterlyPaymentRecords.length > 0 && (
            <div className={`${cardClass} overflow-x-auto`}>
              <div className={`px-5 py-3 border-b ${isDark ? 'border-[#1E293B]' : 'border-gray-200'}`}>
                <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Payment Records</p>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className={`border-b ${isDark ? 'border-[#1E293B]' : 'border-gray-200'}`}>
                    {['No.', 'Tenant', 'Unit', 'Amount', 'Date', 'Status'].map(h => (
                      <th key={h} className={`text-left py-2.5 px-5 font-medium text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {quarterlyPaymentRecords.slice(0, 50).map((p, i) => (
                    <tr key={p.id} className={`border-b last:border-0 ${isDark ? 'border-[#1E293B]' : 'border-gray-100'}`}>
                      <td className={`py-2.5 px-5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{i + 1}</td>
                      <td className={`py-2.5 px-5 ${isDark ? 'text-white' : 'text-gray-900'}`}>{p.tenant_name || '—'}</td>
                      <td className={`py-2.5 px-5 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{p.apartment_name || '—'}</td>
                      <td className="py-2.5 px-5 text-emerald-400 font-medium">₱{Number(p.amount).toLocaleString()}</td>
                      <td className={`py-2.5 px-5 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{new Date(p.payment_date).toLocaleDateString()}</td>
                      <td className="py-2.5 px-5">
                        <span className={`inline-block px-2 py-0.5 text-xs rounded-full font-medium ${
                          isPaid(p) ? 'bg-emerald-500/15 text-emerald-400'
                            : isPending(p) ? 'bg-amber-500/15 text-amber-400'
                              : 'bg-red-500/15 text-red-400'
                        }`}>
                          {p.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ══════════════ ANNUAL REPORT ══════════════ */}
      {activeTab === 'annual' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Annual Summary — {selectedYear}
              </p>
            </div>
            <ExportRow onCSV={exportAnnualCSV} onExcel={exportAnnualExcel} onPDF={exportAnnualPDF} onPrint={handlePrint} />
          </div>

          {/* Annual Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className={`${cardClass} p-5`}>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Expected Rental Income</p>
              <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                ₱{(annualTotal.revenue + annualTotal.pending + annualTotal.overdue).toLocaleString()}
              </p>
            </div>
            <div className={`${cardClass} p-5`}>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Gross Collections</p>
              <p className="text-2xl font-bold text-emerald-400">₱{annualTotal.revenue.toLocaleString()}</p>
            </div>
            <div className={`${cardClass} p-5`}>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Total Expenses</p>
              <p className="text-2xl font-bold text-red-400">₱{totalExpenses.toLocaleString()}</p>
            </div>
            <div className={`${cardClass} p-5`}>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Net Income</p>
              <p className={`text-2xl font-bold ${(annualTotal.revenue - totalExpenses) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                ₱{(annualTotal.revenue - totalExpenses).toLocaleString()}
              </p>
            </div>
          </div>

          {loading ? <TableSkeleton rows={6} /> : <RevenueTable rows={annualRows} total={annualTotal} />}

          {/* Annual Payment Records Table */}
          {!loading && annualPaymentRecords.length > 0 && (
            <div className={`${cardClass} overflow-x-auto`}>
              <div className={`px-5 py-3 border-b ${isDark ? 'border-[#1E293B]' : 'border-gray-200'}`}>
                <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Payment Records — {selectedYear}</p>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className={`border-b ${isDark ? 'border-[#1E293B]' : 'border-gray-200'}`}>
                    {['No.', 'Tenant', 'Unit', 'Amount', 'Date', 'Status'].map(h => (
                      <th key={h} className={`text-left py-2.5 px-5 font-medium text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {annualPaymentRecords.slice(0, 100).map((p, i) => (
                    <tr key={p.id} className={`border-b last:border-0 ${isDark ? 'border-[#1E293B]' : 'border-gray-100'}`}>
                      <td className={`py-2.5 px-5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{i + 1}</td>
                      <td className={`py-2.5 px-5 ${isDark ? 'text-white' : 'text-gray-900'}`}>{p.tenant_name || '—'}</td>
                      <td className={`py-2.5 px-5 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{p.apartment_name || '—'}</td>
                      <td className="py-2.5 px-5 text-emerald-400 font-medium">₱{Number(p.amount).toLocaleString()}</td>
                      <td className={`py-2.5 px-5 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{new Date(p.payment_date).toLocaleDateString()}</td>
                      <td className="py-2.5 px-5">
                        <span className={`inline-block px-2 py-0.5 text-xs rounded-full font-medium ${
                          isPaid(p) ? 'bg-emerald-500/15 text-emerald-400'
                            : isPending(p) ? 'bg-amber-500/15 text-amber-400'
                              : 'bg-red-500/15 text-red-400'
                        }`}>{p.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Expenses deducted from annual */}
          {!loading && (
            <div className={`${cardClass} overflow-x-auto`}>
              <div className={`px-5 py-3 border-b flex items-center justify-between ${isDark ? 'border-[#1E293B]' : 'border-gray-200'}`}>
                <div>
                  <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Expense Records (Deductions)</p>
                  <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Total: ₱{totalExpenses.toLocaleString()}</p>
                </div>
                <p className={`text-sm font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  Net Income: <span className="text-emerald-400">₱{(annualTotal.revenue - totalExpenses).toLocaleString()}</span>
                </p>
              </div>
              {yearExpenses.length === 0 ? (
                <div className={`text-center py-8 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>No expenses recorded for {selectedYear}. Add them in the Expense Records tab.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className={`border-b ${isDark ? 'border-[#1E293B]' : 'border-gray-200'}`}>
                      {['Date', 'Type', 'Description', 'Amount'].map(h => (
                        <th key={h} className={`text-left py-2.5 px-5 font-medium text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {yearExpenses.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(e => (
                      <tr key={e.id} className={`border-b last:border-0 ${isDark ? 'border-[#1E293B]' : 'border-gray-100'}`}>
                        <td className={`py-2.5 px-5 ${isDark ? 'text-white' : 'text-gray-900'}`}>{new Date(e.date).toLocaleDateString()}</td>
                        <td className={`py-2.5 px-5 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{e.type}</td>
                        <td className={`py-2.5 px-5 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{e.description || '—'}</td>
                        <td className="py-2.5 px-5 text-red-400 font-medium">₱{Number(e.amount).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      )}

      {/* ══════════════ EXPENSE RECORDS ══════════════ */}
      {activeTab === 'expenses' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Operational & Deductible Expenses — {selectedYear}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowExpenseForm(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-primary text-white hover:bg-primary/90 transition-colors"
              >
                <Plus className="w-3 h-3" />Add Expense
              </button>
              <ExportRow onCSV={exportExpensesCSV} onExcel={() => triggerExport(() => {
                const yearExpenses = expenses.filter(e => new Date(e.date).getFullYear() === selectedYear)
                const headers = ['Date', 'Type', 'Description', 'Amount (₱)']
                const rows = yearExpenses.map(e => [e.date, e.type, e.description, e.amount] as (string | number)[])
                exportExcel(headers, rows, `Expense_Records_${selectedYear}.xlsx`)
              })} />
            </div>
          </div>

          {/* Expense Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className={`${cardClass} p-5`}>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Gross Income ({selectedYear})</p>
              <p className="text-2xl font-bold text-emerald-400">₱{annualTotal.revenue.toLocaleString()}</p>
            </div>
            <div className={`${cardClass} p-5`}>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Total Expenses ({selectedYear})</p>
              <p className="text-2xl font-bold text-red-400">₱{totalExpenses.toLocaleString()}</p>
            </div>
            <div className={`${cardClass} p-5`}>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Net Income ({selectedYear})</p>
              <p className={`text-2xl font-bold ${(annualTotal.revenue - totalExpenses) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                ₱{(annualTotal.revenue - totalExpenses).toLocaleString()}
              </p>
            </div>
          </div>

          {/* Expense Table */}
          <div className={`${cardClass} overflow-x-auto`}>
            <table className="w-full text-sm">
              <thead>
                <tr className={`border-b ${isDark ? 'border-[#1E293B]' : 'border-gray-200'}`}>
                  {['No.', 'Date', 'Type', 'Description', 'Amount', ''].map(h => (
                    <th key={h} className={`text-left py-3 px-5 font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {expenses.filter(e => new Date(e.date).getFullYear() === selectedYear).length === 0 ? (
                  <tr>
                    <td colSpan={6} className={`text-center py-12 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                      No expense records for {selectedYear}
                    </td>
                  </tr>
                ) : (
                  expenses
                    .filter(e => new Date(e.date).getFullYear() === selectedYear)
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .map((e, i) => (
                      <tr key={e.id} className={`border-b last:border-0 ${isDark ? 'border-[#1E293B]' : 'border-gray-100'}`}>
                        <td className={`py-3 px-5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{i + 1}</td>
                        <td className={`py-3 px-5 ${isDark ? 'text-white' : 'text-gray-900'}`}>{new Date(e.date).toLocaleDateString()}</td>
                        <td className={`py-3 px-5 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{e.type}</td>
                        <td className={`py-3 px-5 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{e.description || '—'}</td>
                        <td className="py-3 px-5 text-red-400 font-medium">₱{e.amount.toLocaleString()}</td>
                        <td className="py-3 px-5">
                          <button onClick={() => removeExpense(e.id)} className={`p-1 rounded transition-colors ${isDark ? 'hover:bg-white/10 text-gray-500' : 'hover:bg-gray-100 text-gray-400'}`}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Add Expense Modal ──────────────────────────────── */}
      {showExpenseForm && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowExpenseForm(false)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div className={`relative w-full max-w-md rounded-xl shadow-2xl p-6 ${isDark ? 'bg-[#111D32] border border-white/10' : 'bg-white border border-gray-200'}`} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Add Expense</h3>
              <button onClick={() => setShowExpenseForm(false)} className={`p-1 rounded transition-colors ${isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'}`}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Date</label>
                <input type="date" value={expenseForm.date} onChange={e => setExpenseForm(f => ({ ...f, date: e.target.value }))}
                  className={`w-full px-3 py-2 rounded-lg border text-sm ${isDark ? 'bg-[#0A1628] border-[#1E293B] text-white' : 'bg-white border-gray-200 text-gray-900'}`} />
              </div>
              <div>
                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Expense Type</label>
                <select value={expenseForm.type} onChange={e => setExpenseForm(f => ({ ...f, type: e.target.value }))}
                  className={`w-full px-3 py-2 rounded-lg border text-sm ${isDark ? 'bg-[#0A1628] border-[#1E293B] text-white' : 'bg-white border-gray-200 text-gray-900'}`}>
                  <option value="">Select type...</option>
                  {EXPENSE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Description (optional)</label>
                <input type="text" value={expenseForm.description} onChange={e => setExpenseForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="e.g. Plumbing repair in Unit 3"
                  className={`w-full px-3 py-2 rounded-lg border text-sm ${isDark ? 'bg-[#0A1628] border-[#1E293B] text-white placeholder:text-gray-600' : 'bg-white border-gray-200 text-gray-900'}`} />
              </div>
              <div>
                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Amount (₱)</label>
                <input type="number" min="0" value={expenseForm.amount} onChange={e => setExpenseForm(f => ({ ...f, amount: e.target.value }))}
                  placeholder="0"
                  className={`w-full px-3 py-2 rounded-lg border text-sm ${isDark ? 'bg-[#0A1628] border-[#1E293B] text-white placeholder:text-gray-600' : 'bg-white border-gray-200 text-gray-900'}`} />
              </div>
              <button onClick={addExpense} disabled={!expenseForm.date || !expenseForm.type || !expenseForm.amount}
                className="w-full py-2.5 rounded-lg text-sm font-medium bg-primary text-white hover:bg-primary/90 disabled:opacity-50 transition-colors">
                Add Expense
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── Tax Forms Reference Notice ─────────────────────── */}
      {showTaxNotice && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => { setShowTaxNotice(false); setPendingExportFn(null) }}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div className={`relative w-full max-w-sm rounded-xl shadow-2xl p-6 ${isDark ? 'bg-[#111D32] border border-white/10' : 'bg-white border border-gray-200'}`} onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-amber-500/15 flex items-center justify-center">
                <FileText className="w-5 h-5 text-amber-400" />
              </div>
              <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Tax Forms Reference</h3>
            </div>
            <p className={`text-sm mb-5 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
              The reports generated are for reference only when completing official tax forms required by the Bureau of Internal Revenue (BIR).
            </p>
            <div className="flex gap-3">
              <button onClick={() => { setShowTaxNotice(false); setPendingExportFn(null) }}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition-colors ${isDark ? 'border-[#1E293B] text-gray-300 hover:bg-white/5' : 'border-gray-200 text-gray-700 hover:bg-gray-50'}`}>
                Cancel
              </button>
              <button onClick={confirmExport}
                className="flex-1 py-2.5 rounded-lg text-sm font-medium bg-primary text-white hover:bg-primary/90 transition-colors">
                Continue
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
