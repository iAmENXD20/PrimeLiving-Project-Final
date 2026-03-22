// Philippine Standard Geographic Code (PSGC) API helper
// Source: https://psgc.gitlab.io/api/

const BASE_URL = 'https://psgc.gitlab.io/api'

interface PsgcLocation {
  code: string
  name: string
}

// Cache to avoid re-fetching
const cityCodeCache = new Map<string, string>()
const barangayCache = new Map<string, string[]>()

/**
 * Search for a city/municipality code by name.
 * Uses the PSGC static API to find the closest match.
 */
export async function getCityCode(cityName: string, provinceName: string): Promise<string | null> {
  const cacheKey = `${provinceName}|${cityName}`
  if (cityCodeCache.has(cacheKey)) return cityCodeCache.get(cacheKey)!

  try {
    const res = await fetch(`${BASE_URL}/cities-municipalities.json`)
    if (!res.ok) return null

    const cities: PsgcLocation[] = await res.json()
    const normalizedCity = cityName.toLowerCase().trim()

    // Try exact match first
    let match = cities.find(
      (c) => c.name.toLowerCase() === normalizedCity ||
        c.name.toLowerCase() === `city of ${normalizedCity}` ||
        c.name.toLowerCase().replace('city of ', '') === normalizedCity
    )

    // Try partial match
    if (!match) {
      match = cities.find(
        (c) => c.name.toLowerCase().includes(normalizedCity) ||
          normalizedCity.includes(c.name.toLowerCase().replace('city of ', ''))
      )
    }

    if (match) {
      cityCodeCache.set(cacheKey, match.code)
      return match.code
    }

    return null
  } catch {
    return null
  }
}

/**
 * Fetch barangays for a given city/municipality code.
 */
export async function getBarangays(cityName: string, provinceName: string): Promise<string[]> {
  const cacheKey = `${provinceName}|${cityName}`
  if (barangayCache.has(cacheKey)) return barangayCache.get(cacheKey)!

  try {
    const code = await getCityCode(cityName, provinceName)
    if (!code) return []

    const res = await fetch(`${BASE_URL}/cities-municipalities/${code}/barangays.json`)
    if (!res.ok) return []

    const barangays: PsgcLocation[] = await res.json()
    const names = barangays.map((b) => b.name).sort()

    barangayCache.set(cacheKey, names)
    return names
  } catch {
    return []
  }
}
