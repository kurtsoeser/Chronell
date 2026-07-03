export const NOTE_DESMOS_EMBED_ATTR = 'data-note-desmos-ref' as const
export const NOTE_DESMOS_EMBED_CLASS = 'note-desmos-embed' as const

export type DesmosEmbedKind =
  | 'calculator'
  | 'geometry'
  | '3d'
  | 'scientific'
  | 'fourfunction'
  | 'matrix'
  | 'regression'
  | 'testmode'

const DESMOS_KINDS = new Set<DesmosEmbedKind>([
  'calculator',
  'geometry',
  '3d',
  'scientific',
  'fourfunction',
  'matrix',
  'regression',
  'testmode'
])

const DESMOS_ID_RE = /^[A-Za-z0-9]+$/

export interface DesmosEmbedRef {
  kind: DesmosEmbedKind
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

function isDesmosHost(hostname: string): boolean {
  const host = hostname.replace(/^www\./, '')
  return host === 'desmos.com'
}

function parseDesmosPath(pathname: string): DesmosEmbedRef | null {
  const segments = pathname.split('/').filter(Boolean)
  if (segments.length < 2) return null
  const kind = segments[0] as DesmosEmbedKind
  const id = segments[1] ?? ''
  if (!DESMOS_KINDS.has(kind) || !DESMOS_ID_RE.test(id)) return null
  return { kind, id }
}

export function serializeDesmosEmbedRef(ref: DesmosEmbedRef): string {
  return `${ref.kind}/${ref.id}`
}

export function parseDesmosEmbedRef(input: string): DesmosEmbedRef | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  const slashMatch = /^([a-z0-9]+)\/([A-Za-z0-9]+)$/i.exec(trimmed)
  if (slashMatch?.[1] && slashMatch[2]) {
    const kind = slashMatch[1] as DesmosEmbedKind
    if (DESMOS_KINDS.has(kind)) return { kind, id: slashMatch[2] }
  }

  const url = parseUrl(trimmed)
  if (!url || !isDesmosHost(url.hostname)) return null
  return parseDesmosPath(url.pathname)
}

export function buildDesmosEmbedUrl(ref: string): string {
  const parsed = parseDesmosEmbedRef(ref)
  if (!parsed) return ref
  const url = new URL(`https://www.desmos.com/${parsed.kind}/${parsed.id}`)
  url.searchParams.set('embed', '')
  return url.toString()
}

export function isAllowedDesmosEmbedSrc(src: string): boolean {
  const ref = parseDesmosEmbedRef(src)
  if (!ref) return false
  const url = parseUrl(src)
  if (!url || !isDesmosHost(url.hostname)) return false
  return url.pathname === `/${ref.kind}/${ref.id}` && url.searchParams.has('embed')
}

export function isDesmosUrl(input: string): boolean {
  return parseDesmosEmbedRef(input) != null
}
