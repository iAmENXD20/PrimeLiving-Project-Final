import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Search, FileText, Download, Eye, X } from 'lucide-react'
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription'
import { useTheme } from '../../context/ThemeContext'
import { getTenantDocuments, type TenantDocument } from '../../lib/tenantApi'
import { TableSkeleton } from '@/components/ui/skeleton'
import TablePagination from '@/components/ui/table-pagination'

interface TenantDocumentsTabProps {
  tenantId: string
  ownerId?: string | null
}

export default function TenantDocumentsTab({ tenantId, ownerId }: TenantDocumentsTabProps) {
  const { isDark } = useTheme()
  const [documents, setDocuments] = useState<TenantDocument[]>([])
  const [loading, setLoading] = useState(true)
  const initialLoadDone = useRef(false)
  const loadVersion = useRef(0)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [viewingDoc, setViewingDoc] = useState<TenantDocument | null>(null)
  const pageSize = 10

  const loadDocs = useCallback(async (skipCache = false) => {
    const version = ++loadVersion.current
    try {
      if (!initialLoadDone.current) setLoading(true)
      const data = await getTenantDocuments(tenantId, ownerId, { skipCache })
      if (loadVersion.current !== version) return // stale response
      setDocuments(data)
      initialLoadDone.current = true
    } catch (error) {
      if (loadVersion.current !== version) return
      console.error('Failed to load tenant documents:', error)
    } finally {
      if (loadVersion.current === version) setLoading(false)
    }
  }, [tenantId, ownerId])

  useEffect(() => { loadDocs() }, [loadDocs])

  useRealtimeSubscription(`tenant-docs-${tenantId}`, [
    { table: 'documents', ...(ownerId ? { filter: `apartmentowner_id=eq.${ownerId}` } : {}), onChanged: () => loadDocs(true) },
  ])

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

      <div className="relative max-w-sm">
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
                {['No.', 'File Name', 'Unit', 'Description', 'Date', 'Action'].map((h) => (
                  <th key={h} className={`text-left py-3 px-4 font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.map((doc, idx) => (
                <tr key={doc.id} className={`border-b last:border-0 ${isDark ? 'border-[#1E293B]' : 'border-gray-100'}`}>
                  <td className={`py-3 px-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    {(page - 1) * pageSize + idx + 1}
                  </td>
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
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setViewingDoc(doc)}
                        title="View document"
                        className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-sm transition-colors ${
                          isDark ? 'text-gray-300 hover:text-primary hover:bg-primary/10' : 'text-gray-600 hover:text-primary hover:bg-primary/10'
                        }`}
                      >
                        <Eye className="w-4 h-4" />
                        View
                      </button>
                      <a
                        href={doc.file_url}
                        download
                        title="Download document"
                        className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-sm transition-colors ${
                          isDark ? 'text-gray-300 hover:text-primary hover:bg-primary/10' : 'text-gray-600 hover:text-primary hover:bg-primary/10'
                        }`}
                      >
                        <Download className="w-4 h-4" />
                      </a>
                    </div>
                  </td>
                </tr>
              ))}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className={`py-16 text-center ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
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

      {/* Document Viewer Modal */}
      {viewingDoc && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setViewingDoc(null)}>
          <div
            className={`relative w-full max-w-4xl mx-4 rounded-2xl shadow-2xl overflow-hidden ${isDark ? 'bg-[#0B1426] border border-[#1E293B]' : 'bg-white border border-gray-200'}`}
            style={{ height: '85vh' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className={`flex items-center justify-between px-6 py-4 border-b ${isDark ? 'border-[#1E293B]' : 'border-gray-200'}`}>
              <div className="flex items-center gap-3 min-w-0">
                <FileText className="w-5 h-5 text-red-400 flex-shrink-0" />
                <div className="min-w-0">
                  <p className={`text-sm font-semibold truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>{viewingDoc.file_name}</p>
                  {viewingDoc.description && (
                    <p className={`text-xs truncate ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{viewingDoc.description}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={viewingDoc.file_url}
                  download
                  className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}
                  title="Download"
                >
                  <Download className="w-4 h-4" />
                </a>
                <button
                  onClick={() => setViewingDoc(null)}
                  className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            {/* Content */}
            <div className="w-full" style={{ height: 'calc(85vh - 65px)' }}>
              {viewingDoc.file_url.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i) ? (
                <div className="flex items-center justify-center w-full h-full p-4 overflow-auto">
                  <img
                    src={viewingDoc.file_url}
                    alt={viewingDoc.file_name}
                    className="max-w-full max-h-full object-contain rounded"
                  />
                </div>
              ) : (
                <iframe
                  src={viewingDoc.file_url}
                  title={viewingDoc.file_name}
                  className="w-full h-full border-0"
                />
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
