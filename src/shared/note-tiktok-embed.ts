export const NOTE_TIKTOK_EMBED_ATTR = 'data-note-tiktok-id' as const
export const NOTE_TIKTOK_EMBED_CLASS = 'note-tiktok-embed' as const

const TIKTOK_VIDEO_ID_RE = /^\d{5,}$/

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

function isTikTokHost(hostname: string): boolean {
  const host = hostname.replace(/^www\./, '')
  return host === 'tiktok.com' || host === 'vm.tiktok.com'
}

/** TikTok-Video-ID aus Teilen- oder Embed-URL extrahieren. */
export function parseTikTokVideoId(input: string): string | null {
  const trimmed = input.trim()
  if (TIKTOK_VIDEO_ID_RE.test(trimmed)) return trimmed

  const url = parseUrl(trimmed)
  if (!url || !isTikTokHost(url.hostname)) return null

  const embedMatch = /^\/embed\/v2\/(\d+)/.exec(url.pathname)
  if (embedMatch?.[1] && TIKTOK_VIDEO_ID_RE.test(embedMatch[1])) return embedMatch[1]

  const videoMatch = /\/video\/(\d+)/.exec(url.pathname)
  if (videoMatch?.[1] && TIKTOK_VIDEO_ID_RE.test(videoMatch[1])) return videoMatch[1]

  return null
}

export function buildTikTokEmbedUrl(videoId: string): string {
  return `https://www.tiktok.com/embed/v2/${encodeURIComponent(videoId)}`
}

export function isAllowedTikTokEmbedSrc(src: string): boolean {
  const videoId = parseTikTokVideoId(src)
  if (!videoId) return false
  const url = parseUrl(src)
  if (!url) return false
  return url.hostname.replace(/^www\./, '') === 'tiktok.com' && url.pathname.startsWith('/embed/v2/')
}

export function isTikTokUrl(input: string): boolean {
  return parseTikTokVideoId(input) != null
}
