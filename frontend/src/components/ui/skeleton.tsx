import { cn } from '@/lib/utils'

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-gray-200 dark:bg-[#1E293B]', className)} />
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-[#1E293B] dark:bg-[#111D32]">
      <Skeleton className="h-6 w-48 mb-4" />
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="grid grid-cols-4 gap-3">
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function CardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="rounded-xl border border-gray-200 bg-white p-4 dark:border-[#1E293B] dark:bg-[#111D32]">
          <Skeleton className="h-4 w-24 mb-3" />
          <Skeleton className="h-8 w-20 mb-2" />
          <Skeleton className="h-3 w-28" />
        </div>
      ))}
    </div>
  )
}

/** Full-page skeleton that mimics the complete dashboard layout */
export function DashboardPageSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Page title */}
      <div className="space-y-2">
        <div className="h-8 w-56 rounded-lg bg-gray-200 dark:bg-[#1E293B]" />
        <div className="h-4 w-72 rounded bg-gray-200 dark:bg-[#1E293B]" />
      </div>

      {/* Stat cards row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-[#1E293B] dark:bg-[#111D32]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gray-200 dark:bg-[#1E293B]" />
              <div className="space-y-2 flex-1">
                <div className="h-3 w-20 rounded bg-gray-200 dark:bg-[#1E293B]" />
                <div className="h-6 w-16 rounded bg-gray-200 dark:bg-[#1E293B]" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Wide content block (chart / activity / main panel) */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-[#1E293B] dark:bg-[#111D32]">
        <div className="h-5 w-40 rounded bg-gray-200 dark:bg-[#1E293B] mb-5" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex-shrink-0 bg-gray-200 dark:bg-[#1E293B]" />
              <div className="flex-1 space-y-2">
                <div className="h-3 rounded bg-gray-200 dark:bg-[#1E293B]" style={{ width: `${65 + (i % 3) * 10}%` }} />
                <div className="h-2.5 w-28 rounded bg-gray-200 dark:bg-[#1E293B]" />
              </div>
              <div className="h-6 w-16 rounded-lg bg-gray-200 dark:bg-[#1E293B] flex-shrink-0" />
            </div>
          ))}
        </div>
      </div>

      {/* Secondary two-column row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[0, 1].map(col => (
          <div key={col} className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-[#1E293B] dark:bg-[#111D32]">
            <div className="h-4 w-32 rounded bg-gray-200 dark:bg-[#1E293B] mb-4" />
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="h-3 flex-1 rounded bg-gray-200 dark:bg-[#1E293B]" style={{ width: `${50 + i * 15}%` }} />
                  <div className="h-3 w-16 rounded bg-gray-200 dark:bg-[#1E293B] flex-shrink-0" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
