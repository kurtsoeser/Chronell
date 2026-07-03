const GOOGLE_MAPS_HOSTS = new Set(['google.com', 'www.google.com', 'maps.google.com'])
const GOOGLE_MAPS_SHORT_HOSTS = new Set(['maps.app.goo.gl', 'goo.gl'])

export const NOTE_GOOGLE_MAPS_EMBED_ATTR = 'data-note-google-maps-src' as const
export const NOTE_GOOGLE_MAPS_EMBED_CLASS = 'note-google-maps-embed' as const

function parseUrl(input: string): URL | null {
  const raw = input.trim()
  if (!raw) return null
  try {
    return new URL(raw)
  } catch {
    try {
      return new URL(`https://${raw}`)
    } catch {
      return null
    }
  }
}

function isGoogleMapsHost(url: URL): boolean {
  const host = url.hostname.replace(/^www\./, '')
  return GOOGLE_MAPS_HOSTS.has(host) || host === 'maps.google.com'
}

function buildCoordsEmbed(lat: string, lng: string, zoom?: string): string {
  const z = zoom ? Math.min(21, Math.max(1, Math.round(Number(zoom)))) : 14
  return `https://maps.google.com/maps?q=${lat},${lng}&hl=de&z=${z}&output=embed`
}

function extractLatLngFromPbPayload(input: string): { lat: string; lng: string } | null {
  const match = /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/.exec(input)
  if (!match?.[1] || !match?.[2]) return null
  return { lat: match[1], lng: match[2] }
}

/** Google-Maps-Kurzlink (maps.app.goo.gl / goo.gl/maps) — benötigt Redirect-Auflösung im Main. */
export function isGoogleMapsShortUrl(input: string): boolean {
  const url = parseUrl(input)
  if (!url) return false
  const host = url.hostname.replace(/^www\./, '')
  if (GOOGLE_MAPS_SHORT_HOSTS.has(host)) {
    return host === 'maps.app.goo.gl' || url.pathname.startsWith('/maps')
  }
  return false
}

/** Google-Maps-Embed-Src aus Karten- oder Embed-URL ableiten. */
export function parseGoogleMapsEmbedSrc(input: string): string | null {
  const url = parseUrl(input)
  if (!url || !isGoogleMapsHost(url)) return null

  if (url.pathname.startsWith('/maps/embed')) {
    return url.toString()
  }

  const pbCoords = extractLatLngFromPbPayload(`${url.pathname}${url.search}${url.hash}`)
  if (pbCoords) {
    const zoomMatch = /@-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?(?:,(\d+(?:\.\d+)?)[zZ]?)?/.exec(
      `${url.pathname}${url.search}${url.hash}`
    )
    return buildCoordsEmbed(pbCoords.lat, pbCoords.lng, zoomMatch?.[1])
  }

  const coordMatch = /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)(?:,(\d+(?:\.\d+)?)[zZ]?)?/.exec(
    `${url.pathname}${url.search}`
  )
  if (coordMatch) {
    return buildCoordsEmbed(coordMatch[1] ?? '', coordMatch[2] ?? '', coordMatch[3])
  }

  const q = url.searchParams.get('q')?.trim()
  if (q) {
    return `https://maps.google.com/maps?q=${encodeURIComponent(q)}&hl=de&output=embed`
  }

  const placeMatch = /^\/maps\/place\/([^/@]+)/.exec(url.pathname)
  if (placeMatch?.[1]) {
    const place = decodeURIComponent(placeMatch[1].replace(/\+/g, ' '))
    return `https://maps.google.com/maps?q=${encodeURIComponent(place)}&hl=de&output=embed`
  }

  if (url.pathname.startsWith('/maps') || url.hostname === 'maps.google.com') {
    const params = new URLSearchParams(url.search)
    params.set('output', 'embed')
    return `https://maps.google.com/maps?${params.toString()}`
  }

  return null
}

export function buildGoogleMapsEmbedUrl(embedSrc: string): string {
  return embedSrc
}

export function isAllowedGoogleMapsEmbedSrc(src: string): boolean {
  const url = parseUrl(src)
  if (!url || !isGoogleMapsHost(url)) return false
  if (url.pathname.startsWith('/maps/embed')) return true
  return url.searchParams.get('output') === 'embed'
}

export function isGoogleMapsUrl(input: string): boolean {
  return parseGoogleMapsEmbedSrc(input) != null || isGoogleMapsShortUrl(input)
}
