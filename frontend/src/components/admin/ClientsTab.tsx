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

export default function ClientsTab() {
  const { isDark } = useTheme()
  const [search, setSearch] = useState('')
  const [locationFilter, setLocationFilter] = useState<string>('all')
  const [locationOpen, setLocationOpen] = useState(false)
  const locationRef = useRef<HTMLDivElement>(null)
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)

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
          { name: 'Managers', value: detailStats.managers.total },
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
              Client overview — Tenants &amp; Managers
            </p>
          </div>
        </div>

        {detailLoading && (
          <div className={`text-center py-12 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            Loading client details...
          </div>
        )}

        {!detailLoading && detailStats && (
          <div className={`${cardClass} p-6 flex flex-col flex-1 min-h-0`}>
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
                      innerRadius={110}
                      outerRadius={170}
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
    )
  }

  // Client List View
  return (
    <div className="flex flex-col flex-1 min-h-0 gap-6 animate-fade-up">
      <div>
        <h2 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
          Clients
        </h2>
        <p className={`text-base mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          Select a client to view their tenant and manager information.
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
            placeholder="Search clients..."
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
          <table className="w-full text-base">
            <thead>
              <tr className={`border-b ${isDark ? 'border-[#1E293B]' : 'border-gray-200'}`}>
                {['Name', 'Email', 'Phone', 'Apt. Location', 'Status', 'Date Joined', ''].map(
                  (h) => (
                    <th
                      key={h}
                      className={`text-left py-3.5 px-4 font-medium sticky top-0 z-10 ${
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
                  <td colSpan={7} className={`py-8 text-center ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    Loading clients...
                  </td>
                </tr>
              )}
              {!loading && filtered.map((client) => (
                <tr
                  key={client.id}
                  className={`border-b last:border-0 transition-colors ${
                    isDark
                      ? 'border-[#1E293B] hover:bg-white/[0.02]'
                      : 'border-gray-100 hover:bg-gray-50'
                  }`}
                >
                  <td className={`py-3.5 px-4 font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {client.name}
                  </td>
                  <td className={`py-3.5 px-4 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                    {client.email}
                  </td>
                  <td className={`py-3.5 px-4 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                    {client.phone || '\u2014'}
                  </td>
                  <td className={`py-3.5 px-4 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                    {client.apartment_address || '\u2014'}
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
                  <td className={`py-3.5 px-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    {client.joined_date ? new Date(client.joined_date).toLocaleDateString() : '\u2014'}
                  </td>
                  <td className="py-3.5 px-4">
                    <button
                      onClick={() => handleView(client)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/15 text-primary hover:bg-primary/25 rounded-lg text-sm font-medium transition-colors"
                      title="View client details"
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
                    colSpan={7}
                    className={`py-8 text-center ${
                      isDark ? 'text-gray-500' : 'text-gray-400'
                    }`}
                  >
                    No clients found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
