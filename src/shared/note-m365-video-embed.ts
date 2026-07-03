import { parseSharePointStreamPageEmbedSrc } from './note-m365-stream-embed'

export const NOTE_M365_VIDEO_EMBED_ATTR = 'data-note-m365-video-ref' as const
export const NOTE_M365_VIDEO_EMBED_CLASS = 'note-m365-video-embed' as const

export type NoteM365VideoEmbedError =
  | 'no_account'
  | 'forbidden'
  | 'not_found'
  | 'not_video'
  | 'offline'
  | 'unknown'

export interface NoteM365VideoEmbedRef {
  shareUrl: string
  accountId?: string
  driveId?: string
  itemId?: string
  title?: string
  thumbnailUrl?: string
  webUrl?: string
  mimeType?: string
  /** `stream` = SharePoint-Stream-iframe (Untertitel, Kommentare); `native` = Graph-`<video>` */
  playback?: 'stream' | 'native'
  streamEmbedSrc?: string
  error?: NoteM365VideoEmbedError
}

const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.m4v', '.webm', '.avi', '.mkv'])

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

function canonicalizeShareUrl(url: URL): string {
  url.hash = ''
  return url.toString()
}

export function isSharePointHost(hostname: string): boolean {
  return hostname.toLowerCase().replace(/^www\./, '').endsWith('.sharepoint.com')
}

export function isOneDriveLiveHost(hostname: string): boolean {
  return hostname.toLowerCase().replace(/^www\./, '') === 'onedrive.live.com'
}

export function isM365VideoShortUrl(input: string): boolean {
  const url = parseUrl(input)
  if (!url) return false
  const host = url.hostname.toLowerCase()
  return host === '1drv.ms' || (host === 'onedrive.live.com' && url.pathname === '/redir')
}

function hasVideoPath(pathname: string): boolean {
  const lower = pathname.toLowerCase()
  if (lower.includes('/:v:/')) return true
  for (const ext of VIDEO_EXTENSIONS) {
    if (lower.endsWith(ext)) return true
  }
  return false
}

function isSharePointVideoUrl(url: URL): boolean {
  if (!isSharePointHost(url.hostname)) return false
  return hasVideoPath(url.pathname)
}

function isOneDriveLiveVideoUrl(url: URL): boolean {
  if (!isOneDriveLiveHost(url.hostname)) return false
  if (url.pathname.toLowerCase().includes('/embed')) return true
  if (url.searchParams.has('id') || url.searchParams.has('resid') || url.searchParams.has('cid')) {
    return true
  }
  return hasVideoPath(url.pathname)
}

/** E2.1 — SharePoint/OneDrive-Video-Freigabelink erkennen und kanonische URL liefern. */
export function parseM365VideoShareUrl(input: string): string | null {
  const url = parseUrl(input)
  if (!url) return null

  if (isM365VideoShortUrl(input)) {
    return canonicalizeShareUrl(url)
  }

  if (isSharePointVideoUrl(url) || isOneDriveLiveVideoUrl(url)) {
    return canonicalizeShareUrl(url)
  }

  return null
}

export function isM365VideoShareUrl(input: string): boolean {
  return parseM365VideoShareUrl(input) != null || parseSharePointStreamPageEmbedSrc(input) != null
}

export function createM365VideoStreamRef(
  input: string,
  streamEmbedSrc: string
): NoteM365VideoEmbedRef {
  return {
    shareUrl: input.trim(),
    streamEmbedSrc
  }
}

/** Einfüge-Ref aus beliebigem M365-Video-Link (Freigabe, stream.aspx, :v:/ …). */
export function buildM365VideoEmbedRefFromInput(input: string): NoteM365VideoEmbedRef | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  const directStreamEmbed = parseSharePointStreamPageEmbedSrc(trimmed)
  if (directStreamEmbed) return createM365VideoStreamRef(trimmed, directStreamEmbed)

  const shareUrl = parseM365VideoShareUrl(trimmed)
  if (shareUrl) return { shareUrl }

  return null
}

export function serializeM365VideoEmbedRef(ref: NoteM365VideoEmbedRef): string {
  return JSON.stringify(ref)
}

export function parseM365VideoEmbedRef(raw: string): NoteM365VideoEmbedRef | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  try {
    const parsed = JSON.parse(trimmed) as Partial<NoteM365VideoEmbedRef>
    if (typeof parsed.shareUrl !== 'string' || !parsed.shareUrl.trim()) return null
    return {
      shareUrl: parsed.shareUrl.trim(),
      ...(parsed.accountId ? { accountId: parsed.accountId } : {}),
      ...(parsed.driveId ? { driveId: parsed.driveId } : {}),
      ...(parsed.itemId ? { itemId: parsed.itemId } : {}),
      ...(parsed.title ? { title: parsed.title } : {}),
      ...(parsed.thumbnailUrl ? { thumbnailUrl: parsed.thumbnailUrl } : {}),
      ...(parsed.webUrl ? { webUrl: parsed.webUrl } : {}),
      ...(parsed.mimeType ? { mimeType: parsed.mimeType } : {}),
      ...(parsed.playback === 'stream' || parsed.playback === 'native'
        ? { playback: parsed.playback }
        : {}),
      ...(parsed.streamEmbedSrc ? { streamEmbedSrc: parsed.streamEmbedSrc } : {}),
      ...(parsed.error ? { error: parsed.error } : {})
    }
  } catch {
    return null
  }
}

export function isM365VideoEmbedReady(ref: NoteM365VideoEmbedRef): boolean {
  if (ref.error) return false
  return canUseM365NativePlayback(ref)
}

export function prefersM365StreamPlayback(ref: NoteM365VideoEmbedRef): boolean {
  return ref.playback === 'stream' && Boolean(ref.streamEmbedSrc?.trim())
}

export function canUseM365NativePlayback(ref: NoteM365VideoEmbedRef): boolean {
  return Boolean(ref.accountId?.trim() && ref.driveId?.trim() && ref.itemId?.trim() && !ref.error)
}

/** Graph-Shares-Token: `u!` + base64url(shareUrl). */
export function encodeGraphShareToken(shareUrl: string): string {
  const base64 = Buffer.from(shareUrl, 'utf8').toString('base64')
  const base64url = base64.replace(/=+$/u, '').replace(/\//g, '_').replace(/\+/g, '-')
  return `u!${base64url}`
}

export const M365_VIDEO_URL_PASTE_RE =
  /https?:\/\/(?:1drv\.ms\/v\/[^\s]+|[^\s]*\.sharepoint\.com\/(?::v:\/|[^\s]*(?:stream|embed)\.aspx)[^\s]*|onedrive\.live\.com\/[^\s]*)/gi
