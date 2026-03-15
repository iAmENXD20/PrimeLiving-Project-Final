import { useEffect, useMemo, useState } from 'react'
import { Search, FileText, Download } from 'lucide-react'
import { useTheme } from '../../context/ThemeContext'
import { getTenantDocuments, type TenantDocument } from '../../lib/tenantApi'
import { TableSkeleton } from '@/components/ui/skeleton'
import TablePagination from '@/components/ui/table-pagination'

interface TenantDocumentsTabProps {
  tenantId: string
  clientId?: string | null
}

export default function TenantDocumentsTab({ tenantId, clientId }: TenantDocumentsTabProps) {
  const { isDark } = useTheme()
  const [documents, setDocuments] = useState<TenantDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 10

  useEffect(() => {
    async function load() {
      try {
        setLoading(true)
        const data = await getTenantDocuments(tenantId, clientId)
        setDocuments(data)
      } catch (error) {
        console.error('Failed to load tenant documents:', error)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [tenantId, clientId])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return documents

    return documents.filter((doc) =>
      doc.file_name.toLowerCase().includes(query) ||
      (doc.description || '').toLowerCase().includes(query) ||
      (doc.unit_name || '').toLowerCase().includes(query),
    )
  }, [documents, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize)

  useEffect(() => {
    setPage(1)
  }, [search, documents.length])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const cardClass = `rounded-xl border ${isDark ? 'bg-navy-card border-[#1E293B]' : 'bg-white border-gray-200 shadow-sm'}`

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-4 animate-fade-up">
      <div>
        <p className={`text-base ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          View documents assigned to your account
        </p>
      </div>

      <div className="relative">
        <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
        <input
          type="text"
          placeholder="Search documents..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={`w-full pl-10 pr-4 py-2.5 rounded-lg border text-sm transition-colors ${
            isDark
              ? 'bg-[#111D32] border-[#1E293B] text-white placeholder-gray-500 focus:border-primary'
              : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-primary'
          } focus:outline-none`}
        />
      </div>

      {loading && (
        <TableSkeleton rows={6} />
      )}

      {!loading && (
        <div className={`${cardClass} overflow-x-auto flex-1 min-h-0 overflow-y-auto`}>
          <table className="w-full text-sm">
            <thead>
              <tr className={`border-b ${isDark ? 'border-[#1E293B]' : 'border-gray-200'}`}>
                {['File Name', 'Unit', 'Description', 'Date', ''].map((h) => (
                  <th key={h} className={`text-left py-3 px-4 font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.map((doc) => (
                <tr key={doc.id} className={`border-b last:border-0 ${isDark ? 'border-[#1E293B]' : 'border-gray-100'}`}>
                  <td className={`py-3 px-4 font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-red-400 flex-shrink-0" />
                      <span className="truncate max-w-[220px]">{doc.file_name}</span>
                    </div>
                  </td>
                  <td className={`py-3 px-4 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                    {doc.unit_name || '—'}
                  </td>
                  <td className={`py-3 px-4 max-w-[220px] truncate ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    {doc.description || '—'}
                  </td>
                  <td className={`py-3 px-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    {new Date(doc.created_at).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-4">
                    <a
                      href={doc.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Open document"
                      className={`inline-flex items-center gap-2 px-2 py-1 rounded-lg text-sm transition-colors ${
                        isDark ? 'text-gray-300 hover:text-primary hover:bg-primary/10' : 'text-gray-600 hover:text-primary hover:bg-primary/10'
                      }`}
                    >
                      <Download className="w-4 h-4" />
                      Open
                    </a>
                  </td>
                </tr>
              ))}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className={`py-16 text-center ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                    <FileText className={`w-12 h-12 mx-auto mb-3 ${isDark ? 'text-gray-600' : 'text-gray-300'}`} />
                    <p className="text-base font-medium">
                      {documents.length === 0 ? 'No documents assigned yet' : 'No matching documents'}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

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
