import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useTheme } from '../../context/ThemeContext'
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription'
import { getOwnerPayments, getOwnerProperties, getExpenses, createExpense, deleteExpense, getOwnerTenants, getOwnerMaintenanceRequests, getOwnerUnits, type OwnerPayment, type Property, type Expense, type OwnerTenant, type MaintenanceRequest } from '../../lib/ownerApi'
import { PhilippinePeso, TrendingUp, Calendar, Download, ChevronDown, Plus, Trash2, X, Printer, FileText, AlertTriangle, ChevronLeft, ChevronRight, BarChart2, PieChart as PieChartIcon } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area,
} from 'recharts'
import { TableSkeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'

interface OwnerAuditReportsTabProps {
  ownerId: string
}

type SectionTab = 'quarterly' | 'annual' | 'expenses' | 'tenants' | 'maintenance' | 'analytics'

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
  const initialLoadDone = useRef(false)
  const loadVersion = useRef(0)
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

  const [tenants, setTenants] = useState<OwnerTenant[]>([])
  const [maintenanceRequests, setMaintenanceRequests] = useState<MaintenanceRequest[]>([])
  const [tenantPage, setTenantPage] = useState(1)
  const [maintPage, setMaintPage] = useState(1)

  // Expense records (persisted to DB)
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [showExpenseForm, setShowExpenseForm] = useState(false)
  const [expenseForm, setExpenseForm] = useState({ date: '', type: '', description: '', amount: '' })

  // Tax forms reference popup
  const [showTaxNotice, setShowTaxNotice] = useState(false)
  const [pendingExportFn, setPendingExportFn] = useState<(() => void) | null>(null)

  // Analytics chunk mode
  const [analyticsChunkMode, setAnalyticsChunkMode] = useState<'monthly' | 'quarterly'>('monthly')

  // Pagination state
  const ROWS_PER_PAGE = 10
  const [qPayPage, setQPayPage] = useState(1)
  const [aPayPage, setAPayPage] = useState(1)
  const [aExpPage, setAExpPage] = useState(1)
  const [expPage, setExpPage] = useState(1)

  // Reset pages when filters change
  useEffect(() => { setQPayPage(1); setAPayPage(1); setAExpPage(1); setExpPage(1); setTenantPage(1); setMaintPage(1) }, [selectedYear, selectedQuarter, selectedProperty])

  const loadReports = useCallback((skipCache = false) => {
    const version = ++loadVersion.current
    if (!initialLoadDone.current) setLoading(true)
    const opts = { skipCache }
    Promise.all([getOwnerPayments(ownerId, opts), getOwnerProperties(ownerId, opts), getExpenses(ownerId, undefined, opts), getOwnerTenants(ownerId, true, opts), getOwnerMaintenanceRequests(ownerId), getOwnerUnits(ownerId, opts)])
      .then(([p, props, exp, ten, maint, units]) => {
        if (loadVersion.current !== version) return
        // Build unit name map
        const unitNameMap = new Map(units.map(u => [u.id, u.name]))
        const enrichedTenants = ten.map((t: any) => ({
          ...t,
          apartment_name: t.unit_id ? unitNameMap.get(t.unit_id) || '—' : '—',
        }))
        setPayments(p); setProperties(props); setExpenses(exp); setTenants(enrichedTenants); setMaintenanceRequests(maint); initialLoadDone.current = true
      })
      .catch(() => { if (loadVersion.current !== version) return; setPayments([]); setProperties([]); setExpenses([]); setTenants([]); setMaintenanceRequests([]) })
      .finally(() => { if (loadVersion.current === version) setLoading(false) })
  }, [ownerId])

  useEffect(() => { loadReports() }, [ownerId])

  // Real-time: auto-refresh when payments, expenses, tenants, or maintenance change
  useRealtimeSubscription(`owner-audit-${ownerId}`, [
    { table: 'payments', filter: `apartmentowner_id=eq.${ownerId}`, onChanged: () => loadReports(true) },
    { table: 'expenses', filter: `apartmentowner_id=eq.${ownerId}`, onChanged: () => loadReports(true) },
    { table: 'tenants', filter: `apartmentowner_id=eq.${ownerId}`, onChanged: () => loadReports(true) },
    { table: 'maintenance_requests', filter: `apartmentowner_id=eq.${ownerId}`, onChanged: () => loadReports(true) },
  ])

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
      const freshExpenses = await getExpenses(ownerId, undefined, { skipCache: true })
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
      const freshExpenses = await getExpenses(ownerId, undefined, { skipCache: true })
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

  // ── Pagination Controls ───────────────────────────────────
  function PaginationControls({ page, totalItems, onPageChange }: { page: number; totalItems: number; onPageChange: (p: number) => void }) {
    const totalPages = Math.ceil(totalItems / ROWS_PER_PAGE)
    if (totalPages <= 1) return null
    return (
      <div className={`flex items-center justify-between px-5 py-3 border-t ${isDark ? 'border-[#1E293B]' : 'border-gray-200'}`}>
        <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
          Showing {((page - 1) * ROWS_PER_PAGE) + 1}–{Math.min(page * ROWS_PER_PAGE, totalItems)} of {totalItems}
        </p>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className={`p-1.5 rounded-lg transition-colors ${page <= 1 ? 'opacity-30 cursor-not-allowed' : isDark ? 'hover:bg-white/10 text-gray-300' : 'hover:bg-gray-100 text-gray-600'}`}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
            .reduce<(number | '...')[]>((acc, p, i, arr) => {
              if (i > 0 && p - (arr[i - 1]) > 1) acc.push('...')
              acc.push(p)
              return acc
            }, [])
            .map((p, i) =>
              p === '...' ? (
                <span key={`dot-${i}`} className={`px-1.5 text-xs ${isDark ? 'text-gray-600' : 'text-gray-300'}`}>…</span>
              ) : (
                <button
                  key={p}
                  onClick={() => onPageChange(p)}
                  className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${
                    p === page ? 'bg-primary text-white' : isDark ? 'text-gray-300 hover:bg-white/10' : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {p}
                </button>
              )
            )}
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            className={`p-1.5 rounded-lg transition-colors ${page >= totalPages ? 'opacity-30 cursor-not-allowed' : isDark ? 'hover:bg-white/10 text-gray-300' : 'hover:bg-gray-100 text-gray-600'}`}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
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
        { key: 'tenants' as SectionTab, label: 'Tenant Directory' },
        { key: 'maintenance' as SectionTab, label: 'Maintenance Report' },
        { key: 'analytics' as SectionTab, label: 'Analytics' },
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
                  {quarterlyPaymentRecords.slice((qPayPage - 1) * ROWS_PER_PAGE, qPayPage * ROWS_PER_PAGE).map((p, i) => (
                    <tr key={p.id} className={`border-b last:border-0 ${isDark ? 'border-[#1E293B]' : 'border-gray-100'}`}>
                      <td className={`py-2.5 px-5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{(qPayPage - 1) * ROWS_PER_PAGE + i + 1}</td>
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
              <PaginationControls page={qPayPage} totalItems={quarterlyPaymentRecords.length} onPageChange={setQPayPage} />
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
                  {annualPaymentRecords.slice((aPayPage - 1) * ROWS_PER_PAGE, aPayPage * ROWS_PER_PAGE).map((p, i) => (
                    <tr key={p.id} className={`border-b last:border-0 ${isDark ? 'border-[#1E293B]' : 'border-gray-100'}`}>
                      <td className={`py-2.5 px-5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{(aPayPage - 1) * ROWS_PER_PAGE + i + 1}</td>
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
              <PaginationControls page={aPayPage} totalItems={annualPaymentRecords.length} onPageChange={setAPayPage} />
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
                <>
                <table className="w-full text-sm">
                  <thead>
                    <tr className={`border-b ${isDark ? 'border-[#1E293B]' : 'border-gray-200'}`}>
                      {['Date', 'Type', 'Description', 'Amount'].map(h => (
                        <th key={h} className={`text-left py-2.5 px-5 font-medium text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {yearExpenses.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice((aExpPage - 1) * ROWS_PER_PAGE, aExpPage * ROWS_PER_PAGE).map(e => (
                      <tr key={e.id} className={`border-b last:border-0 ${isDark ? 'border-[#1E293B]' : 'border-gray-100'}`}>
                        <td className={`py-2.5 px-5 ${isDark ? 'text-white' : 'text-gray-900'}`}>{new Date(e.date).toLocaleDateString()}</td>
                        <td className={`py-2.5 px-5 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{e.type}</td>
                        <td className={`py-2.5 px-5 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{e.description || '—'}</td>
                        <td className="py-2.5 px-5 text-red-400 font-medium">₱{Number(e.amount).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <PaginationControls page={aExpPage} totalItems={yearExpenses.length} onPageChange={setAExpPage} />
                </>
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
                    .slice((expPage - 1) * ROWS_PER_PAGE, expPage * ROWS_PER_PAGE)
                    .map((e, i) => (
                      <tr key={e.id} className={`border-b last:border-0 ${isDark ? 'border-[#1E293B]' : 'border-gray-100'}`}>
                        <td className={`py-3 px-5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{(expPage - 1) * ROWS_PER_PAGE + i + 1}</td>
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
            <PaginationControls page={expPage} totalItems={expenses.filter(e => new Date(e.date).getFullYear() === selectedYear).length} onPageChange={setExpPage} />
          </div>
        </div>
      )}

      {/* ══════════════ TENANT DIRECTORY ══════════════ */}
      {activeTab === 'tenants' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <p className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              {tenants.length} tenant{tenants.length !== 1 ? 's' : ''} across all units
            </p>
            <ExportRow
              onCSV={() => triggerExport(() => {
                const headers = ['No.', 'Name', 'Email', 'Phone', 'Unit', 'Status', 'Monthly Rent (₱)', 'Move-in Date']
                const rows = tenants.map((t, i) => [
                  i + 1,
                  `${t.first_name} ${t.last_name}`,
                  (t as any).email || '—',
                  t.phone || '—',
                  (t as any).apartment_name || t.unit_id || '—',
                  t.status,
                  t.monthly_rent ?? '—',
                  (t as any).move_in_date ? new Date((t as any).move_in_date).toLocaleDateString() : '—',
                ] as (string | number)[])
                exportCSV(headers, rows, `Tenant_Directory_${new Date().toISOString().slice(0, 10)}.csv`)
              })}
              onExcel={() => triggerExport(async () => {
                const headers = ['No.', 'Name', 'Email', 'Phone', 'Unit', 'Status', 'Monthly Rent (₱)', 'Move-in Date']
                const rows = tenants.map((t, i) => [
                  i + 1,
                  `${t.first_name} ${t.last_name}`,
                  (t as any).email || '—',
                  t.phone || '—',
                  (t as any).apartment_name || t.unit_id || '—',
                  t.status,
                  t.monthly_rent ?? '—',
                  (t as any).move_in_date ? new Date((t as any).move_in_date).toLocaleDateString() : '—',
                ] as (string | number)[])
                await exportExcel(headers, rows, `Tenant_Directory_${new Date().toISOString().slice(0, 10)}.xlsx`)
              })}
              onPDF={() => triggerExport(async () => {
                const { default: jsPDF } = await import('jspdf')
                const autoTable = (await import('jspdf-autotable')).default
                const doc = new jsPDF('landscape')
                doc.setFontSize(18)
                doc.text('Tenant Directory', 14, 20)
                doc.setFontSize(11)
                doc.text(`Generated: ${new Date().toLocaleDateString()}  —  Total: ${tenants.length} tenant(s)`, 14, 28)
                autoTable(doc, {
                  startY: 36,
                  head: [['No.', 'Name', 'Email', 'Phone', 'Unit', 'Status', 'Rent (PHP)', 'Move-in']],
                  body: tenants.map((t, i) => [
                    i + 1,
                    `${t.first_name} ${t.last_name}`,
                    (t as any).email || '—',
                    t.phone || '—',
                    (t as any).apartment_name || '—',
                    t.status,
                    t.monthly_rent ? Number(t.monthly_rent).toLocaleString() : '—',
                    (t as any).move_in_date ? new Date((t as any).move_in_date).toLocaleDateString() : '—',
                  ]),
                  styles: { fontSize: 8 },
                })
                doc.save(`Tenant_Directory_${new Date().toISOString().slice(0, 10)}.pdf`)
              })}
            />
          </div>
          {loading ? <TableSkeleton rows={5} /> : (
            <div className={`${cardClass} overflow-x-auto`}>
              <table className="w-full text-sm">
                <thead>
                  <tr className={`border-b ${isDark ? 'border-[#1E293B]' : 'border-gray-200'}`}>
                    {['No.', 'Name', 'Email', 'Phone', 'Unit', 'Status', 'Monthly Rent', 'Move-in'].map(h => (
                      <th key={h} className={`text-left py-3 px-4 font-medium text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tenants.length === 0 ? (
                    <tr><td colSpan={8} className={`text-center py-12 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>No tenants found</td></tr>
                  ) : tenants.slice((tenantPage - 1) * ROWS_PER_PAGE, tenantPage * ROWS_PER_PAGE).map((t, i) => (
                    <tr key={t.id} className={`border-b last:border-0 ${isDark ? 'border-[#1E293B]' : 'border-gray-100'}`}>
                      <td className={`py-2.5 px-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{(tenantPage - 1) * ROWS_PER_PAGE + i + 1}</td>
                      <td className={`py-2.5 px-4 font-medium ${isDark ? 'text-white' : 'text-gray-900'} whitespace-nowrap`}>{t.first_name} {t.last_name}</td>
                      <td className={`py-2.5 px-4 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{(t as any).email || '—'}</td>
                      <td className={`py-2.5 px-4 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{t.phone || '—'}</td>
                      <td className={`py-2.5 px-4 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{(t as any).apartment_name || '—'}</td>
                      <td className="py-2.5 px-4">
                        <span className={`inline-block px-2 py-0.5 text-xs rounded-full font-medium ${
                          t.status === 'active' ? 'bg-emerald-500/15 text-emerald-400'
                          : t.status === 'pending' || t.status === 'pending_verification' ? 'bg-amber-500/15 text-amber-400'
                          : 'bg-gray-500/15 text-gray-400'
                        }`}>{t.status}</span>
                      </td>
                      <td className={`py-2.5 px-4 font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {t.monthly_rent ? `₱${Number(t.monthly_rent).toLocaleString()}` : '—'}
                      </td>
                      <td className={`py-2.5 px-4 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                        {(t as any).move_in_date ? new Date((t as any).move_in_date).toLocaleDateString() : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <PaginationControls page={tenantPage} totalItems={tenants.length} onPageChange={setTenantPage} />
            </div>
          )}
        </div>
      )}

      {/* ══════════════ MAINTENANCE REPORT ══════════════ */}
      {activeTab === 'maintenance' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <p className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              {maintenanceRequests.length} request{maintenanceRequests.length !== 1 ? 's' : ''} total
            </p>
            <ExportRow
              onCSV={() => triggerExport(() => {
                const headers = ['No.', 'Title', 'Description', 'Tenant', 'Priority', 'Status', 'Date', 'Review Comment']
                const rows = maintenanceRequests.map((m, i) => [
                  i + 1, m.title, m.description, m.tenant_name || '—', m.priority, m.status,
                  new Date(m.created_at).toLocaleDateString(),
                  m.review_comment || '—',
                ] as (string | number)[])
                exportCSV(headers, rows, `Maintenance_Report_${new Date().toISOString().slice(0, 10)}.csv`)
              })}
              onExcel={() => triggerExport(async () => {
                const headers = ['No.', 'Title', 'Description', 'Tenant', 'Priority', 'Status', 'Date', 'Review Comment']
                const rows = maintenanceRequests.map((m, i) => [
                  i + 1, m.title, m.description, m.tenant_name || '—', m.priority, m.status,
                  new Date(m.created_at).toLocaleDateString(),
                  m.review_comment || '—',
                ] as (string | number)[])
                await exportExcel(headers, rows, `Maintenance_Report_${new Date().toISOString().slice(0, 10)}.xlsx`)
              })}
              onPDF={() => triggerExport(async () => {
                const { default: jsPDF } = await import('jspdf')
                const autoTable = (await import('jspdf-autotable')).default
                const doc = new jsPDF('landscape')
                doc.setFontSize(18)
                doc.text('Maintenance Report', 14, 20)
                doc.setFontSize(11)
                doc.text(`Generated: ${new Date().toLocaleDateString()}  —  Total: ${maintenanceRequests.length}`, 14, 28)
                const pending = maintenanceRequests.filter(m => m.status === 'pending').length
                const inProgress = maintenanceRequests.filter(m => m.status === 'in_progress').length
                const resolved = maintenanceRequests.filter(m => m.status === 'resolved' || m.status === 'closed').length
                doc.text(`Pending: ${pending}  |  In Progress: ${inProgress}  |  Resolved/Closed: ${resolved}`, 14, 36)
                autoTable(doc, {
                  startY: 44,
                  head: [['No.', 'Title', 'Description', 'Tenant', 'Priority', 'Status', 'Date', 'Review Comment']],
                  body: maintenanceRequests.map((m, i) => [
                    i + 1, m.title, m.description, m.tenant_name || '—', m.priority, m.status.replace('_', ' '),
                    new Date(m.created_at).toLocaleDateString(),
                    m.review_comment || '—',
                  ]),
                  styles: { fontSize: 7 },
                })
                doc.save(`Maintenance_Report_${new Date().toISOString().slice(0, 10)}.pdf`)
              })}
            />
          </div>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Pending', count: maintenanceRequests.filter(m => m.status === 'pending').length, color: 'text-amber-400', bg: 'bg-amber-500/15' },
              { label: 'In Progress', count: maintenanceRequests.filter(m => m.status === 'in_progress').length, color: 'text-blue-400', bg: 'bg-blue-500/15' },
              { label: 'Resolved', count: maintenanceRequests.filter(m => m.status === 'resolved').length, color: 'text-emerald-400', bg: 'bg-emerald-500/15' },
              { label: 'Closed', count: maintenanceRequests.filter(m => m.status === 'closed').length, color: 'text-gray-400', bg: 'bg-gray-500/15' },
            ].map(card => (
              <div key={card.label} className={`${cardClass} p-4`}>
                <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{card.label}</p>
                <p className={`text-2xl font-bold mt-1 ${card.color}`}>{card.count}</p>
              </div>
            ))}
          </div>
          {loading ? <TableSkeleton rows={5} /> : (
            <div className={`${cardClass} overflow-x-auto`}>
              <table className="w-full text-sm">
                <thead>
                  <tr className={`border-b ${isDark ? 'border-[#1E293B]' : 'border-gray-200'}`}>
                    {['No.', 'Title', 'Description', 'Tenant', 'Priority', 'Status', 'Date'].map(h => (
                      <th key={h} className={`text-left py-3 px-4 font-medium text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {maintenanceRequests.length === 0 ? (
                    <tr><td colSpan={7} className={`text-center py-12 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>No maintenance requests found</td></tr>
                  ) : maintenanceRequests.slice((maintPage - 1) * ROWS_PER_PAGE, maintPage * ROWS_PER_PAGE).map((m, i) => (
                    <tr key={m.id} className={`border-b last:border-0 ${isDark ? 'border-[#1E293B]' : 'border-gray-100'}`}>
                      <td className={`py-2.5 px-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{(maintPage - 1) * ROWS_PER_PAGE + i + 1}</td>
                      <td className={`py-2.5 px-4 font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{m.title}</td>
                      <td className={`py-2.5 px-4 max-w-[180px] truncate ${isDark ? 'text-gray-300' : 'text-gray-600'}`} title={m.description}>{m.description}</td>
                      <td className={`py-2.5 px-4 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{m.tenant_name || '—'}</td>
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
                    </tr>
                  ))}
                </tbody>
              </table>
              <PaginationControls page={maintPage} totalItems={maintenanceRequests.length} onPageChange={setMaintPage} />
            </div>
          )}
        </div>
      )}

      {/* ══════════════ ANALYTICS ══════════════ */}
      {activeTab === 'analytics' && (() => {
        // ── Colors ───────────────────────────────────────────
        const PAID_COLOR = '#10b981'
        const PENDING_COLOR = '#f59e0b'
        const OVERDUE_COLOR = '#ef4444'
        const EXPENSE_COLOR = '#6366f1'
        const EXPENSE_PIE_COLORS = ['#6366f1', '#8b5cf6', '#a855f7', '#ec4899', '#f43f5e', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#64748b']

        // ── All-time totals ──────────────────────────────────
        const allTimePaid = payments.filter(isPaid).reduce((s, p) => s + Number(p.amount), 0)
        const allTimeExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0)
        const allTimeNet = allTimePaid - allTimeExpenses
        const allTimePending = payments.filter(isPending).reduce((s, p) => s + Number(p.amount), 0)
        const allTimeOverdue = payments.filter(isOverdue).reduce((s, p) => s + Number(p.amount), 0)
        const paidCount = payments.filter(isPaid).length
        const totalCount = payments.length
        const collectionRate = totalCount > 0 ? Math.round((paidCount / totalCount) * 100) : 0
        const expenseToIncomeRatio = allTimePaid > 0 ? Math.round((allTimeExpenses / allTimePaid) * 100) : 0

        // ── Monthly chart data (12 months for selected year) ─
        const monthlyChartData = Array.from({ length: 12 }, (_, i) => {
          const monthPayments = filteredPayments.filter(p =>
            new Date(p.payment_date).getFullYear() === selectedYear && new Date(p.payment_date).getMonth() === i
          )
          const monthExpenses = expenses.filter(e =>
            new Date(e.date).getFullYear() === selectedYear && new Date(e.date).getMonth() === i
          )
          const revenue = monthPayments.filter(isPaid).reduce((s, p) => s + Number(p.amount), 0)
          const expense = monthExpenses.reduce((s, e) => s + Number(e.amount), 0)
          return {
            period: new Date(selectedYear, i).toLocaleString('default', { month: 'short' }),
            Revenue: revenue,
            Expenses: expense,
            Net: revenue - expense,
          }
        })

        // ── Quarterly chunk data ─────────────────────────────
        const quarterlyChartData = [1, 2, 3, 4].map(q => {
          const startMonth = (q - 1) * 3
          const qPayments = filteredPayments.filter(p => {
            const d = new Date(p.payment_date)
            return d.getFullYear() === selectedYear && d.getMonth() >= startMonth && d.getMonth() < startMonth + 3
          })
          const qExpenses = expenses.filter(e => {
            const d = new Date(e.date)
            return d.getFullYear() === selectedYear && d.getMonth() >= startMonth && d.getMonth() < startMonth + 3
          })
          const revenue = qPayments.filter(isPaid).reduce((s, p) => s + Number(p.amount), 0)
          const expense = qExpenses.reduce((s, e) => s + Number(e.amount), 0)
          return { period: QUARTER_LABELS[q], Revenue: revenue, Expenses: expense, Net: revenue - expense }
        })

        // ── Chunk toggle state (monthly / quarterly) ─────────
        const chartData = analyticsChunkMode === 'quarterly' ? quarterlyChartData : monthlyChartData

        // ── Maintenance analytics (aligned with year + chunk) ─
        const maintenanceYearRequests = maintenanceRequests.filter(r =>
          new Date(r.created_at).getFullYear() === selectedYear
        )

        const maintenanceStatusData = [
          { name: 'Pending', count: maintenanceYearRequests.filter(r => r.status === 'pending').length, fill: '#EF4444' },
          { name: 'In Progress', count: maintenanceYearRequests.filter(r => r.status === 'in_progress').length, fill: '#F59E0B' },
          { name: 'Resolved', count: maintenanceYearRequests.filter(r => r.status === 'resolved').length, fill: '#3b82f6' },
          { name: 'Closed', count: maintenanceYearRequests.filter(r => r.status === 'closed').length, fill: '#22C55E' },
        ].filter(d => d.count > 0)

        const maintenanceCategoryMap: Record<string, number> = {}
        maintenanceYearRequests.forEach(r => {
          if (r.category) maintenanceCategoryMap[r.category] = (maintenanceCategoryMap[r.category] || 0) + 1
        })
        const maintenanceCategoryData = Object.entries(maintenanceCategoryMap)
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count)

        const maintenanceMonthlyData = Array.from({ length: 12 }, (_, i) => ({
          period: new Date(selectedYear, i).toLocaleString('default', { month: 'short' }),
          count: maintenanceYearRequests.filter(r => new Date(r.created_at).getMonth() === i).length,
        }))

        const maintenanceQuarterlyData = [1, 2, 3, 4].map(q => {
          const startMonth = (q - 1) * 3
          const count = maintenanceYearRequests.filter(r => {
            const m = new Date(r.created_at).getMonth()
            return m >= startMonth && m < startMonth + 3
          }).length
          return { period: QUARTER_LABELS[q], count }
        })

        const maintenanceTrendData = analyticsChunkMode === 'quarterly'
          ? maintenanceQuarterlyData
          : maintenanceMonthlyData

        // ── Year-over-year comparison ────────────────────────
        const prevYear = selectedYear - 1
        const prevYearPaid = filteredPayments
          .filter(p => new Date(p.payment_date).getFullYear() === prevYear && isPaid(p))
          .reduce((s, p) => s + Number(p.amount), 0)
        const yoyChange = prevYearPaid > 0 ? ((totalIncome - prevYearPaid) / prevYearPaid) * 100 : null

        // ── Month-over-month growth ──────────────────────────
        const currentMonthIdx = monthlyChartData.findLastIndex(m => m.Revenue > 0)
        const prevMonthIdx = currentMonthIdx > 0 ? currentMonthIdx - 1 : -1
        const currentMonthRevenue = currentMonthIdx >= 0 ? monthlyChartData[currentMonthIdx].Revenue : 0
        const prevMonthRevenue = prevMonthIdx >= 0 ? monthlyChartData[prevMonthIdx].Revenue : 0
        const momChange = prevMonthRevenue > 0 ? ((currentMonthRevenue - prevMonthRevenue) / prevMonthRevenue) * 100 : null

        // ── Status pie data ──────────────────────────────────
        const statusPieData = [
          { name: 'Paid', value: yearPayments.filter(isPaid).reduce((s, p) => s + Number(p.amount), 0), color: PAID_COLOR },
          { name: 'Pending', value: yearPayments.filter(isPending).reduce((s, p) => s + Number(p.amount), 0), color: PENDING_COLOR },
          { name: 'Overdue', value: yearPayments.filter(isOverdue).reduce((s, p) => s + Number(p.amount), 0), color: OVERDUE_COLOR },
        ].filter(d => d.value > 0)

        // ── Expense breakdown ────────────────────────────────
        const expenseByType = yearExpenses.reduce<Record<string, number>>((acc, e) => {
          acc[e.type] = (acc[e.type] || 0) + Number(e.amount)
          return acc
        }, {})
        const expensePieData = Object.entries(expenseByType)
          .map(([name, value]) => ({ name, value }))
          .sort((a, b) => b.value - a.value)

        // ── Top months ───────────────────────────────────────
        const topMonths = [...monthlyChartData].sort((a, b) => b.Revenue - a.Revenue).slice(0, 3)

        // ── Descriptive insights ─────────────────────────────
        const bestMonth = monthlyChartData.reduce((best, m) => m.Revenue > best.Revenue ? m : best, monthlyChartData[0])
        const worstMonth = monthlyChartData.filter(m => m.Revenue > 0).reduce((w, m) => m.Revenue < w.Revenue ? m : w, monthlyChartData.find(m => m.Revenue > 0) || monthlyChartData[0])
        const highestExpenseType = expensePieData[0]
        const activeMos = monthlyChartData.filter(m => m.Revenue > 0).length
        const lossMonths = monthlyChartData.filter(m => m.Revenue > 0 && m.Net < 0).length

        function buildInsights(): { type: 'success' | 'warning' | 'danger' | 'info'; text: string }[] {
          const insights: { type: 'success' | 'warning' | 'danger' | 'info'; text: string }[] = []
          if (totalCount === 0) {
            insights.push({ type: 'info', text: `No payments recorded in ${selectedYear} yet. Start by adding tenants and payment records.` })
            return insights
          }
          // Collection rate
          if (collectionRate >= 90) insights.push({ type: 'success', text: `Excellent collection rate of ${collectionRate}% — almost all payments are being settled on time.` })
          else if (collectionRate >= 70) insights.push({ type: 'info', text: `Collection rate is ${collectionRate}%, which is moderate. Sending payment reminders could help push this above 90%.` })
          else insights.push({ type: 'danger', text: `Collection rate is only ${collectionRate}%. A large portion of payments are unpaid. Consider following up with tenants on overdue balances.` })
          // Year-over-year
          if (yoyChange !== null) {
            if (yoyChange > 0) insights.push({ type: 'success', text: `Revenue grew by ${Math.abs(yoyChange).toFixed(1)}% compared to ${prevYear} (₱${prevYearPaid.toLocaleString()} → ₱${totalIncome.toLocaleString()}).` })
            else if (yoyChange < -5) insights.push({ type: 'warning', text: `Revenue dropped by ${Math.abs(yoyChange).toFixed(1)}% versus ${prevYear}. Review vacancy and overdue trends.` })
            else insights.push({ type: 'info', text: `Revenue is relatively stable compared to ${prevYear} (${yoyChange >= 0 ? '+' : ''}${yoyChange.toFixed(1)}% change).` })
          }
          // Month-over-month
          if (momChange !== null && currentMonthIdx >= 0) {
            const mLabel = monthlyChartData[currentMonthIdx].period
            if (momChange > 10) insights.push({ type: 'success', text: `${mLabel} showed a strong ${momChange.toFixed(1)}% revenue increase compared to the previous active month.` })
            else if (momChange < -10) insights.push({ type: 'warning', text: `Revenue in ${mLabel} declined by ${Math.abs(momChange).toFixed(1)}% compared to the prior month.` })
          }
          // Best month
          if (bestMonth.Revenue > 0) insights.push({ type: 'info', text: `Best month in ${selectedYear}: ${bestMonth.period} with ₱${bestMonth.Revenue.toLocaleString()} in collections.` })
          // Loss months
          if (lossMonths > 0) insights.push({ type: 'warning', text: `${lossMonths} month${lossMonths > 1 ? 's' : ''} in ${selectedYear} ran at a net loss (expenses exceeded revenue).` })
          // Expense ratio
          if (expenseToIncomeRatio > 70) insights.push({ type: 'danger', text: `Expenses account for ${expenseToIncomeRatio}% of total income — very high. Consider reviewing recurring costs.` })
          else if (expenseToIncomeRatio > 40) insights.push({ type: 'warning', text: `Expenses are ${expenseToIncomeRatio}% of income. Keep monitoring to maintain a healthy margin.` })
          else if (expenseToIncomeRatio > 0) insights.push({ type: 'success', text: `Expense ratio is ${expenseToIncomeRatio}% — well managed. Net profit margin looks healthy.` })
          // Overdue alert
          if (allTimeOverdue > 0) insights.push({ type: 'danger', text: `₱${allTimeOverdue.toLocaleString()} in overdue payments across all records. These may need direct follow-up.` })
          // Largest expense category
          if (highestExpenseType) insights.push({ type: 'info', text: `Largest expense category in ${selectedYear}: ${highestExpenseType.name} at ₱${highestExpenseType.value.toLocaleString()}.` })
          return insights
        }

        const insights = buildInsights()
        // Match the site's dark-navy palette; left-border accent for type
        const insightLeft: Record<string, string> = {
          success: 'border-l-emerald-500',
          warning: 'border-l-amber-500',
          danger: 'border-l-red-500',
          info: 'border-l-blue-500',
        }
        const insightIconColor: Record<string, string> = {
          success: 'text-emerald-400',
          warning: 'text-amber-400',
          danger: 'text-red-400',
          info: 'text-blue-400',
        }
        const insightBase = isDark
          ? 'border border-[#1E293B] bg-[#0A1628] border-l-4'
          : 'border border-gray-200 bg-white border-l-4'
        const insightText = isDark ? 'text-gray-300' : 'text-gray-700'

        const tooltipStyle = { backgroundColor: isDark ? '#111D32' : '#fff', borderColor: isDark ? '#1E293B' : '#e5e7eb', color: isDark ? '#fff' : '#111827' }
        const axisColor = isDark ? '#6b7280' : '#9ca3af'
        const gridColor = isDark ? '#1E293B' : '#f3f4f6'

        return (
          <div className="space-y-6">

            {/* ── Smart Insights Panel ─────────────────────── */}
            <div className={`${cardClass} p-5`}>
              <div className="flex items-center gap-2 mb-3">
                <BarChart2 className={`w-4 h-4 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
                <p className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Financial Insights — {selectedYear}</p>
                <span className={`ml-auto text-xs px-2 py-0.5 rounded-full ${isDark ? 'bg-white/5 text-gray-400' : 'bg-gray-100 text-gray-500'}`}>
                  {activeMos} active month{activeMos !== 1 ? 's' : ''} of data
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {insights.map((ins, i) => (
                  <div key={i} className={`flex items-start gap-2.5 rounded-lg px-4 py-3 text-sm ${insightBase} ${insightLeft[ins.type]} ${insightText}`}>
                    <span className={`mt-0.5 flex-shrink-0 font-bold text-xs ${insightIconColor[ins.type]}`}>
                      {ins.type === 'success' ? '✓' : ins.type === 'warning' ? '!' : ins.type === 'danger' ? '✕' : '→'}
                    </span>
                    {ins.text}
                  </div>
                ))}
              </div>
            </div>

            {/* ── All-time KPI strip ─────────────────────────── */}
            <div>
              <p className={`text-xs font-semibold uppercase tracking-wider mb-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>All-time Overview</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {[
                  { label: 'Total Income', value: `₱${allTimePaid.toLocaleString()}`, color: 'text-emerald-400', bg: 'bg-emerald-500/15', icon: PhilippinePeso, desc: 'Total verified collected revenue' },
                  { label: 'Total Expenses', value: `₱${allTimeExpenses.toLocaleString()}`, color: 'text-indigo-400', bg: 'bg-indigo-500/15', icon: TrendingUp, desc: 'All recorded operational costs' },
                  { label: 'Net Profit', value: `₱${allTimeNet.toLocaleString()}`, color: allTimeNet >= 0 ? 'text-emerald-400' : 'text-red-400', bg: allTimeNet >= 0 ? 'bg-emerald-500/15' : 'bg-red-500/15', icon: BarChart2, desc: 'Income minus all expenses' },
                  { label: 'Pending', value: `₱${allTimePending.toLocaleString()}`, color: 'text-amber-400', bg: 'bg-amber-500/15', icon: Calendar, desc: 'Payments awaiting verification' },
                  { label: 'Overdue', value: `₱${allTimeOverdue.toLocaleString()}`, color: 'text-red-400', bg: 'bg-red-500/15', icon: AlertTriangle, desc: 'Past-due payments not collected' },
                  { label: 'Collection Rate', value: `${collectionRate}%`, color: collectionRate >= 80 ? 'text-emerald-400' : collectionRate >= 50 ? 'text-amber-400' : 'text-red-400', bg: 'bg-blue-500/15', icon: PieChartIcon, desc: `${paidCount} of ${totalCount} payments paid` },
                ].map(card => (
                  <div key={card.label} className={`${cardClass} p-4 group relative`} title={card.desc}>
                    <div className={`w-8 h-8 rounded-lg ${card.bg} flex items-center justify-center mb-2`}>
                      <card.icon className={`w-4 h-4 ${card.color}`} />
                    </div>
                    <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'} mb-0.5`}>{card.label}</p>
                    <p className={`text-base font-bold ${card.color}`}>{card.value}</p>
                    <p className={`text-[10px] mt-1 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>{card.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Year quick stats row ───────────────────────── */}
            <div className={`${cardClass} p-4`}>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>
                  <strong className={isDark ? 'text-white' : 'text-gray-900'}>{selectedYear} Summary</strong>
                </span>
                <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>
                  Revenue: <span className="font-semibold text-emerald-400">₱{totalIncome.toLocaleString()}</span>
                </span>
                <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>
                  Expenses: <span className="font-semibold text-indigo-400">₱{totalExpenses.toLocaleString()}</span>
                </span>
                <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>
                  Net: <span className={`font-semibold ${(totalIncome - totalExpenses) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>₱{(totalIncome - totalExpenses).toLocaleString()}</span>
                </span>
                {yoyChange !== null && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${yoyChange >= 0 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
                    {yoyChange >= 0 ? '+' : ''}{yoyChange.toFixed(1)}% vs {prevYear}
                  </span>
                )}
                {momChange !== null && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${momChange >= 0 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'}`}>
                    MoM: {momChange >= 0 ? '+' : ''}{momChange.toFixed(1)}%
                  </span>
                )}
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${expenseToIncomeRatio <= 40 ? 'bg-emerald-500/15 text-emerald-400' : expenseToIncomeRatio <= 70 ? 'bg-amber-500/15 text-amber-400' : 'bg-red-500/15 text-red-400'}`}>
                  Exp/Inc ratio: {expenseToIncomeRatio}%
                </span>
              </div>
            </div>

            {/* ── Income vs Expenses Chart (chunk toggle) ─────── */}
            <div className={`${cardClass} p-5`}>
              <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
                <div>
                  <p className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Income vs Expenses</p>
                  <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    {analyticsChunkMode === 'monthly' ? 'Monthly breakdown' : 'Quarterly chunks'} for {selectedYear}
                    {selectedProperty !== 'all' ? ` · ${properties.find(p => p.id === selectedProperty)?.name || ''}` : ' · All Apartments'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {/* Chunk mode toggle */}
                  <div className={`flex rounded-lg border p-0.5 ${isDark ? 'border-[#1E293B] bg-[#0A1628]' : 'border-gray-200 bg-gray-50'}`}>
                    {(['monthly', 'quarterly'] as const).map(mode => (
                      <button
                        key={mode}
                        onClick={() => setAnalyticsChunkMode(mode)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors capitalize ${
                          analyticsChunkMode === mode
                            ? 'bg-primary text-white'
                            : isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'
                        }`}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                  <DropdownBtn
                    value={String(selectedYear)}
                    isOpen={isYearOpen}
                    onToggle={() => setIsYearOpen(!isYearOpen)}
                    parentRef={yearRef}
                    options={availableYears.map(y => ({ key: String(y), label: String(y), onClick: () => { setSelectedYear(y); setIsYearOpen(false) } }))}
                  />
                </div>
              </div>
              {chartData.every(d => d.Revenue === 0 && d.Expenses === 0) ? (
                <div className={`flex items-center justify-center h-48 text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                  No income or expense data for {selectedYear}. Try a different year.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                    <XAxis dataKey="period" tick={{ fill: axisColor, fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: axisColor, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `₱${(v / 1000).toFixed(0)}k`} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: number, name: string) => [`₱${v.toLocaleString()}`, name]} />
                    <Legend wrapperStyle={{ fontSize: 12, color: axisColor }} />
                    <Bar dataKey="Revenue" name="Revenue" fill={PAID_COLOR} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Expenses" name="Expenses" fill={EXPENSE_COLOR} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
              <p className={`text-xs mt-3 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                {chartData.filter(d => d.Revenue > 0).length} period{chartData.filter(d => d.Revenue > 0).length !== 1 ? 's' : ''} with revenue recorded.
                {lossMonths > 0 && ` ⚠ ${lossMonths} month${lossMonths > 1 ? 's' : ''} where expenses exceeded revenue.`}
              </p>
            </div>

            {/* ── Net Income Trend ──────────────────────────────── */}
            <div className={`${cardClass} p-5`}>
              <p className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Net Income Trend</p>
              <p className={`text-xs mt-0.5 mb-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                Revenue minus expenses per month — positive means profitable, negative means operating at a loss.
              </p>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={monthlyChartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="netGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={PAID_COLOR} stopOpacity={0.25} />
                      <stop offset="95%" stopColor={PAID_COLOR} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                  <XAxis dataKey="period" tick={{ fill: axisColor, fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: axisColor, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `₱${(v / 1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`₱${v.toLocaleString()}`, 'Net Income']} />
                  <Area type="monotone" dataKey="Net" stroke={PAID_COLOR} fill="url(#netGradient)" strokeWidth={2} dot={{ r: 3 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* ── Two-column: status donut + expense pie ──────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Payment Status Distribution */}
              <div className={`${cardClass} p-5`}>
                <p className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Payment Status Distribution</p>
                <p className={`text-xs mt-0.5 mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{selectedYear} — breakdown by collected amount</p>
                {statusPieData.length > 0 ? (
                  <>
                    <p className={`text-xs mb-3 italic ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                      {statusPieData.find(d => d.name === 'Paid') ? `${Math.round((statusPieData.find(d => d.name === 'Paid')!.value / statusPieData.reduce((s, d) => s + d.value, 0)) * 100)}% of total billings are fully paid.` : 'No paid payments this year.'}
                      {statusPieData.find(d => d.name === 'Overdue') ? ` ₱${statusPieData.find(d => d.name === 'Overdue')!.value.toLocaleString()} is overdue.` : ''}
                    </p>
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie data={statusPieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                          {statusPieData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                        </Pie>
                        <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`₱${v.toLocaleString()}`, undefined]} />
                        <Legend wrapperStyle={{ fontSize: 12, color: axisColor }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </>
                ) : (
                  <div className={`flex items-center justify-center h-48 text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>No payment data for {selectedYear}.</div>
                )}
              </div>

              {/* Expense Breakdown by Type */}
              <div className={`${cardClass} p-5`}>
                <p className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Expense Breakdown by Type</p>
                <p className={`text-xs mt-0.5 mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{selectedYear} — where money is going</p>
                {expensePieData.length > 0 ? (
                  <>
                    <p className={`text-xs mb-3 italic ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                      {`Largest cost: ${expensePieData[0].name} at ₱${expensePieData[0].value.toLocaleString()} (${Math.round((expensePieData[0].value / yearExpenses.reduce((s, e) => s + Number(e.amount), 0)) * 100)}% of total).`}
                    </p>
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie data={expensePieData} cx="50%" cy="50%" outerRadius={85} paddingAngle={3} dataKey="value">
                          {expensePieData.map((_, index) => <Cell key={`exp-${index}`} fill={EXPENSE_PIE_COLORS[index % EXPENSE_PIE_COLORS.length]} />)}
                        </Pie>
                        <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`₱${v.toLocaleString()}`, undefined]} />
                        <Legend wrapperStyle={{ fontSize: 11, color: axisColor }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </>
                ) : (
                  <div className={`flex items-center justify-center h-48 text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>No expenses logged for {selectedYear}. Add expenses in the Expense Records tab.</div>
                )}
              </div>
            </div>

            {/* ── Top Revenue Months + Worst Month ────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className={`${cardClass} p-5`}>
                <p className={`font-semibold mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>Top Revenue Months</p>
                <p className={`text-xs mb-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  Highest-earning months of {selectedYear} — use these to identify seasonal patterns.
                </p>
                {topMonths.every(m => m.Revenue === 0) ? (
                  <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>No paid payments in {selectedYear}.</p>
                ) : (
                  <div className="space-y-3">
                    {topMonths.map((m, i) => (
                      <div key={m.period} className="flex items-center gap-3">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                          i === 0 ? 'bg-yellow-400/20 text-yellow-400' : i === 1 ? 'bg-gray-400/20 text-gray-400' : 'bg-amber-700/20 text-amber-700'
                        }`}>{i + 1}</span>
                        <span className={`w-10 text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{m.period}</span>
                        <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: isDark ? 'rgba(255,255,255,0.08)' : '#f3f4f6' }}>
                          <div className="h-full rounded-full bg-emerald-400" style={{ width: `${topMonths[0].Revenue > 0 ? (m.Revenue / topMonths[0].Revenue) * 100 : 0}%` }} />
                        </div>
                        <span className="text-sm font-semibold text-emerald-400 flex-shrink-0">₱{m.Revenue.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Monthly detail table */}
              <div className={`${cardClass} p-5`}>
                <p className={`font-semibold mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>Monthly Snapshot</p>
                <p className={`text-xs mb-3 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Revenue, expenses, and net for each month of {selectedYear}.</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className={`border-b ${isDark ? 'border-[#1E293B]' : 'border-gray-200'}`}>
                        {['Month', 'Revenue', 'Expenses', 'Net'].map(h => (
                          <th key={h} className={`text-left py-2 px-2 font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {monthlyChartData.map(row => (
                        <tr key={row.period} className={`border-b last:border-0 ${isDark ? 'border-[#1E293B]' : 'border-gray-100'} ${row.Revenue === 0 && row.Expenses === 0 ? 'opacity-30' : ''}`}>
                          <td className={`py-1.5 px-2 font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{row.period}</td>
                          <td className="py-1.5 px-2 text-emerald-400 font-medium">{row.Revenue > 0 ? `₱${row.Revenue.toLocaleString()}` : '—'}</td>
                          <td className="py-1.5 px-2 text-indigo-400">{row.Expenses > 0 ? `₱${row.Expenses.toLocaleString()}` : '—'}</td>
                          <td className={`py-1.5 px-2 font-semibold ${row.Net > 0 ? 'text-emerald-400' : row.Net < 0 ? 'text-red-400' : isDark ? 'text-gray-600' : 'text-gray-300'}`}>
                            {row.Revenue > 0 || row.Expenses > 0 ? `₱${row.Net.toLocaleString()}` : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* ── Maintenance Analytics ─────────────────────────── */}
            <div className={`${cardClass} p-5`}>
              <p className={`font-semibold mb-0.5 ${isDark ? 'text-white' : 'text-gray-900'}`}>Maintenance Overview</p>
              <p className={`text-xs mb-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                {selectedYear} maintenance metrics, synchronized with {analyticsChunkMode} view
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                {[
                  { label: 'Total', value: maintenanceYearRequests.length, color: isDark ? 'text-white' : 'text-gray-900' },
                  { label: 'Pending', value: maintenanceYearRequests.filter(r => r.status === 'pending').length, color: 'text-red-400' },
                  { label: 'In Progress', value: maintenanceYearRequests.filter(r => r.status === 'in_progress').length, color: 'text-yellow-400' },
                  { label: 'Closed', value: maintenanceYearRequests.filter(r => r.status === 'closed' || r.status === 'resolved').length, color: 'text-emerald-400' },
                ].map(item => (
                  <div key={item.label} className={`rounded-lg p-4 text-center border ${isDark ? 'bg-[#0A1628] border-[#1E293B]' : 'bg-gray-50 border-gray-200'}`}>
                    <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
                    <p className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{item.label}</p>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Status bar chart */}
                <div>
                  <p className={`text-xs font-medium mb-3 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Requests by Status</p>
                  {maintenanceStatusData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={180}>
                        <BarChart data={maintenanceStatusData} layout="vertical" margin={{ left: 8, right: 16 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
                          <XAxis type="number" tick={{ fill: axisColor, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                          <YAxis type="category" dataKey="name" tick={{ fill: axisColor, fontSize: 11 }} axisLine={false} tickLine={false} width={72} />
                          <Tooltip contentStyle={tooltipStyle} />
                          <Bar dataKey="count" name="Requests" radius={[0, 4, 4, 0]}>
                            {maintenanceStatusData.map((d, i) => <Cell key={`ms-${d.name}-${i}`} fill={d.fill} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <p className={`text-sm text-center py-8 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>No maintenance requests in {selectedYear}</p>
                    )}
                </div>
                {/* Category bar chart */}
                <div>
                  <p className={`text-xs font-medium mb-3 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Requests by Category</p>
                  {maintenanceCategoryData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={180}>
                        <BarChart data={maintenanceCategoryData} layout="vertical" margin={{ left: 8, right: 16 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
                          <XAxis type="number" tick={{ fill: axisColor, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                          <YAxis type="category" dataKey="name" tick={{ fill: axisColor, fontSize: 11 }} axisLine={false} tickLine={false} width={72} />
                          <Tooltip contentStyle={tooltipStyle} />
                          <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} name="Requests" />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <p className={`text-sm text-center py-8 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>No category data in {selectedYear}</p>
                    )}
                </div>
              </div>
              {/* Trend chart synchronized with monthly/quarterly toggle */}
              <div className="mt-4">
                <p className={`text-xs font-medium mb-3 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  Requests per {analyticsChunkMode === 'quarterly' ? 'Quarter' : 'Month'}
                </p>
                {maintenanceTrendData.some(d => d.count > 0) ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={maintenanceTrendData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                      <XAxis dataKey="period" tick={{ fill: axisColor, fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: axisColor, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Requests" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className={`text-sm text-center py-8 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                    No maintenance requests in {selectedYear}
                  </p>
                )}
              </div>
            </div>

          </div>
        )
      })()}

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
