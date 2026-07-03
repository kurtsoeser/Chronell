import { isAllowedTeamsRecordingEmbedSrc } from './note-teams-recording-embed'

function isSharePointHost(hostname: string): boolean {
  return hostname.toLowerCase().replace(/^www\./, '').endsWith('.sharepoint.com')
}

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

/** SharePoint `stream.aspx` / `embed.aspx` für iframe bereinigen (Tracking-Parameter entfernen). */
export function normalizeSharePointStreamPageUrl(url: URL): string {
  const clean = new URL(`${url.origin}${url.pathname}`)
  const id = url.searchParams.get('id')?.trim()
  if (id) clean.searchParams.set('id', id)

  const uniqueId = url.searchParams.get('UniqueId') ?? url.searchParams.get('uniqueID')
  if (uniqueId?.trim()) clean.searchParams.set('UniqueId', uniqueId.trim())

  const dark = url.searchParams.get('isDarkMode')
  if (dark === 'true' || dark === 'false') clean.searchParams.set('isDarkMode', dark)

  return clean.toString()
}

/**
 * Direkte SharePoint-Stream-Seiten (`stream.aspx`, `embed.aspx`) als iframe-src.
 * Kein Graph nötig — voller Stream-Player inkl. Untertitel & Kommentare.
 */
export function parseSharePointStreamPageEmbedSrc(input: string): string | null {
  const url = parseUrl(input)
  if (!url || !isSharePointHost(url.hostname)) return null

  const path = url.pathname.toLowerCase()
  if (path.includes('stream.aspx')) {
    if (!url.searchParams.get('id')?.trim()) return null
  } else if (path.includes('embed.aspx')) {
    const uniqueId = url.searchParams.get('UniqueId') ?? url.searchParams.get('uniqueID')
    if (!uniqueId?.trim()) return null
  } else {
    return null
  }

  const normalized = normalizeSharePointStreamPageUrl(url)
  return isAllowedM365StreamEmbedSrc(normalized) ? normalized : null
}

/** SharePoint-Stream-Player (`embed.aspx`) aus Site-URL und Listeneintrag-ID. */
export function buildSharePointStreamEmbedUrl(
  siteUrl: string,
  listItemUniqueId: string
): string | null {
  const site = siteUrl.trim().replace(/\/$/, '')
  const guid = listItemUniqueId.trim().replace(/^\{|\}$/gu, '')
  if (!site || !guid) return null

  try {
    const url = new URL(`${site}/_layouts/15/embed.aspx`)
    url.searchParams.set('UniqueId', guid)
    return url.toString()
  } catch {
    return null
  }
}

/** Site-Root aus einer SharePoint-`webUrl` ableiten (Sites-Bibliothek oder OneDrive personal). */
export function deriveSharePointSiteUrl(webUrl: string): string | null {
  try {
    const url = new URL(webUrl.trim())
    if (!url.hostname.toLowerCase().endsWith('.sharepoint.com')) return null

    const parts = url.pathname.split('/').filter(Boolean)
    if (parts[0] === 'sites' && parts[1]) {
      return `${url.origin}/sites/${parts[1]}`
    }
    if (parts[0] === 'personal' && parts[1]) {
      return `${url.origin}/personal/${parts[1]}`
    }
    return null
  } catch {
    return null
  }
}

export function buildM365StreamEmbedSrc(input: {
  webUrl?: string | null
  siteUrl?: string | null
  listItemUniqueId?: string | null
}): string | null {
  const listItemUniqueId = input.listItemUniqueId?.trim()
  if (!listItemUniqueId) return null

  const siteUrl = input.siteUrl?.trim() || deriveSharePointSiteUrl(input.webUrl ?? '')
  if (!siteUrl) return null

  const embedSrc = buildSharePointStreamEmbedUrl(siteUrl, listItemUniqueId)
  if (!embedSrc || !isAllowedTeamsRecordingEmbedSrc(embedSrc)) return null
  return embedSrc
}

export function isAllowedM365StreamEmbedSrc(src: string): boolean {
  return isAllowedTeamsRecordingEmbedSrc(src)
}
