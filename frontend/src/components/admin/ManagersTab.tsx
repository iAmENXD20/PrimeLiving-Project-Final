import { Search } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useTheme } from '../../context/ThemeContext'
import { getManagers, type Manager } from '../../lib/api'
import { TableSkeleton } from '@/components/ui/skeleton'
import TablePagination from '@/components/ui/table-pagination'

export default function ManagersTab() {
  const { isDark } = useTheme()
  const [search, setSearch] = useState('')
  const [managers, setManagers] = useState<Manager[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const pageSize = 10

  useEffect(() => {
    loadManagers()
  }, [])

  async function loadManagers() {
    try {
      setLoading(true)
      const data = await getManagers()
      setManagers(data)
    } catch (err) {
      console.error('Failed to load managers:', err)
    } finally {
      setLoading(false)
    }
  }

  const filtered = managers.filter(
    (m) =>
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.email.toLowerCase().includes(search.toLowerCase()) ||
      (m.client_name || '').toLowerCase().includes(search.toLowerCase())
  )

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize)

  useEffect(() => {
    setPage(1)
  }, [search, managers.length])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const cardClass = `rounded-xl border ${
    isDark
      ? 'bg-navy-card border-[#1E293B]'
      : 'bg-white border-gray-200 shadow-sm'
  }`

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-6 animate-fade-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Apartment Managers
          </h2>
          <p className={`text-base mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            View apartment managers assigned by apartment owners
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search
          className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${
            isDark ? 'text-gray-500' : 'text-gray-400'
          }`}
        />
        <input
          type="text"
          placeholder="Search managers..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={`w-full pl-10 pr-4 py-3 rounded-lg text-base border focus:outline-none focus:ring-2 focus:ring-primary/50 ${
            isDark
              ? 'bg-[#0A1628] border-[#1E293B] text-white placeholder-gray-500'
              : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'
          }`}
        />
      </div>

      {/* Table */}
      <div className={`${cardClass} flex-1 min-h-0 flex flex-col overflow-hidden`}>
        <div className="overflow-auto flex-1">
          <table className="w-full text-base">
            <thead>
              <tr className={`border-b ${isDark ? 'border-[#1E293B]' : 'border-gray-200'}`}>
                {['Name', 'Email', 'Phone', 'Assigned Apartment Owner', 'Status', 'Joined'].map(
                  (h) => (
                    <th
                      key={h}
                      className={`text-left py-3.5 px-4 font-medium ${
                        isDark ? 'text-gray-400' : 'text-gray-500'
                      }`}
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6} className="py-3 px-4">
                    <TableSkeleton rows={5} />
                  </td>
                </tr>
              )}
              {!loading && paginated.map((manager) => (
                <tr
                  key={manager.id}
                  className={`border-b last:border-0 transition-colors ${
                    isDark
                      ? 'border-[#1E293B] hover:bg-white/[0.02]'
                      : 'border-gray-100 hover:bg-gray-50'
                  }`}
                >
                  <td className={`py-3.5 px-4 font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {manager.name}
                  </td>
                  <td className={`py-3.5 px-4 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                    {manager.email}
                  </td>
                  <td className={`py-3.5 px-4 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                    {manager.phone || '—'}
                  </td>
                  <td className={`py-3.5 px-4 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                    {manager.client_name || (
                      <span className={isDark ? 'text-gray-500' : 'text-gray-400'}>Unassigned</span>
                    )}
                  </td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`inline-block px-2.5 py-0.5 text-xs font-medium rounded-full ${
                        manager.status === 'active'
                          ? 'bg-emerald-500/15 text-emerald-400'
                          : 'bg-gray-500/15 text-gray-400'
                      }`}
                    >
                      {manager.status}
                    </span>
                  </td>
                  <td className={`py-3.5 px-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    {manager.joined_date ? new Date(manager.joined_date).toLocaleDateString() : '—'}
                  </td>
                </tr>
              ))}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className={`py-8 text-center ${
                      isDark ? 'text-gray-500' : 'text-gray-400'
                    }`}
                  >
                    No managers found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {!loading && (
        <TablePagination
          currentPage={page}
          totalPages={totalPages}
          totalItems={filtered.length}
          pageSize={pageSize}
          onPageChange={setPage}
          isDark={isDark}
        />
      )}
    </div>
  )
}
