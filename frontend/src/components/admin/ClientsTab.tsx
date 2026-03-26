import { Search, Eye, ArrowLeft, Users, MapPin, ChevronDown } from 'lucide-react'
import { useState, useEffect, useMemo, useRef } from 'react'
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts'
import { useTheme } from '../../context/ThemeContext'
import { getClients, getClientDetailStats, type Client } from '../../lib/api'
import { CardsSkeleton, TableSkeleton } from '@/components/ui/skeleton'
import TablePagination from '@/components/ui/table-pagination'

export default function ClientsTab() {
  const { isDark } = useTheme()
  const [search, setSearch] = useState('')
  const [locationFilter, setLocationFilter] = useState<string>('all')
  const [locationOpen, setLocationOpen] = useState(false)
  const locationRef = useRef<HTMLDivElement>(null)
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const pageSize = 10

  // Detail view state
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailStats, setDetailStats] = useState<{
    tenants: { active: number; inactive: number; total: number }
    managers: { active: number; inactive: number; total: number }
  } | null>(null)

  useEffect(() => {
    loadClients()
  }, [])

  // Helper to extract city from address (format: street, barangay, city, province zip)
  function extractCity(address: string | null): string | null {
    if (!address) return null
    const parts = address.split(',')
    if (parts.length >= 3) return parts[2].trim()
    return address.trim()
  }

  // Extract unique cities for filter
  const locations = useMemo(() => {
    const cities = clients
      .map(c => extractCity(c.apartment_address))
      .filter((city): city is string => !!city && city.trim() !== '')
    return [...new Set(cities)].sort()
  }, [clients])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (locationRef.current && !locationRef.current.contains(e.target as Node)) {
        setLocationOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function loadClients() {
    try {
      setLoading(true)
      const data = await getClients()
      setClients(data)
    } catch (err) {
      console.error('Failed to load clients:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleView(client: Client) {
    setSelectedClient(client)
    setDetailLoading(true)
    try {
      const stats = await getClientDetailStats(client.id)
      setDetailStats(stats)
    } catch (err) {
      console.error('Failed to load client details:', err)
    } finally {
      setDetailLoading(false)
    }
  }

  function handleBack() {
    setSelectedClient(null)
    setDetailStats(null)
  }

  const filtered = clients.filter((c) => {
    // Location filter
    if (locationFilter !== 'all') {
      const city = extractCity(c.apartment_address)
      if (!city || city !== locationFilter) return false
    }
    // Search filter
    if (search) {
      const q = search.toLowerCase()
      return (
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q)
      )
    }
    return true
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize)

  useEffect(() => {
    setPage(1)
  }, [search, locationFilter, clients.length])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const cardClass = `rounded-xl border ${
    isDark
      ? 'bg-navy-card border-[#1E293B]'
      : 'bg-white border-gray-200 shadow-sm'
  }`

  const COMBINED_COLORS = ['#10B981', '#06B6D4']

  // Detail View
  if (selectedClient) {
    const combinedData = detailStats
      ? [
          { name: 'Tenants', value: detailStats.tenants.total },
          { name: 'Apartment Managers', value: detailStats.managers.total },
        ]
      : []

    return (
      <div className="flex flex-col flex-1 min-h-0 gap-6 animate-fade-up">
        <div className="flex items-center gap-4">
          <button
            onClick={handleBack}
            className={`p-2 rounded-lg transition-colors ${
              isDark ? 'text-gray-400 hover:text-white hover:bg-white/10' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }`}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {selectedClient.name}
            </h2>
            <p className={`text-base mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              Apartment Owner overview — Tenants &amp; Managers
            </p>
          </div>
        </div>

        {detailLoading && (
          <CardsSkeleton count={2} />
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-0">
          {/* Owner Details */}
          <div className={`${cardClass} p-6 animate-fade-up`}>
            <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Owner Information
            </h3>

            {/* Personal Information */}
            <p className={`text-xs font-semibold uppercase tracking-wider mb-3 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Personal</p>
            <div className="grid grid-cols-2 gap-4 mb-5">
              {[
                { label: 'Email', value: selectedClient.email },
                { label: 'Contact Number', value: selectedClient.phone },
                { label: 'Sex', value: selectedClient.sex },
                { label: 'Age', value: selectedClient.age },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className={`text-xs font-medium mb-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{label}</p>
                  <p className={`text-sm ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{value || '\u2014'}</p>
                </div>
              ))}
            </div>

            <div className={`border-t mb-5 ${isDark ? 'border-[#1E293B]' : 'border-gray-200'}`} />

            {/* Property Details */}
            <p className={`text-xs font-semibold uppercase tracking-wider mb-3 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Property</p>
            <div className="grid grid-cols-2 gap-4 mb-5">
              {[
                { label: 'Classification', value: selectedClient.apartment_classification },
                { label: 'Number of Units', value: selectedClient.number_of_units },
                { label: 'Number of Floors', value: selectedClient.number_of_floors },
                { label: 'Other Details', value: selectedClient.other_property_details },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className={`text-xs font-medium mb-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{label}</p>
                  <p className={`text-sm ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{value || '\u2014'}</p>
                </div>
              ))}
            </div>

            <div className={`border-t mb-5 ${isDark ? 'border-[#1E293B]' : 'border-gray-200'}`} />

            {/* Address */}
            <p className={`text-xs font-semibold uppercase tracking-wider mb-3 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Address</p>
            <div className="grid grid-cols-2 gap-4 mb-5">
              {[
                { label: 'Street/Building', value: selectedClient.street_building },
                { label: 'Barangay', value: selectedClient.barangay },
                { label: 'City/Municipality', value: selectedClient.city_municipality },
                { label: 'Province', value: selectedClient.province },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className={`text-xs font-medium mb-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{label}</p>
                  <p className={`text-sm ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{value || '\u2014'}</p>
                </div>
              ))}
            </div>

            <div className={`border-t mb-5 ${isDark ? 'border-[#1E293B]' : 'border-gray-200'}`} />

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className={`text-xs font-medium mb-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Date Joined</p>
                <p className={`text-sm ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{selectedClient.joined_date ? new Date(selectedClient.joined_date).toLocaleDateString() : '\u2014'}</p>
              </div>
              <div>
                <p className={`text-xs font-medium mb-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Status</p>
                <span className={`inline-block px-2.5 py-0.5 text-xs font-medium rounded-full ${
                  selectedClient.status === 'active'
                    ? 'bg-emerald-500/15 text-emerald-400'
                    : 'bg-gray-500/15 text-gray-400'
                }`}>
                  {selectedClient.status}
                </span>
              </div>
            </div>
          </div>

          {!detailLoading && detailStats && (
            <div className={`${cardClass} p-6 flex flex-col min-h-[400px] animate-fade-up`}>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center">
                  <Users className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    Tenants &amp; Managers
                  </h3>
                  <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    Tenants: {detailStats.tenants.total} &middot; Managers: {detailStats.managers.total}
                  </p>
                </div>
              </div>

              {combinedData.length === 0 ? (
                <div className={`flex-1 flex items-center justify-center ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                  <div className="text-center">
                    <Users className="w-10 h-10 mx-auto mb-2 opacity-40" />
                    <p>No tenants or managers assigned</p>
                  </div>
                </div>
              ) : (
                <div className="flex-1 min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={combinedData}
                        cx="50%"
                        cy="50%"
                        innerRadius={80}
                        outerRadius={130}
                        paddingAngle={4}
                        dataKey="value"
                        label={({ name, value }) => `${name}: ${value}`}
                      >
                        {combinedData.map((_, idx) => (
                          <Cell key={idx} fill={COMBINED_COLORS[idx % COMBINED_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: isDark ? '#111D32' : '#fff',
                          border: isDark ? '1px solid #1E293B' : '1px solid #e5e7eb',
                          borderRadius: '8px',
                          color: isDark ? '#fff' : '#111',
                        }}
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  // Client List View
  return (
    <div className="flex flex-col flex-1 min-h-0 gap-6 animate-fade-up">
      <div>
        <h2 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
          Apartment Owners
        </h2>
        <p className={`text-base mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          Select an apartment owner to view their tenant and manager information.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search
            className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${
              isDark ? 'text-gray-500' : 'text-gray-400'
            }`}
          />
          <input
            type="text"
            placeholder="Search apartment owners..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`w-full pl-10 pr-4 py-3 rounded-lg text-base border focus:outline-none focus:ring-2 focus:ring-primary/50 ${
              isDark
                ? 'bg-[#0A1628] border-[#1E293B] text-white placeholder-gray-500'
                : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'
            }`}
          />
        </div>

        {/* Location filter - custom dropdown */}
        <div className="relative" ref={locationRef}>
          <button
            onClick={() => setLocationOpen(!locationOpen)}
            className={`flex items-center gap-2 pl-9 pr-4 py-3 rounded-lg text-base border cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50 ${
              isDark
                ? 'bg-[#0A1628] border-[#1E293B] text-white hover:border-primary/50'
                : 'bg-white border-gray-200 text-gray-900 hover:border-primary/50'
            }`}
          >
            <MapPin
              className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${
                isDark ? 'text-gray-500' : 'text-gray-400'
              }`}
            />
            <span className={locationFilter === 'all' ? (isDark ? 'text-gray-400' : 'text-gray-500') : ''}>
              {locationFilter === 'all' ? 'All Locations' : locationFilter}
            </span>
            <ChevronDown className={`w-4 h-4 ml-2 transition-transform duration-200 ${locationOpen ? 'rotate-180' : ''} ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
          </button>

          {/* Dropdown menu */}
          <div
            className={`absolute top-full left-0 mt-1 w-full min-w-[180px] rounded-lg border shadow-lg z-20 overflow-hidden transition-all duration-300 ease-out origin-top ${
              locationOpen
                ? 'opacity-100 scale-y-100 translate-y-0'
                : 'opacity-0 scale-y-95 -translate-y-1 pointer-events-none'
            } ${
              isDark
                ? 'bg-[#111D32] border-[#1E293B]'
                : 'bg-white border-gray-200'
            }`}
          >
            <div className="py-1 max-h-60 overflow-y-auto">
              <button
                onClick={() => { setLocationFilter('all'); setLocationOpen(false) }}
                className={`w-full text-left px-4 py-2.5 text-sm transition-colors duration-200 ${
                  locationFilter === 'all'
                    ? 'bg-primary/10 text-primary font-medium'
                    : isDark
                    ? 'text-gray-300 hover:bg-gray-700'
                    : 'text-gray-700 hover:bg-gray-200'
                }`}
              >
                All Locations
              </button>
              {locations.map((loc) => (
                <button
                  key={loc}
                  onClick={() => { setLocationFilter(loc); setLocationOpen(false) }}
                  className={`w-full text-left px-4 py-2.5 text-sm transition-colors duration-200 ${
                    locationFilter === loc
                      ? 'bg-primary/10 text-primary font-medium'
                      : isDark
                      ? 'text-gray-300 hover:bg-gray-700'
                      : 'text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {loc}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className={`${cardClass} flex-1 min-h-0 flex flex-col overflow-hidden`}>
        <div className="overflow-auto flex-1">
          <table className="w-full text-base table-fixed">
            <colgroup>
              <col className="w-1/6" />
              <col className="w-1/6" />
              <col className="w-1/6" />
              <col className="w-1/6" />
              <col className="w-1/6" />
              <col className="w-1/6" />
            </colgroup>
            <thead>
              <tr className={`border-b ${isDark ? 'border-[#1E293B]' : 'border-gray-200'}`}>
                {['Name', 'Email', 'Contact Number', 'Status', 'Date Joined', 'View'].map(
                  (h) => (
                    <th
                      key={h}
                      className={`text-left py-3.5 px-4 font-medium sticky top-0 z-10 whitespace-nowrap ${
                        isDark ? 'text-gray-400 bg-[#111D32]' : 'text-gray-500 bg-white'
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
              {!loading && paginated.map((client) => (
                <tr
                  key={client.id}
                  className={`border-b last:border-0 transition-colors ${
                    isDark
                      ? 'border-[#1E293B] hover:bg-white/[0.02]'
                      : 'border-gray-100 hover:bg-gray-50'
                  }`}
                >
                  <td className={`py-3.5 px-4 font-medium whitespace-nowrap ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {client.name}
                  </td>
                  <td className={`py-3.5 px-4 truncate ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                    {client.email}
                  </td>
                  <td className={`py-3.5 px-4 whitespace-nowrap ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                    {client.phone || '\u2014'}
                  </td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`inline-block px-2.5 py-0.5 text-xs font-medium rounded-full ${
                        client.status === 'active'
                          ? 'bg-emerald-500/15 text-emerald-400'
                          : 'bg-gray-500/15 text-gray-400'
                      }`}
                    >
                      {client.status}
                    </span>
                  </td>
                  <td className={`py-3.5 px-4 whitespace-nowrap ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    {client.joined_date ? new Date(client.joined_date).toLocaleDateString() : '\u2014'}
                  </td>
                  <td className="py-3.5 px-4">
                    <button
                      onClick={() => handleView(client)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/15 text-primary hover:bg-primary/25 rounded-lg text-sm font-medium transition-colors"
                      title="View apartment owner details"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      View
                    </button>
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
                    No apartment owners found
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
