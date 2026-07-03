export const NOTE_VIMEO_EMBED_ATTR = 'data-note-vimeo-id' as const
export const NOTE_VIMEO_EMBED_CLASS = 'note-vimeo-embed' as const

const VIMEO_VIDEO_ID_RE = /^\d{5,}$/

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

function normalizeVimeoHost(hostname: string): string {
  return hostname.replace(/^www\./, '')
}

/** Vimeo-Video-ID aus Teilen- oder Player-URL extrahieren. */
export function parseVimeoVideoId(input: string): string | null {
  const trimmed = input.trim()
  if (VIMEO_VIDEO_ID_RE.test(trimmed)) return trimmed

  const url = parseUrl(trimmed)
  if (!url) return null

  const host = normalizeVimeoHost(url.hostname)
  if (host === 'player.vimeo.com') {
    const match = /^\/video\/(\d+)/.exec(url.pathname)
    return match?.[1] && VIMEO_VIDEO_ID_RE.test(match[1]) ? match[1] : null
  }

  if (host === 'vimeo.com') {
    const segments = url.pathname.split('/').filter(Boolean)
    for (let i = segments.length - 1; i >= 0; i -= 1) {
      const segment = segments[i] ?? ''
      if (VIMEO_VIDEO_ID_RE.test(segment)) return segment
    }
  }

  return null
}

export function buildVimeoEmbedUrl(videoId: string): string {
  const url = new URL(`https://player.vimeo.com/video/${encodeURIComponent(videoId)}`)
  url.searchParams.set('title', '0')
  url.searchParams.set('byline', '0')
  url.searchParams.set('portrait', '0')
  return url.toString()
}

export function isAllowedVimeoEmbedSrc(src: string): boolean {
  const videoId = parseVimeoVideoId(src)
  if (!videoId) return false
  const url = parseUrl(src)
  if (!url) return false
  return normalizeVimeoHost(url.hostname) === 'player.vimeo.com'
}

export function isVimeoUrl(input: string): boolean {
  return parseVimeoVideoId(input) != null
}
