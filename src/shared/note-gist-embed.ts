export const NOTE_GIST_EMBED_ATTR = 'data-note-gist-ref' as const
export const NOTE_GIST_EMBED_CLASS = 'note-gist-embed' as const

const GIST_ID_RE = /^[a-f0-9]+$/

export interface GistEmbedRef {
  user: string
  gistId: string
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

function isGistHost(hostname: string): boolean {
  const host = hostname.replace(/^www\./, '')
  return host === 'gist.github.com'
}

export function serializeGistEmbedRef(ref: GistEmbedRef): string {
  return `${ref.user}/${ref.gistId}`
}

export function parseGistEmbedRef(input: string): GistEmbedRef | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  const slashMatch = /^([^/]+)\/([a-f0-9]+)$/i.exec(trimmed)
  if (slashMatch?.[1] && slashMatch[2]) {
    const user = slashMatch[1]
    const gistId = slashMatch[2]
    if (GIST_ID_RE.test(gistId)) return { user, gistId }
  }

  const url = parseUrl(trimmed)
  if (!url || !isGistHost(url.hostname)) return null

  const segments = url.pathname.split('/').filter(Boolean)
  if (segments.length === 2) {
    const user = segments[0] ?? ''
    const gistId = segments[1] ?? ''
    if (user && GIST_ID_RE.test(gistId)) return { user, gistId }
  }

  return null
}

export function buildGistEmbedUrl(ref: string): string {
  const parsed = parseGistEmbedRef(ref)
  if (!parsed) return ref
  return `https://gist.github.com/${parsed.user}/${parsed.gistId}`
}

export function isAllowedGistEmbedSrc(src: string): boolean {
  const ref = parseGistEmbedRef(src)
  if (!ref) return false
  const url = parseUrl(src)
  if (!url || !isGistHost(url.hostname)) return false
  return url.pathname === `/${ref.user}/${ref.gistId}`
}

export function isGistUrl(input: string): boolean {
  return parseGistEmbedRef(input) != null
}
