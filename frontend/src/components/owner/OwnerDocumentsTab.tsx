import { useEffect, useState } from 'react'
import { Search, FileText, Download } from 'lucide-react'
import { useTheme } from '../../context/ThemeContext'
import { getOwnerDocuments, type OwnerDocument } from '../../lib/ownerApi'

interface OwnerDocumentsTabProps {
  clientId: string
}

export default function OwnerDocumentsTab({ clientId }: OwnerDocumentsTabProps) {
  const { isDark } = useTheme()
  const [documents, setDocuments] = useState<OwnerDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    async function loadDocuments() {
      try {
        setLoading(true)
        const data = await getOwnerDocuments(clientId)
        setDocuments(data)
      } catch (err) {
        console.error('Failed to load owner documents:', err)
      } finally {
        setLoading(false)
      }
    }

    loadDocuments()
  }, [clientId])

  const filtered = documents.filter((doc) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      doc.file_name.toLowerCase().includes(q) ||
      (doc.description ?? '').toLowerCase().includes(q) ||
      (doc.tenant_name ?? '').toLowerCase().includes(q) ||
      (doc.unit_name ?? '').toLowerCase().includes(q)
    )
  })

  const cardClass = `rounded-xl border ${isDark ? 'bg-navy-card border-[#1E293B]' : 'bg-white border-gray-200 shadow-sm'}`

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-4 animate-fade-up">
      <div>
        <h2 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Documents</h2>
        <p className={`text-base mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          View and download signed contracts and uploaded soft copies
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
        <div className={`text-center py-8 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Loading documents...</div>
      )}

      {!loading && (
        <div className={`${cardClass} overflow-x-auto flex-1 min-h-0 overflow-y-auto`}>
          <table className="w-full text-sm">
            <thead>
              <tr className={`border-b ${isDark ? 'border-[#1E293B]' : 'border-gray-200'}`}>
                {['File Name', 'Unit', 'Tenant', 'Description', 'Date', ''].map((h) => (
                  <th key={h} className={`text-left py-3 px-4 font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((doc) => (
                <tr key={doc.id} className={`border-b last:border-0 ${isDark ? 'border-[#1E293B]' : 'border-gray-100'}`}>
                  <td className={`py-3 px-4 font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-red-400 flex-shrink-0" />
                      <span className="truncate max-w-[220px]">{doc.file_name}</span>
                    </div>
                  </td>
                  <td className={`py-3 px-4 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{doc.unit_name || '—'}</td>
                  <td className={`py-3 px-4 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{doc.tenant_name || '—'}</td>
                  <td className={`py-3 px-4 max-w-[180px] truncate ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{doc.description || '—'}</td>
                  <td className={`py-3 px-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    {new Date(doc.created_at).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-4">
                    <a
                      href={doc.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Download"
                      className={`inline-flex p-2 rounded-lg transition-colors ${isDark ? 'text-gray-400 hover:text-primary hover:bg-primary/10' : 'text-gray-500 hover:text-primary hover:bg-primary/10'}`}
                    >
                      <Download className="w-4 h-4" />
                    </a>
                  </td>
                </tr>
              ))}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className={`py-16 text-center ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                    <FileText className={`w-12 h-12 mx-auto mb-3 ${isDark ? 'text-gray-600' : 'text-gray-300'}`} />
                    <p className="text-base font-medium">
                      {documents.length === 0 ? 'No documents uploaded yet' : 'No matching documents'}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
