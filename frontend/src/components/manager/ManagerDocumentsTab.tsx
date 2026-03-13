import { useEffect, useState, useRef } from 'react'
import { Upload, FileText, Trash2, Download, Search, ChevronDown } from 'lucide-react'
import { useTheme } from '../../context/ThemeContext'
import {
  getDocuments,
  uploadDocument,
  deleteDocument,
  getManagerUnits,
  createAnnouncement,
  type Document,
  type UnitWithTenant,
} from '../../lib/managerApi'
import { toast } from 'sonner'

interface ManagerDocumentsTabProps {
  clientId: string
  managerId: string
}

export default function ManagerDocumentsTab({ clientId, managerId }: ManagerDocumentsTabProps) {
  const { isDark } = useTheme()
  const [documents, setDocuments] = useState<Document[]>([])
  const [units, setUnits] = useState<UnitWithTenant[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [search, setSearch] = useState('')

  // Upload form state
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [description, setDescription] = useState('')
  const [selectedUnit, setSelectedUnit] = useState('')
  const [unitDropdownOpen, setUnitDropdownOpen] = useState(false)
  const unitDropdownRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function load() {
    try {
      const [docs, unitsData] = await Promise.all([
        getDocuments(clientId),
        getManagerUnits(clientId),
      ])
      setDocuments(docs)
      setUnits(unitsData)
    } catch (err) {
      console.error('Failed to load documents:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [clientId])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (unitDropdownRef.current && !unitDropdownRef.current.contains(e.target as Node)) {
        setUnitDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error('Please select a PDF file')
      return
    }
    if (selectedFile.type !== 'application/pdf') {
      toast.error('Only PDF files are allowed')
      return
    }

    setUploading(true)
    try {
      const unit = units.find(u => u.id === selectedUnit)
      await uploadDocument(
        selectedFile,
        clientId,
        managerId,
        unit?.id || null,
        unit?.tenant_id || null,
        description,
      )

      // Notify tenant if document is assigned to a unit with a tenant
      if (unit?.tenant_id && unit?.tenant_name) {
        await createAnnouncement(
          clientId,
          '📄 New Document Received',
          `A new document "${selectedFile.name}" has been shared with you${description ? `: ${description}` : '.'}`,
          'Property Manager',
        )
        toast.success(`Uploaded successfully — ${unit.tenant_name} has received the document`)
      } else {
        toast.success('Uploaded successfully')
      }
      setSelectedFile(null)
      setDescription('')
      setSelectedUnit('')
      if (fileInputRef.current) fileInputRef.current.value = ''
      await load()
    } catch (err) {
      console.error('Upload failed:', err)
      toast.error('Failed to upload document')
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (doc: Document) => {
    if (!confirm(`Delete "${doc.file_name}"?`)) return
    try {
      await deleteDocument(doc.id, doc.file_url)
      toast.success('Document deleted')
      setDocuments(prev => prev.filter(d => d.id !== doc.id))
    } catch (err) {
      console.error('Delete failed:', err)
      toast.error('Failed to delete document')
    }
  }

  const filtered = documents.filter((d) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      d.file_name.toLowerCase().includes(q) ||
      (d.description ?? '').toLowerCase().includes(q) ||
      (d.tenant_name ?? '').toLowerCase().includes(q) ||
      (d.unit_name ?? '').toLowerCase().includes(q)
    )
  })

  const cardClass = `rounded-xl border ${isDark ? 'bg-navy-card border-[#1E293B]' : 'bg-white border-gray-200 shadow-sm'}`
  const selectedUnitLabel = units.find(u => u.id === selectedUnit)?.name || 'Select unit (optional)'

  return (
    <div className="flex flex-1 min-h-0 gap-5">
      {/* Left — Upload Form */}
      <div className={`${cardClass} p-5 w-[380px] flex-shrink-0 flex flex-col`}>
        <h3 className={`text-base font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>Upload Contract / Document</h3>

        <div className="flex flex-col gap-4 flex-1">
          {/* File input */}
          <div>
            <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              PDF File *
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              className={`w-full text-sm rounded-lg border p-2 ${
                isDark
                  ? 'bg-[#111D32] border-[#1E293B] text-white file:bg-primary/20 file:text-primary file:border-0 file:rounded file:px-3 file:py-1 file:mr-3 file:text-sm file:font-medium'
                  : 'bg-white border-gray-200 text-gray-900 file:bg-primary/10 file:text-primary file:border-0 file:rounded file:px-3 file:py-1 file:mr-3 file:text-sm file:font-medium'
              }`}
            />
          </div>

          {/* Unit dropdown */}
          <div>
            <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              Assign to Unit
            </label>
            <div ref={unitDropdownRef} className="relative">
              <button
                type="button"
                onClick={() => setUnitDropdownOpen(!unitDropdownOpen)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-sm transition-colors ${
                  isDark
                    ? 'bg-[#111D32] border-[#1E293B] text-white'
                    : 'bg-white border-gray-200 text-gray-900'
                }`}
              >
                <span className={!selectedUnit ? (isDark ? 'text-gray-500' : 'text-gray-400') : ''}>
                  {selectedUnitLabel}
                </span>
                <ChevronDown className={`w-4 h-4 transition-transform ${unitDropdownOpen ? 'rotate-180' : ''} ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
              </button>
              <div
                className={`absolute left-0 right-0 mt-1 rounded-lg border shadow-lg z-20 max-h-48 overflow-y-auto transition-all duration-200 origin-top ${
                  unitDropdownOpen
                    ? 'opacity-100 scale-y-100 pointer-events-auto'
                    : 'opacity-0 scale-y-75 pointer-events-none'
                } ${isDark ? 'bg-[#111D32] border-[#1E293B]' : 'bg-white border-gray-200'}`}
              >
                <button
                  onClick={() => { setSelectedUnit(''); setUnitDropdownOpen(false) }}
                  className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                    !selectedUnit
                      ? 'bg-primary/10 text-primary font-medium'
                      : isDark ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  None (General)
                </button>
                {units.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => { setSelectedUnit(u.id); setUnitDropdownOpen(false) }}
                    className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                      selectedUnit === u.id
                        ? 'bg-primary/10 text-primary font-medium'
                        : isDark ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    {u.name} {u.tenant_name ? `— ${u.tenant_name}` : ''}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              Description
            </label>
            <input
              type="text"
              placeholder="e.g. Lease contract for Unit 10"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={`w-full px-3 py-2.5 rounded-lg border text-sm transition-colors ${
                isDark
                  ? 'bg-[#111D32] border-[#1E293B] text-white placeholder-gray-500 focus:border-primary'
                  : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-primary'
              } focus:outline-none`}
            />
          </div>

          <button
            onClick={handleUpload}
            disabled={uploading || !selectedFile}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            <Upload className="w-4 h-4" />
            {uploading ? 'Uploading…' : 'Upload'}
          </button>
        </div>
      </div>

      {/* Right — Document History */}
      <div className="flex flex-col flex-1 min-h-0 gap-4">
        {/* Search */}
        <div className="relative">
          <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
          <input
            type="text"
            placeholder="Search documents…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`w-full pl-10 pr-4 py-2.5 rounded-lg border text-sm transition-colors ${
              isDark
                ? 'bg-[#111D32] border-[#1E293B] text-white placeholder-gray-500 focus:border-primary'
                : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-primary'
            } focus:outline-none`}
          />
        </div>

        {/* Loading */}
        {loading && (
          <div className={`text-center py-8 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Loading documents…</div>
        )}

        {/* Table */}
        {!loading && (
          <div className={`${cardClass} overflow-x-auto flex-1 min-h-0 overflow-y-auto`}>
            <table className="w-full text-sm">
              <thead>
                <tr className={`border-b ${isDark ? 'border-[#1E293B]' : 'border-gray-200'}`}>
                  {['File Name', 'Unit', 'Tenant', 'Description', 'Date', ''].map((h) => (
                    <th key={h} className={`text-left py-3 px-4 font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((doc) => (
                  <tr key={doc.id} className={`border-b last:border-0 ${isDark ? 'border-[#1E293B]' : 'border-gray-100'}`}>
                    <td className={`py-3 px-4 font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-red-400 flex-shrink-0" />
                        <span className="truncate max-w-[180px]">{doc.file_name}</span>
                      </div>
                    </td>
                    <td className={`py-3 px-4 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{doc.unit_name || '—'}</td>
                    <td className={`py-3 px-4 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{doc.tenant_name || '—'}</td>
                    <td className={`py-3 px-4 max-w-[150px] truncate ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{doc.description || '—'}</td>
                    <td className={`py-3 px-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      {new Date(doc.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1">
                        <a
                          href={doc.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Download"
                          className={`p-2 rounded-lg transition-colors ${isDark ? 'text-gray-400 hover:text-primary hover:bg-primary/10' : 'text-gray-500 hover:text-primary hover:bg-primary/10'}`}
                        >
                          <Download className="w-4 h-4" />
                        </a>
                        <button
                          onClick={() => handleDelete(doc)}
                          title="Delete"
                          className={`p-2 rounded-lg transition-colors ${isDark ? 'text-gray-400 hover:text-red-400 hover:bg-red-400/10' : 'text-gray-500 hover:text-red-500 hover:bg-red-50'}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
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
    </div>
  )
}
