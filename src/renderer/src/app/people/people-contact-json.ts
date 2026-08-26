export type PeoplePhoneEntry = { type: string; value: string }

/** Kanonische Telefontypen — passen zu Microsoft Graph und Google People API. */
export type PeoplePhoneKind = 'mobile' | 'home' | 'business' | 'other'

export const PEOPLE_PHONE_KINDS: PeoplePhoneKind[] = ['mobile', 'home', 'business', 'other']

export function normalizePhoneKind(type: string): PeoplePhoneKind {
  const t = type.trim().toLowerCase()
  if (t.includes('mobile') || t === 'cell' || t.includes('mobil')) return 'mobile'
  if (t.includes('home') || t.includes('privat')) return 'home'
  if (t.includes('business') || t.includes('work') || t.includes('geschäft') || t.includes('geschaeft')) {
    return 'business'
  }
  return 'other'
}

export function sanitizePhoneEntries(entries: PeoplePhoneEntry[]): PeoplePhoneEntry[] {
  return entries
    .map((entry) => ({
      type: normalizePhoneKind(entry.type),
      value: entry.value.trim()
    }))
    .filter((entry) => entry.value)
}

function phoneEntriesSortKey(entries: PeoplePhoneEntry[]): string {
  return sanitizePhoneEntries(entries)
    .map((entry) => `${entry.type}\u0000${entry.value}`)
    .sort()
    .join('\u0001')
}

export function phonesEntriesEqual(a: PeoplePhoneEntry[], b: PeoplePhoneEntry[]): boolean {
  return phoneEntriesSortKey(a) === phoneEntriesSortKey(b)
}

export type PeopleEmailEntry = { address: string; name?: string | null }

export type PeopleAddressEntry = {
  type: string
  street?: string | null
  city?: string | null
  state?: string | null
  countryOrRegion?: string | null
  postalCode?: string | null
}

export function parsePhonesJson(raw: string | null): PeoplePhoneEntry[] {
  if (!raw) return []
  try {
    const arr = JSON.parse(raw) as unknown
    if (!Array.isArray(arr)) return []
    return arr
      .map((x) => {
        if (x && typeof x === 'object' && 'value' in x) {
          const v = (x as { value?: string; type?: string }).value
          const t = (x as { type?: string }).type
          return {
            type: typeof t === 'string' && t.trim() ? t.trim() : 'other',
            value: typeof v === 'string' ? v.trim() : ''
          }
        }
        return { type: 'other', value: '' }
      })
      .filter((p) => p.value)
  } catch {
    return []
  }
}

export function parseEmailsJson(raw: string | null): PeopleEmailEntry[] {
  if (!raw) return []
  try {
    const arr = JSON.parse(raw) as unknown
    if (!Array.isArray(arr)) return []
    return arr
      .map((x) => {
        if (x && typeof x === 'object' && 'address' in x) {
          const address = (x as { address?: string }).address
          const name = (x as { name?: string | null }).name
          return {
            address: typeof address === 'string' ? address.trim() : '',
            name: typeof name === 'string' ? name.trim() || null : null
          }
        }
        return { address: '', name: null }
      })
      .filter((e) => e.address)
  } catch {
    return []
  }
}

export function parseAddressesJson(raw: string | null): PeopleAddressEntry[] {
  if (!raw) return []
  try {
    const arr = JSON.parse(raw) as unknown
    if (!Array.isArray(arr)) return []
    const out: PeopleAddressEntry[] = []
    for (const x of arr) {
      if (!x || typeof x !== 'object') continue
      const o = x as Record<string, unknown>
      const type = typeof o.type === 'string' && o.type.trim() ? o.type.trim() : 'other'
      const pick = (k: string): string | null | undefined => {
        const v = o[k]
        return typeof v === 'string' && v.trim() ? v.trim() : null
      }
      out.push({
        type,
        street: pick('street'),
        city: pick('city'),
        state: pick('state'),
        countryOrRegion: pick('countryOrRegion'),
        postalCode: pick('postalCode')
      })
    }
    return out
  } catch {
    return []
  }
}

/** Mehrzeilige Adresse für Kacheln und Detail. */
export function formatAddressLines(addr: PeopleAddressEntry): string[] {
  const lines: string[] = []
  if (addr.street) lines.push(addr.street)
  const cityParts = [addr.postalCode, addr.city].filter(Boolean)
  const cityLine = cityParts.join(' ').trim()
  if (cityLine) lines.push(cityLine)
  const regionParts = [addr.state, addr.countryOrRegion].filter(Boolean)
  const regionLine = regionParts.join(', ').trim()
  if (regionLine) lines.push(regionLine)
  return lines
}
