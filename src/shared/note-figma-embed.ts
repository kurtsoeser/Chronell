export const NOTE_FIGMA_EMBED_ATTR = 'data-note-figma-url' as const
export const NOTE_FIGMA_EMBED_CLASS = 'note-figma-embed' as const

const FIGMA_PATH_KINDS = new Set(['file', 'design', 'proto', 'board', 'slides', 'deck'])
const FIGMA_FILE_KEY_RE = /^[A-Za-z0-9]{10,128}$/

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

function isFigmaHost(hostname: string): boolean {
  const host = hostname.replace(/^www\./, '')
  return host === 'figma.com'
}

function buildCanonicalFigmaUrl(kind: string, fileKey: string): string {
  return `https://www.figma.com/${kind}/${fileKey}/`
}

function parseFigmaPath(pathname: string): string | null {
  const segments = pathname.split('/').filter(Boolean)
  if (segments.length < 2) return null
  const kind = segments[0] ?? ''
  const fileKey = segments[1] ?? ''
  if (!FIGMA_PATH_KINDS.has(kind) || !FIGMA_FILE_KEY_RE.test(fileKey)) return null
  return buildCanonicalFigmaUrl(kind, fileKey)
}

/** Kanonische Figma-Seiten-URL für Speicherung und Embed-Auflösung. */
export function parseFigmaPageUrl(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  const url = parseUrl(trimmed)
  if (!url || !isFigmaHost(url.hostname)) return null

  if (url.pathname === '/embed') {
    const embedded = url.searchParams.get('url')?.trim()
    if (embedded) return parseFigmaPageUrl(embedded)
    return null
  }

  return parseFigmaPath(url.pathname)
}

export function buildFigmaEmbedUrl(pageUrl: string): string {
  const canonical = parseFigmaPageUrl(pageUrl) ?? pageUrl
  const url = new URL('https://www.figma.com/embed')
  url.searchParams.set('embed_host', 'share')
  url.searchParams.set('url', canonical)
  return url.toString()
}

export function isAllowedFigmaEmbedSrc(src: string): boolean {
  const url = parseUrl(src)
  if (!url || !isFigmaHost(url.hostname)) return false
  if (url.pathname !== '/embed') return false
  const embedded = url.searchParams.get('url')
  return embedded != null && parseFigmaPageUrl(embedded) != null
}

export function isFigmaUrl(input: string): boolean {
  return parseFigmaPageUrl(input) != null
}
