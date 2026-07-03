export const NOTE_GEOGEBRA_EMBED_ATTR = 'data-note-geogebra-id' as const
export const NOTE_GEOGEBRA_EMBED_CLASS = 'note-geogebra-embed' as const

const GEOGEBRA_HOSTS = new Set(['geogebra.org', 'www.geogebra.org', 'tube.geogebra.org'])

/** Kurz-IDs (z. B. dwhhteev) oder numerische Legacy-IDs (z. B. 597519). */
const GEOGEBRA_MATERIAL_ID_RE = /^[A-Za-z0-9]+$/

function normalizeMaterialId(candidate: string): string | null {
  const id = candidate.trim()
  if (!id || !GEOGEBRA_MATERIAL_ID_RE.test(id)) return null
  return id
}

function isGeoGebraHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^www\./, '')
  return host === 'geogebra.org' || host === 'tube.geogebra.org'
}

function parseGeoGebraUrlObject(url: URL): string | null {
  if (!isGeoGebraHost(url.hostname)) return null

  const materialQuery = url.searchParams.get('material')?.trim()
  if (materialQuery) return normalizeMaterialId(materialQuery)

  const mMatch = /^\/m\/([^/?]+)/.exec(url.pathname)
  if (mMatch) return normalizeMaterialId(mMatch[1] ?? '')

  const showMatch = /^\/material\/show\/id\/([^/?]+)/.exec(url.pathname)
  if (showMatch) return normalizeMaterialId(showMatch[1] ?? '')

  const iframeMatch = /^\/material\/iframe\/id\/([^/?]+)/.exec(url.pathname)
  if (iframeMatch) return normalizeMaterialId(iframeMatch[1] ?? '')

  return null
}

/** GeoGebra-Material-ID aus Activity- oder Embed-URL extrahieren. */
export function parseGeoGebraMaterialId(input: string): string | null {
  const raw = input.trim()
  if (!raw) return null

  let url: URL
  try {
    url = new URL(raw)
  } catch {
    try {
      url = new URL(`https://${raw}`)
    } catch {
      return null
    }
  }
  return parseGeoGebraUrlObject(url)
}

/**
 * iframe-Embed-URL laut GeoGebra-Doku:
 * https://geogebra.github.io/docs/reference/en/Material_Embedding_(Iframe)/
 */
export function buildGeoGebraEmbedUrl(materialId: string): string {
  const id = encodeURIComponent(materialId)
  return [
    `https://www.geogebra.org/material/iframe/id/${id}`,
    'width/960',
    'height/560',
    'border/888888',
    'sfsb/true',
    'szb/true',
    'smb/true',
    'stb/true',
    'stbh/true',
    'rc/true',
    'sdz/true',
    'ai/false',
    'ld/false',
    'sri/false'
  ].join('/')
}

export function isAllowedGeoGebraEmbedSrc(src: string): boolean {
  const materialId = parseGeoGebraMaterialId(src)
  if (!materialId) return false
  let url: URL
  try {
    url = new URL(src.trim())
  } catch {
    return false
  }
  return /^\/material\/iframe\/id\/[^/?]+/.test(url.pathname)
}

export function isGeoGebraMaterialUrl(input: string): boolean {
  return parseGeoGebraMaterialId(input) != null
}
