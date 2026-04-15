import { useState, useRef, useEffect } from 'react'
import { ChevronLeft, ChevronRight, ChevronDown, Calendar } from 'lucide-react'

interface DatePickerProps {
  value: string // YYYY-MM-DD
  onChange: (date: string) => void
  min?: string
  placeholder?: string
  isDark: boolean
  className?: string
  upward?: boolean
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

export default function DatePicker({ value, onChange, min, placeholder = 'Select date', isDark, className, upward }: DatePickerProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const today = new Date()
  const selected = value ? new Date(value + 'T00:00:00') : null
  const minDate = min ? new Date(min + 'T00:00:00') : null

  const [viewMonth, setViewMonth] = useState(selected?.getMonth() ?? today.getMonth())
  const [viewYear, setViewYear] = useState(selected?.getFullYear() ?? today.getFullYear())
  const [monthDropdownOpen, setMonthDropdownOpen] = useState(false)
  const monthDropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (value) {
      const d = new Date(value + 'T00:00:00')
      setViewMonth(d.getMonth())
      setViewYear(d.getFullYear())
    }
  }, [value])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
      if (monthDropdownRef.current && !monthDropdownRef.current.contains(e.target as Node)) setMonthDropdownOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1) }
    else setViewMonth(viewMonth - 1)
  }

  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1) }
    else setViewMonth(viewMonth + 1)
  }

  function getDays() {
    const firstDay = new Date(viewYear, viewMonth, 1).getDay()
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate()

    const cells: { day: number; current: boolean; dateStr: string }[] = []

    // Previous month trailing days
    for (let i = firstDay - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i
      const m = viewMonth === 0 ? 11 : viewMonth - 1
      const y = viewMonth === 0 ? viewYear - 1 : viewYear
      cells.push({ day: d, current: false, dateStr: `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}` })
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({
        day: d,
        current: true,
        dateStr: `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
      })
    }

    // Next month leading days
    const remaining = 42 - cells.length
    for (let d = 1; d <= remaining; d++) {
      const m = viewMonth === 11 ? 0 : viewMonth + 1
      const y = viewMonth === 11 ? viewYear + 1 : viewYear
      cells.push({ day: d, current: false, dateStr: `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}` })
    }

    return cells
  }

  function isDisabled(dateStr: string) {
    if (!minDate) return false
    return new Date(dateStr + 'T00:00:00') < minDate
  }

  function isToday(dateStr: string) {
    const t = today
    const todayStr = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
    return dateStr === todayStr
  }

  function handleSelect(dateStr: string) {
    if (isDisabled(dateStr)) return
    onChange(dateStr)
    setOpen(false)
  }

  function handleToday() {
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    if (isDisabled(todayStr)) return
    onChange(todayStr)
    setOpen(false)
  }

  function handleClear() {
    onChange('')
    setOpen(false)
  }

  const displayValue = selected
    ? selected.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : ''

  const cells = getDays()

  return (
    <div ref={ref} className={`relative ${className || ''}`}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center justify-between rounded-lg px-4 py-2.5 text-sm border transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500/40 ${
          isDark
            ? 'bg-[#0A1628] border-[#1E293B] text-white'
            : 'bg-gray-50 border-gray-200 text-gray-900'
        }`}
      >
        <span className={!displayValue ? (isDark ? 'text-gray-500' : 'text-gray-400') : ''}>
          {displayValue || placeholder}
        </span>
        <Calendar className={`w-4 h-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
      </button>

      {/* Dropdown Calendar */}
      <div
        className={`absolute left-0 ${upward ? 'bottom-full mb-1' : 'mt-1'} z-30 w-[290px] rounded-xl border shadow-xl transition-all duration-200 ${upward ? 'origin-bottom' : 'origin-top'} ${
          open ? 'opacity-100 scale-y-100 pointer-events-auto' : 'opacity-0 scale-y-75 pointer-events-none'
        } ${isDark ? 'bg-[#111C32] border-[#1E293B]' : 'bg-white border-gray-200'}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-3">
          <button
            type="button"
            onClick={prevMonth}
            className={`p-1 rounded-lg transition-colors ${isDark ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-1">
            <div ref={monthDropdownRef} className="relative">
              <button
                type="button"
                onClick={() => setMonthDropdownOpen(!monthDropdownOpen)}
                className={`flex items-center gap-0.5 text-sm font-semibold rounded-md px-2 py-0.5 transition-colors ${
                  isDark ? 'text-white hover:bg-white/10' : 'text-gray-900 hover:bg-gray-100'
                }`}
              >
                {MONTHS[viewMonth]}
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${monthDropdownOpen ? 'rotate-180' : ''} ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
              </button>
              {monthDropdownOpen && (
                <div
                  className={`absolute top-full left-1/2 -translate-x-1/2 mt-1 w-40 rounded-xl border p-1 shadow-2xl overflow-hidden ${
                    isDark ? 'bg-[#0F1A2E] border-[#1E293B]' : 'bg-white border-gray-200'
                  }`}
                  style={{ zIndex: 9999 }}
                >
                  <div className="max-h-52 overflow-y-auto">
                    {MONTHS.map((m, i) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => { setViewMonth(i); setMonthDropdownOpen(false) }}
                        className={`w-full text-left px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                          i === viewMonth
                            ? 'bg-primary text-white'
                            : isDark
                              ? 'text-gray-300 hover:bg-white/10'
                              : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <input
              type="text"
              inputMode="numeric"
              maxLength={4}
              value={viewYear}
              onFocus={(e) => e.target.select()}
              onChange={(e) => {
                const raw = e.target.value.replace(/\D/g, '').slice(0, 4)
                if (raw === '') {
                  setViewYear(0 as any)
                  return
                }
                setViewYear(parseInt(raw))
              }}
              onBlur={() => {
                if (!viewYear || viewYear < 1900) setViewYear(1900)
                if (viewYear > 2100) setViewYear(2100)
              }}
              onKeyDown={(e) => {
                if (!/\d/.test(e.key) && !['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Home', 'End'].includes(e.key) && !e.ctrlKey && !e.metaKey) {
                  e.preventDefault()
                }
              }}
              className={`text-sm font-semibold bg-transparent border-none w-16 text-center focus:outline-none rounded-md px-1 py-0.5 transition-colors ${
                isDark ? 'text-white hover:bg-white/10 focus:bg-white/10' : 'text-gray-900 hover:bg-gray-100 focus:bg-gray-100'
              }`}
            />
          </div>
          <button
            type="button"
            onClick={nextMonth}
            className={`p-1 rounded-lg transition-colors ${isDark ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 px-3">
          {DAYS.map((d) => (
            <div key={d} className={`text-center text-xs font-medium py-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7 px-3 pb-2">
          {cells.map((cell, idx) => {
            const isSelected = value === cell.dateStr
            const disabled = isDisabled(cell.dateStr)
            const todayMark = isToday(cell.dateStr)

            return (
              <button
                key={idx}
                type="button"
                onClick={() => handleSelect(cell.dateStr)}
                disabled={disabled}
                className={`w-9 h-9 mx-auto rounded-lg text-xs font-medium transition-colors ${
                  isSelected
                    ? 'bg-primary text-white'
                    : todayMark
                      ? isDark ? 'bg-primary/20 text-primary font-bold' : 'bg-primary/10 text-primary font-bold'
                      : disabled
                        ? isDark ? 'text-gray-700 cursor-not-allowed' : 'text-gray-300 cursor-not-allowed'
                        : !cell.current
                          ? isDark ? 'text-gray-600 hover:bg-white/5' : 'text-gray-300 hover:bg-gray-50'
                          : isDark ? 'text-gray-300 hover:bg-white/10' : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                {cell.day}
              </button>
            )
          })}
        </div>

        {/* Footer */}
        <div className={`flex items-center justify-between px-4 py-2.5 border-t ${isDark ? 'border-[#1E293B]' : 'border-gray-100'}`}>
          <button
            type="button"
            onClick={handleClear}
            className={`text-xs font-medium transition-colors ${isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'}`}
          >
            Clear
          </button>
          <button
            type="button"
            onClick={handleToday}
            className="text-xs font-medium text-primary hover:text-primary/80 transition-colors"
          >
            Today
          </button>
        </div>
      </div>
    </div>
  )
}
