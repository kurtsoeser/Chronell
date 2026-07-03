export const NOTE_OPENSTREETMAP_EMBED_ATTR = 'data-note-openstreetmap-src' as const
export const NOTE_OPENSTREETMAP_EMBED_CLASS = 'note-openstreetmap-embed' as const

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

function isOpenStreetMapHost(hostname: string): boolean {
  const host = hostname.replace(/^www\./, '')
  return host === 'openstreetmap.org'
}

function buildOsmEmbedFromCenter(lat: number, lon: number, zoom: number): string {
  const span = 360 / Math.pow(2, zoom + 1)
  const latSpan = span * 0.75
  const bbox = [lon - span, lat - latSpan, lon + span, lat + latSpan]
  const url = new URL('https://www.openstreetmap.org/export/embed.html')
  url.searchParams.set('bbox', bbox.map((value) => String(value)).join(','))
  url.searchParams.set('layer', 'mapnik')
  url.searchParams.set('marker', `${lat},${lon}`)
  return url.toString()
}

function parseMapHash(hash: string): { lat: number; lon: number; zoom: number } | null {
  const match = /^#?map=(\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)/.exec(hash)
  if (!match?.[1] || !match[2] || !match[3]) return null
  const zoom = Number(match[1])
  const lat = Number(match[2])
  const lon = Number(match[3])
  if (!Number.isFinite(zoom) || !Number.isFinite(lat) || !Number.isFinite(lon)) return null
  return { lat, lon, zoom: Math.min(19, Math.max(1, Math.round(zoom))) }
}

/** Kanonische OSM-Embed-URL aus Karten- oder Embed-Link ableiten. */
export function parseOpenStreetMapEmbedSrc(input: string): string | null {
  const url = parseUrl(input)
  if (!url || !isOpenStreetMapHost(url.hostname)) return null

  if (url.pathname === '/export/embed.html') {
    return url.toString()
  }

  const fromHash = parseMapHash(url.hash)
  if (fromHash) {
    return buildOsmEmbedFromCenter(fromHash.lat, fromHash.lon, fromHash.zoom)
  }

  const mlat = url.searchParams.get('mlat')
  const mlon = url.searchParams.get('mlon')
  if (mlat && mlon) {
    const lat = Number(mlat)
    const lon = Number(mlon)
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      const zoom = parseMapHash(url.hash)?.zoom ?? 15
      return buildOsmEmbedFromCenter(lat, lon, zoom)
    }
  }

  return null
}

export function buildOpenStreetMapEmbedUrl(embedSrc: string): string {
  return embedSrc
}

export function isAllowedOpenStreetMapEmbedSrc(src: string): boolean {
  const url = parseUrl(src)
  if (!url || !isOpenStreetMapHost(url.hostname)) return false
  return url.pathname === '/export/embed.html'
}

export function isOpenStreetMapUrl(input: string): boolean {
  return parseOpenStreetMapEmbedSrc(input) != null
}
