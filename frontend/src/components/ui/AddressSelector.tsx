import { useState, useEffect, useRef } from 'react'
import { ChevronDown } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'

const PSGC_BASE = 'https://psgc.cloud/api'

/** Fix mojibake from PSGC API (UTF-8 bytes misread as Latin-1, e.g. "Ã±" → "ñ") */
function fixEncoding(str: string): string {
  try {
    const bytes = new Uint8Array([...str].map(c => c.charCodeAt(0)))
    return new TextDecoder('utf-8').decode(bytes)
  } catch {
    return str
  }
}

function fixPsgcItems(items: any[]): PSGCItem[] {
  return items.map(i => ({ ...i, name: fixEncoding(i.name) }))
}

interface PSGCItem {
  code: string
  name: string
}

export interface StructuredAddress {
  region: string
  regionCode: string
  province: string
  provinceCode: string
  cityMunicipality: string
  cityMunicipalityCode: string
  district: string
  districtCode: string
  area: string
  areaCode: string
  barangay: string
  barangayCode: string
  street: string
  full: string
}

// ── Manila legislative districts with sub-municipality PSGC codes ──
const MANILA_CODE = '1380600000'

interface ManilaAreaDef {
  name: string
  psgcCode: string | null
}

interface ManilaDistrictDef {
  code: string
  name: string
  areas: ManilaAreaDef[]
}

const MANILA_DISTRICTS: ManilaDistrictDef[] = [
  {
    code: 'manila-d1',
    name: 'First District',
    areas: [{ name: 'Tondo 1 (West Tondo)', psgcCode: '1380601000' }],
  },
  {
    code: 'manila-d2',
    name: 'Second District',
    areas: [{ name: 'Tondo 2 (Gagalangin)', psgcCode: '1380601000' }],
  },
  {
    code: 'manila-d3',
    name: 'Third District',
    areas: [
      { name: 'Binondo', psgcCode: '1380602000' },
      { name: 'Quiapo', psgcCode: '1380603000' },
      { name: 'San Nicolas', psgcCode: '1380604000' },
      { name: 'Santa Cruz', psgcCode: '1380605000' },
    ],
  },
  {
    code: 'manila-d4',
    name: 'Fourth District',
    areas: [{ name: 'Sampaloc', psgcCode: '1380606000' }],
  },
  {
    code: 'manila-d5',
    name: 'Fifth District',
    areas: [
      { name: 'Ermita', psgcCode: '1380608000' },
      { name: 'Intramuros', psgcCode: '1380609000' },
      { name: 'Malate', psgcCode: '1380610000' },
      { name: 'Paco', psgcCode: '1380611000' },
      { name: 'Port Area', psgcCode: '1380613000' },
      { name: 'San Andres', psgcCode: null },
    ],
  },
  {
    code: 'manila-d6',
    name: 'Sixth District',
    areas: [
      { name: 'Pandacan', psgcCode: '1380612000' },
      { name: 'San Miguel', psgcCode: '1380607000' },
      { name: 'Santa Ana', psgcCode: '1380614000' },
      { name: 'Santa Mesa', psgcCode: null },
    ],
  },
]

interface AddressSelectorProps {
  isDark: boolean
  onChange: (address: StructuredAddress | null) => void
}

export default function AddressSelector({ isDark, onChange }: AddressSelectorProps) {
  const [regions, setRegions] = useState<PSGCItem[]>([])
  const [provinces, setProvinces] = useState<PSGCItem[]>([])
  const [citiesMunicipalities, setCitiesMunicipalities] = useState<PSGCItem[]>([])
  const [districts, setDistricts] = useState<PSGCItem[]>([])
  const [areas, setAreas] = useState<PSGCItem[]>([])
  const [barangays, setBarangays] = useState<PSGCItem[]>([])

  const [selectedRegion, setSelectedRegion] = useState<PSGCItem | null>(null)
  const [selectedProvince, setSelectedProvince] = useState<PSGCItem | null>(null)
  const [selectedCity, setSelectedCity] = useState<PSGCItem | null>(null)
  const [selectedDistrict, setSelectedDistrict] = useState<PSGCItem | null>(null)
  const [selectedArea, setSelectedArea] = useState<PSGCItem | null>(null)
  const [selectedBarangay, setSelectedBarangay] = useState<PSGCItem | null>(null)
  const [street, setStreet] = useState('')

  const [openDropdown, setOpenDropdown] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  const [loadingRegions, setLoadingRegions] = useState(false)
  const [loadingProvinces, setLoadingProvinces] = useState(false)
  const [loadingCities, setLoadingCities] = useState(false)
  const [loadingBarangays, setLoadingBarangays] = useState(false)

  // Whether the selected city uses district → area → barangay flow (Manila)
  const [isManila, setIsManila] = useState(false)
  // Whether the selected city uses generic sub-municipality districts (non-Manila NCR cities with no direct barangays)
  const [hasGenericDistricts, setHasGenericDistricts] = useState(false)

  const dropdownRef = useRef<HTMLDivElement>(null)
  const [ncrFullList, setNcrFullList] = useState<any[]>([])

  // Track PSGC code for the selected area (for Manila areas that map to sub-municipalities)
  const [selectedAreaPsgcCode, setSelectedAreaPsgcCode] = useState<string | null>(null)

  const NCR_CODE = '1300000000'

  useEffect(() => {
    loadRegions()
  }, [])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenDropdown(null)
        setSearchTerm('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Build full address string and notify parent
  useEffect(() => {
    // Address is valid when:
    // - Standard: region + city + barangay
    // - Manila: region + city + district + area (barangay optional if area has no PSGC code)
    // - Generic districts: region + city + district + barangay
    const isComplete = selectedRegion && selectedCity && (
      selectedBarangay ||
      (isManila && selectedArea)
    )

    if (isComplete) {
      const parts = [
        street.trim(),
        selectedBarangay?.name,
        selectedArea?.name,
        selectedDistrict?.name,
        selectedCity!.name,
        selectedProvince?.name,
        selectedRegion!.name,
      ].filter(Boolean)
      const full = parts.join(', ')
      onChange({
        region: selectedRegion!.name,
        regionCode: selectedRegion!.code,
        province: selectedProvince?.name || '',
        provinceCode: selectedProvince?.code || '',
        cityMunicipality: selectedCity!.name,
        cityMunicipalityCode: selectedCity!.code,
        district: selectedDistrict?.name || '',
        districtCode: selectedDistrict?.code || '',
        area: selectedArea?.name || '',
        areaCode: selectedArea?.code || '',
        barangay: selectedBarangay?.name || '',
        barangayCode: selectedBarangay?.code || '',
        street: street.trim(),
        full,
      })
    } else {
      onChange(null)
    }
  }, [selectedRegion, selectedProvince, selectedCity, selectedDistrict, selectedArea, selectedBarangay, street, isManila])

  async function loadRegions() {
    setLoadingRegions(true)
    try {
      const res = await fetch(`${PSGC_BASE}/regions`)
      const data = await res.json()
      setRegions(Array.isArray(data) ? fixPsgcItems(data) : [])
    } catch (err) {
      console.error('Failed to load regions:', err)
    } finally {
      setLoadingRegions(false)
    }
  }

  async function handleRegionSelect(region: PSGCItem) {
    setSelectedRegion(region)
    setSelectedProvince(null)
    setSelectedCity(null)
    setSelectedDistrict(null)
    setSelectedArea(null)
    setSelectedBarangay(null)
    setProvinces([])
    setCitiesMunicipalities([])
    setDistricts([])
    setAreas([])
    setBarangays([])
    setIsManila(false)
    setHasGenericDistricts(false)
    setSelectedAreaPsgcCode(null)
    setNcrFullList([])
    setOpenDropdown(null)
    setSearchTerm('')

    if (region.code === NCR_CODE) {
      setLoadingCities(true)
      try {
        const res = await fetch(`${PSGC_BASE}/regions/${region.code}/cities-municipalities`)
        const data = await res.json()
        const items = Array.isArray(data) ? fixPsgcItems(data) : []
        setNcrFullList(items)
        setCitiesMunicipalities(items.filter((item: any) => item.type === 'City' || item.type === 'Mun'))
      } catch (err) {
        console.error('Failed to load cities:', err)
      } finally {
        setLoadingCities(false)
      }
    } else {
      setLoadingProvinces(true)
      try {
        const res = await fetch(`${PSGC_BASE}/regions/${region.code}/provinces`)
        const data = await res.json()
        setProvinces(Array.isArray(data) ? fixPsgcItems(data) : [])
      } catch (err) {
        console.error('Failed to load provinces:', err)
      } finally {
        setLoadingProvinces(false)
      }
    }
  }

  async function handleProvinceSelect(province: PSGCItem) {
    setSelectedProvince(province)
    setSelectedCity(null)
    setSelectedDistrict(null)
    setSelectedArea(null)
    setSelectedBarangay(null)
    setCitiesMunicipalities([])
    setDistricts([])
    setAreas([])
    setBarangays([])
    setIsManila(false)
    setHasGenericDistricts(false)
    setSelectedAreaPsgcCode(null)
    setOpenDropdown(null)
    setSearchTerm('')

    setLoadingCities(true)
    try {
      const res = await fetch(`${PSGC_BASE}/provinces/${province.code}/cities-municipalities`)
      const data = await res.json()
        setCitiesMunicipalities(Array.isArray(data) ? fixPsgcItems(data) : [])
    } catch (err) {
      console.error('Failed to load cities/municipalities:', err)
    } finally {
      setLoadingCities(false)
    }
  }

  async function handleCitySelect(city: PSGCItem) {
    setSelectedCity(city)
    setSelectedDistrict(null)
    setSelectedArea(null)
    setSelectedBarangay(null)
    setDistricts([])
    setAreas([])
    setBarangays([])
    setIsManila(false)
    setHasGenericDistricts(false)
    setSelectedAreaPsgcCode(null)
    setOpenDropdown(null)
    setSearchTerm('')

    if (city.code === MANILA_CODE) {
      // Manila: use hardcoded legislative districts
      setIsManila(true)
      setDistricts(MANILA_DISTRICTS.map(d => ({ code: d.code, name: d.name })))
      return
    }

    // Try loading barangays directly
    setLoadingBarangays(true)
    try {
      const res = await fetch(`${PSGC_BASE}/cities-municipalities/${city.code}/barangays`)
      const data = await res.json()
      const barangayList = Array.isArray(data) ? fixPsgcItems(data) : []

      if (barangayList.length > 0) {
        setBarangays(barangayList)
      } else if (ncrFullList.length > 0) {
        // Non-Manila NCR city with sub-municipalities as generic districts
        const cityPrefix = city.code.substring(0, 6)
        const subMuns = ncrFullList.filter(
          (item: any) => item.type === 'SubMun' && item.code.startsWith(cityPrefix) && item.code !== city.code
        )
        if (subMuns.length > 0) {
          setHasGenericDistricts(true)
          setDistricts(subMuns.map((s: any) => ({ code: s.code, name: s.name })))
        }
      }
    } catch (err) {
      console.error('Failed to load barangays:', err)
    } finally {
      setLoadingBarangays(false)
    }
  }

  function handleDistrictSelect(district: PSGCItem) {
    setSelectedDistrict(district)
    setSelectedArea(null)
    setSelectedBarangay(null)
    setAreas([])
    setBarangays([])
    setSelectedAreaPsgcCode(null)
    setOpenDropdown(null)
    setSearchTerm('')

    if (isManila) {
      // Manila: populate areas from the selected legislative district
      const manilaDistrict = MANILA_DISTRICTS.find(d => d.code === district.code)
      if (manilaDistrict) {
        setAreas(manilaDistrict.areas.map(a => ({
          code: a.psgcCode || `no-psgc-${a.name}`,
          name: a.name,
        })))
      }
    } else {
      // Generic sub-municipality: load barangays directly
      loadBarangaysForCode(district.code)
    }
  }

  async function handleAreaSelect(area: PSGCItem) {
    setSelectedArea(area)
    setSelectedBarangay(null)
    setBarangays([])
    setOpenDropdown(null)
    setSearchTerm('')

    // Find the Manila area definition to get the real PSGC code
    const manilaDistrict = MANILA_DISTRICTS.find(d => d.code === selectedDistrict?.code)
    const areaDef = manilaDistrict?.areas.find(a => a.name === area.name)
    const psgcCode = areaDef?.psgcCode || null
    setSelectedAreaPsgcCode(psgcCode)

    if (psgcCode) {
      await loadBarangaysForCode(psgcCode)
    }
    // If no PSGC code (San Andres, Santa Mesa), barangays stay empty — address is still valid
  }

  async function loadBarangaysForCode(code: string) {
    setLoadingBarangays(true)
    try {
      const res = await fetch(`${PSGC_BASE}/cities-municipalities/${code}/barangays`)
      const data = await res.json()
      setBarangays(Array.isArray(data) ? fixPsgcItems(data) : [])
    } catch (err) {
      console.error('Failed to load barangays:', err)
    } finally {
      setLoadingBarangays(false)
    }
  }

  function handleBarangaySelect(barangay: PSGCItem) {
    setSelectedBarangay(barangay)
    setOpenDropdown(null)
    setSearchTerm('')
  }

  const isNCR = selectedRegion?.code === NCR_CODE

  const selectClass = `w-full px-3 py-2.5 rounded-lg border text-sm cursor-pointer flex items-center justify-between ${
    isDark
      ? 'bg-[#0A1628] border-[#1E293B] text-white'
      : 'bg-gray-50 border-gray-200 text-gray-900'
  }`

  const disabledClass = `w-full px-3 py-2.5 rounded-lg border text-sm flex items-center justify-between opacity-50 cursor-not-allowed ${
    isDark
      ? 'bg-[#0A1628] border-[#1E293B] text-gray-500'
      : 'bg-gray-100 border-gray-200 text-gray-400'
  }`

  const dropdownClass = `absolute z-50 w-full mt-1 rounded-lg border shadow-lg max-h-72 overflow-y-auto ${
    isDark
      ? 'bg-[#111D32] border-[#1E293B]'
      : 'bg-white border-gray-200'
  }`
  const dropdownStyle = { scrollbarGutter: 'stable' as const }

  const optionClass = `px-3 py-2 text-sm cursor-pointer transition-colors ${
    isDark ? 'hover:bg-primary/20 text-gray-300' : 'hover:bg-primary/10 text-gray-700'
  }`

  function renderDropdown(
    label: string,
    items: PSGCItem[],
    selected: PSGCItem | null,
    onSelect: (item: PSGCItem) => void,
    dropdownKey: string,
    loading: boolean,
    disabled: boolean,
    placeholder: string
  ) {
    const filtered = searchTerm && openDropdown === dropdownKey
      ? items.filter(i => i.name.toLowerCase().includes(searchTerm.toLowerCase()))
      : items

    return (
      <div className="relative" ref={openDropdown === dropdownKey ? dropdownRef : undefined}>
        <Label className="mb-1.5 block">{label}</Label>
        {disabled ? (
          <div className={disabledClass}>
            <span>{placeholder}</span>
            <ChevronDown className="w-4 h-4 flex-shrink-0" />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              setOpenDropdown(openDropdown === dropdownKey ? null : dropdownKey)
              setSearchTerm('')
            }}
            className={selectClass}
          >
            <span className={!selected ? (isDark ? 'text-gray-500' : 'text-gray-400') : ''}>
              {loading ? 'Loading...' : selected ? selected.name : placeholder}
            </span>
            <ChevronDown className={`w-4 h-4 flex-shrink-0 transition-transform ${openDropdown === dropdownKey ? 'rotate-180' : ''}`} />
          </button>
        )}

        {openDropdown === dropdownKey && !disabled && (
          <div className={dropdownClass} style={dropdownStyle} ref={(el) => { if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }) }}>
            <div className="sticky top-0 p-2" style={{ backgroundColor: isDark ? '#111D32' : '#fff' }}>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Type to search..."
                className={`w-full px-2.5 py-1.5 rounded border text-sm focus:outline-none focus:ring-1 focus:ring-primary ${
                  isDark
                    ? 'bg-[#0A1628] border-[#1E293B] text-white placeholder-gray-500'
                    : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400'
                }`}
                autoFocus
              />
            </div>
            {filtered.length === 0 && (
              <div className={`px-3 py-2 text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                No results found
              </div>
            )}
            {filtered.map((item) => (
              <div
                key={item.code}
                onClick={() => onSelect(item)}
                className={optionClass}
              >
                {item.name}
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  const showDistricts = isManila || hasGenericDistricts

  return (
    <div className="space-y-3">
      {renderDropdown('Region', regions, selectedRegion, handleRegionSelect, 'region', loadingRegions, false, 'Select region')}

      {!isNCR && renderDropdown(
        'Province',
        provinces,
        selectedProvince,
        handleProvinceSelect,
        'province',
        loadingProvinces,
        !selectedRegion,
        !selectedRegion ? 'Select region first' : 'Select province'
      )}

      {renderDropdown(
        'City / Municipality',
        citiesMunicipalities,
        selectedCity,
        handleCitySelect,
        'city',
        loadingCities,
        isNCR ? !selectedRegion : !selectedProvince,
        isNCR
          ? (!selectedRegion ? 'Select region first' : 'Select city/municipality')
          : (!selectedProvince ? 'Select province first' : 'Select city/municipality')
      )}

      {showDistricts && renderDropdown(
        'District',
        districts,
        selectedDistrict,
        handleDistrictSelect,
        'district',
        false,
        !selectedCity,
        'Select district'
      )}

      {isManila && renderDropdown(
        'Area',
        areas,
        selectedArea,
        handleAreaSelect,
        'area',
        false,
        !selectedDistrict,
        !selectedDistrict ? 'Select district first' : 'Select area'
      )}

      {renderDropdown(
        'Barangay',
        barangays,
        selectedBarangay,
        handleBarangaySelect,
        'barangay',
        loadingBarangays,
        isManila
          ? (!selectedArea || barangays.length === 0)
          : (showDistricts ? !selectedDistrict : !selectedCity),
        isManila
          ? (!selectedArea ? 'Select area first' : barangays.length === 0 ? 'No barangays available' : 'Select barangay')
          : (showDistricts
            ? (!selectedDistrict ? 'Select district first' : 'Select barangay')
            : (!selectedCity ? 'Select city/municipality first' : 'Select barangay'))
      )}

      <div>
        <Label className="mb-1.5 block">Street Address</Label>
        <Input
          value={street}
          onChange={(e) => setStreet(e.target.value)}
          placeholder="e.g. 312 Quintos Sr. St"
          className={isDark ? 'bg-[#0A1628] border-[#1E293B] text-white placeholder:text-gray-500' : ''}
        />
      </div>
    </div>
  )
}
