export const NOTE_LOOM_EMBED_ATTR = 'data-note-loom-id' as const
export const NOTE_LOOM_EMBED_CLASS = 'note-loom-embed' as const

const LOOM_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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

function isLoomHost(hostname: string): boolean {
  const host = hostname.replace(/^www\./, '')
  return host === 'loom.com'
}

/** Loom-Video-ID (UUID) aus Teilen- oder Embed-URL extrahieren. */
export function parseLoomVideoId(input: string): string | null {
  const trimmed = input.trim()
  if (LOOM_ID_RE.test(trimmed)) return trimmed.toLowerCase()

  const url = parseUrl(trimmed)
  if (!url || !isLoomHost(url.hostname)) return null

  const shareMatch = /^\/share\/([^/?]+)/.exec(url.pathname)
  if (shareMatch?.[1] && LOOM_ID_RE.test(shareMatch[1])) {
    return shareMatch[1].toLowerCase()
  }

  const embedMatch = /^\/embed\/([^/?]+)/.exec(url.pathname)
  if (embedMatch?.[1] && LOOM_ID_RE.test(embedMatch[1])) {
    return embedMatch[1].toLowerCase()
  }

  return null
}

export function buildLoomEmbedUrl(videoId: string): string {
  return `https://www.loom.com/embed/${encodeURIComponent(videoId)}`
}

export function isAllowedLoomEmbedSrc(src: string): boolean {
  const videoId = parseLoomVideoId(src)
  if (!videoId) return false
  const url = parseUrl(src)
  if (!url || !isLoomHost(url.hostname)) return false
  return url.pathname === `/embed/${videoId}`
}

export function isLoomUrl(input: string): boolean {
  return parseLoomVideoId(input) != null
}
