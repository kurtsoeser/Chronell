export const NOTE_SPOTIFY_EMBED_ATTR = 'data-note-spotify-ref' as const
export const NOTE_SPOTIFY_EMBED_CLASS = 'note-spotify-embed' as const

export type SpotifyEmbedKind = 'track' | 'album' | 'playlist' | 'episode' | 'show' | 'artist'

const SPOTIFY_KINDS = new Set<SpotifyEmbedKind>([
  'track',
  'album',
  'playlist',
  'episode',
  'show',
  'artist'
])

const SPOTIFY_ID_RE = /^[A-Za-z0-9]+$/

export interface SpotifyEmbedRef {
  kind: SpotifyEmbedKind
  id: string
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

function isSpotifyHost(hostname: string): boolean {
  return hostname === 'open.spotify.com' || hostname.endsWith('.spotify.com')
}

function parseSpotifyPath(pathname: string): SpotifyEmbedRef | null {
  const segments = pathname.split('/').filter(Boolean)
  let index = 0
  if (segments[0] === 'embed') index = 1
  else if (segments[0]?.startsWith('intl-')) index = 1
  const kind = segments[index] as SpotifyEmbedKind | undefined
  const id = segments[index + 1]
  if (!kind || !id || !SPOTIFY_KINDS.has(kind) || !SPOTIFY_ID_RE.test(id)) return null
  return { kind, id }
}

export function serializeSpotifyEmbedRef(ref: SpotifyEmbedRef): string {
  return `${ref.kind}/${ref.id}`
}

export function parseSpotifyEmbedRef(input: string): SpotifyEmbedRef | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  const slashMatch = /^([a-z]+)\/([A-Za-z0-9]+)$/i.exec(trimmed)
  if (slashMatch?.[1] && slashMatch[2]) {
    const kind = slashMatch[1] as SpotifyEmbedKind
    if (SPOTIFY_KINDS.has(kind)) return { kind, id: slashMatch[2] }
  }

  const url = parseUrl(trimmed)
  if (!url || !isSpotifyHost(url.hostname)) return null
  return parseSpotifyPath(url.pathname)
}

export function buildSpotifyEmbedUrl(ref: string): string {
  const parsed = parseSpotifyEmbedRef(ref)
  if (!parsed) return ref
  return `https://open.spotify.com/embed/${parsed.kind}/${parsed.id}`
}

export function isAllowedSpotifyEmbedSrc(src: string): boolean {
  const ref = parseSpotifyEmbedRef(src)
  if (!ref) return false
  const url = parseUrl(src)
  if (!url || !isSpotifyHost(url.hostname)) return false
  return url.pathname.startsWith('/embed/')
}

export function isSpotifyUrl(input: string): boolean {
  return parseSpotifyEmbedRef(input) != null
}
