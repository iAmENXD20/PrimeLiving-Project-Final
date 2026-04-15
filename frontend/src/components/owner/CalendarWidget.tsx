import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useTheme } from '../../context/ThemeContext'

interface BillingDeadline {
  tenantName: string
  unitName: string
  dueDate: string   // ISO date string (e.g. period_to)
  status: string     // payment status
}

interface CalendarWidgetProps {
  deadlines: BillingDeadline[]
  className?: string
}

const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export default function CalendarWidget({ deadlines, className }: CalendarWidgetProps) {
  const { isDark } = useTheme()
  const today = new Date()
  const [currentMonth, setCurrentMonth] = useState(today.getMonth())
  const [currentYear, setCurrentYear] = useState(today.getFullYear())

  const firstDay = new Date(currentYear, currentMonth, 1).getDay()
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate()
  const prevMonthDays = new Date(currentYear, currentMonth, 0).getDate()

  const prevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11)
      setCurrentYear(currentYear - 1)
    } else {
      setCurrentMonth(currentMonth - 1)
    }
  }

  const nextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0)
      setCurrentYear(currentYear + 1)
    } else {
      setCurrentMonth(currentMonth + 1)
    }
  }

  const goToToday = () => {
    setCurrentMonth(today.getMonth())
    setCurrentYear(today.getFullYear())
  }

  const isToday = (day: number) =>
    day === today.getDate() &&
    currentMonth === today.getMonth() &&
    currentYear === today.getFullYear()

  // Get deadlines that fall on a specific day of the currently displayed month
  const getDeadlinesForDay = (day: number) => {
    return deadlines.filter((d) => {
      if (!d.dueDate) return false
      const due = new Date(d.dueDate)
      return (
        due.getDate() === day &&
        due.getMonth() === currentMonth &&
        due.getFullYear() === currentYear
      )
    })
  }

  // Build calendar grid cells: { day, isCurrentMonth }
  const cells: { day: number; isCurrentMonth: boolean }[] = []
  // Previous month trailing days
  for (let i = firstDay - 1; i >= 0; i--) {
    cells.push({ day: prevMonthDays - i, isCurrentMonth: false })
  }
  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, isCurrentMonth: true })
  }
  // Next month leading days to fill remaining row(s)
  const remaining = 7 - (cells.length % 7)
  if (remaining < 7) {
    for (let d = 1; d <= remaining; d++) {
      cells.push({ day: d, isCurrentMonth: false })
    }
  }

  const cardClass = `rounded-xl border shadow-sm ${
    isDark ? 'bg-navy-card border-[#1E293B]' : 'bg-white border-gray-200'
  }`

  const cellBorder = isDark ? 'border-[#1E293B]/60' : 'border-gray-100'

  return (
    <div className={`${cardClass} flex flex-col ${className || ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-2">
        <h3 className={`text-lg font-bold tracking-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>
          Calendar
        </h3>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-400 ring-2 ring-red-400/20" />
            <span className={`text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Billing Due</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-primary ring-2 ring-primary/20" />
            <span className={`text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Today</span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between px-5 py-2">
        <div className="flex items-center gap-1.5">
          <button
            onClick={prevMonth}
            className={`p-1.5 rounded-lg transition-all duration-200 ${
              isDark ? 'hover:bg-white/10 text-gray-400 hover:text-white' : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
            }`}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={goToToday}
            className={`px-3 py-1 text-xs font-semibold rounded-lg border transition-all duration-200 ${
              isDark
                ? 'text-primary border-primary/30 hover:bg-primary/10 hover:border-primary/50'
                : 'text-primary border-primary/30 hover:bg-primary/5 hover:border-primary/50'
            }`}
          >
            Today
          </button>
          <button
            onClick={nextMonth}
            className={`p-1.5 rounded-lg transition-all duration-200 ${
              isDark ? 'hover:bg-white/10 text-gray-400 hover:text-white' : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
            }`}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <span className={`text-sm font-bold tracking-wider uppercase ${
          isDark ? 'text-white' : 'text-gray-800'
        }`}>
          {MONTHS[currentMonth]} {currentYear}
        </span>
      </div>

      {/* Calendar body */}
      <div className={`mx-4 mb-4 mt-1 rounded-xl border overflow-hidden flex-1 flex flex-col ${isDark ? 'border-[#1E293B]' : 'border-gray-200'}`}>
        {/* Day headers */}
        <div className={`grid grid-cols-7 ${isDark ? 'bg-[#0A1628]' : 'bg-gray-50'}`}>
          {DAYS.map((day) => (
            <div
              key={day}
              className={`text-center text-[11px] font-bold tracking-wider py-2.5 ${
                isDark ? 'text-gray-500' : 'text-gray-400'
              }`}
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 flex-1">
          {cells.map((cell, idx) => {
            const dayDeadlines = cell.isCurrentMonth ? getDeadlinesForDay(cell.day) : []
            const hasDeadline = dayDeadlines.length > 0
            const isSaturday = idx % 7 === 6
            const isSunday = idx % 7 === 0

            return (
              <div
                key={idx}
                className={`relative border-b border-r ${cellBorder} min-h-[40px] flex flex-col items-center justify-center group transition-colors duration-150 ${
                  idx % 7 === 6 ? 'border-r-0' : ''
                } ${
                  cell.isCurrentMonth
                    ? isDark ? 'hover:bg-white/[0.03]' : 'hover:bg-gray-50/80'
                    : ''
                }`}
              >
                <span
                  className={`text-sm leading-none ${
                    !cell.isCurrentMonth
                      ? isDark ? 'text-gray-700' : 'text-gray-300'
                      : isToday(cell.day)
                      ? ''
                      : (isSaturday || isSunday)
                      ? isDark ? 'text-gray-500' : 'text-gray-400'
                      : isDark
                      ? 'text-gray-300'
                      : 'text-gray-700'
                  }`}
                >
                  {isToday(cell.day) && cell.isCurrentMonth ? (
                    <span className="flex items-center justify-center w-7 h-7 rounded-full bg-primary text-white text-xs font-bold shadow-md shadow-primary/30">
                      {cell.day}
                    </span>
                  ) : (
                    <span className="font-medium">{cell.day}</span>
                  )}
                </span>

                {/* Deadline indicator */}
                {hasDeadline && (
                  <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-red-400 shadow-sm shadow-red-400/40" />
                )}

                {/* Tooltip */}
                {hasDeadline && (
                  <div
                    className={`absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-50
                      hidden group-hover:block
                      px-3 py-2 rounded-lg text-xs whitespace-nowrap shadow-xl border backdrop-blur-sm ${
                      isDark
                        ? 'bg-[#111C32]/95 border-[#1E293B] text-gray-200'
                        : 'bg-white/95 border-gray-200 text-gray-700'
                    }`}
                  >
                    <p className="font-bold text-red-400 mb-1">Billing Due</p>
                    {dayDeadlines.map((d) => (
                      <p key={d.tenantName + d.unitName} className="leading-relaxed">
                        {d.tenantName} — {d.unitName}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
