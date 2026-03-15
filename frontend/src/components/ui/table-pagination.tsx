import { ChevronLeft, ChevronRight } from 'lucide-react'

interface TablePaginationProps {
  currentPage: number
  totalPages: number
  totalItems: number
  pageSize: number
  onPageChange: (page: number) => void
  isDark?: boolean
}

export default function TablePagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  isDark = false,
}: TablePaginationProps) {
  if (totalItems <= pageSize) return null

  const start = (currentPage - 1) * pageSize + 1
  const end = Math.min(currentPage * pageSize, totalItems)

  return (
    <div className="mt-3 flex items-center justify-between gap-3">
      <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
        Showing {start}-{end} of {totalItems}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          className={`inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
            isDark
              ? 'border-[#1E293B] text-gray-300 hover:bg-white/5'
              : 'border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          <ChevronLeft className="w-4 h-4" /> Prev
        </button>
        <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          Page {currentPage} of {totalPages}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className={`inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
            isDark
              ? 'border-[#1E293B] text-gray-300 hover:bg-white/5'
              : 'border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          Next <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
