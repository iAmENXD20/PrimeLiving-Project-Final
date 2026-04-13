import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useTheme } from '../../context/ThemeContext'

interface RentDeadline {
  unitName: string
  dueDay: number
}

interface CalendarWidgetProps {
  deadlines: RentDeadline[]
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

  // Get deadlines that fall on a specific day
  const getDeadlinesForDay = (day: number) => {
    return deadlines.filter((d) => {
      const effectiveDay = Math.min(d.dueDay, daysInMonth)
      return effectiveDay === day
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

  const cardClass = `rounded-xl border ${
    isDark ? 'bg-navy-card border-[#1E293B]' : 'bg-white border-gray-300'
  }`

  const cellBorder = isDark ? 'border-[#1E293B]' : 'border-gray-200'

  return (
    <div className={`${cardClass} flex flex-col ${className || ''}`}>
      {/* Title row */}
      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
          Calendar
        </h3>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-400" />
            <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Rent Deadline</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-primary" />
            <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Today</span>
          </div>
        </div>
      </div>

      {/* Navigation row */}
      <div className={`flex items-center justify-between px-4 py-1`}>
        <div className="flex items-center gap-1">
          <button
            onClick={prevMonth}
            className={`p-1.5 rounded-md transition-colors ${
              isDark ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-gray-100 text-gray-500'
            }`}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={goToToday}
            className={`px-3 py-1 text-xs font-medium rounded-md border transition-colors ${
              isDark
                ? 'text-gray-300 border-[#1E293B] hover:bg-white/10'
                : 'text-gray-600 border-gray-300 hover:bg-gray-100'
            }`}
          >
            Today
          </button>
          <button
            onClick={nextMonth}
            className={`p-1.5 rounded-md transition-colors ${
              isDark ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-gray-100 text-gray-500'
            }`}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <span className={`text-sm font-semibold tracking-wide uppercase ${
          isDark ? 'text-white' : 'text-gray-900'
        }`}>
          {MONTHS[currentMonth]} {currentYear}
        </span>
      </div>

      {/* Inner container for dates */}
      <div className={`mx-3 mb-3 mt-1 rounded-lg border overflow-hidden flex-1 flex flex-col ${cellBorder}`}>
        {/* Day headers */}
        <div className={`grid grid-cols-7 border-b ${cellBorder}`}>
        {DAYS.map((day) => (
          <div
            key={day}
            className={`text-center text-[11px] font-semibold py-1.5 ${
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

          return (
            <div
              key={idx}
              className={`relative border-b border-r ${cellBorder} p-0.5 min-h-[36px] group ${
                idx % 7 === 0 ? 'border-l-0' : ''
              }`}
            >
              <span
                className={`flex items-center justify-end text-sm px-1 ${
                  !cell.isCurrentMonth
                    ? isDark ? 'text-gray-600' : 'text-gray-300'
                    : isToday(cell.day)
                    ? ''
                    : isDark
                    ? 'text-gray-300'
                    : 'text-gray-700'
                }`}
              >
                {isToday(cell.day) && cell.isCurrentMonth ? (
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-white text-xs font-bold">
                    {cell.day}
                  </span>
                ) : (
                  cell.day
                )}
              </span>

              {/* Deadline dot */}
              {hasDeadline && (
                <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-red-400" />
              )}

              {/* Tooltip */}
              {hasDeadline && (
                <div
                  className={`absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-50
                    hidden group-hover:block
                    px-2.5 py-1.5 rounded-lg text-xs whitespace-nowrap shadow-lg border ${
                    isDark
                      ? 'bg-[#111C32] border-[#1E293B] text-gray-200'
                      : 'bg-white border-gray-200 text-gray-700'
                  }`}
                >
                  <p className="font-semibold text-red-400 mb-0.5">Rent Due</p>
                  {dayDeadlines.map((d) => (
                    <p key={d.unitName}>{d.unitName}</p>
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
