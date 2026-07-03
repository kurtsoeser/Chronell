export const NOTE_CODEPEN_EMBED_ATTR = 'data-note-codepen-ref' as const
export const NOTE_CODEPEN_EMBED_CLASS = 'note-codepen-embed' as const

const CODEPEN_PEN_ID_RE = /^[A-Za-z0-9]+$/

export interface CodePenEmbedRef {
  owner: string
  penId: string
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

function isCodePenHost(hostname: string): boolean {
  const host = hostname.replace(/^www\./, '')
  return host === 'codepen.io'
}

function parseCodePenPath(pathname: string): CodePenEmbedRef | null {
  const segments = pathname.split('/').filter(Boolean)
  if (segments.length < 3) return null

  const embedIndex = segments.indexOf('embed')
  const penIndex = segments.indexOf('pen')
  const detailsIndex = segments.indexOf('details')
  const fullIndex = segments.indexOf('full')

  let ownerEnd = -1
  let penId: string | null = null

  if (penIndex >= 0) {
    ownerEnd = penIndex
    penId = segments[penIndex + 1] ?? null
  } else if (embedIndex >= 0) {
    ownerEnd = embedIndex
    penId = segments[embedIndex + 1] ?? null
  } else if (detailsIndex >= 0) {
    ownerEnd = detailsIndex
    penId = segments[detailsIndex + 1] ?? null
  } else if (fullIndex >= 0) {
    ownerEnd = fullIndex
    penId = segments[fullIndex + 1] ?? null
  }

  if (ownerEnd < 1 || !penId || !CODEPEN_PEN_ID_RE.test(penId)) return null
  const owner = segments.slice(0, ownerEnd).join('/')
  if (!owner) return null
  return { owner, penId }
}

export function serializeCodePenEmbedRef(ref: CodePenEmbedRef): string {
  return `${ref.owner}/${ref.penId}`
}

export function parseCodePenEmbedRef(input: string): CodePenEmbedRef | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  const url = parseUrl(trimmed)
  if (url && isCodePenHost(url.hostname)) {
    return parseCodePenPath(url.pathname)
  }

  const slashMatch = /^([^/]+)\/([A-Za-z0-9]+)$/.exec(trimmed)
  if (slashMatch?.[1] && slashMatch[2]) {
    const owner = slashMatch[1]
    const penId = slashMatch[2]
    if (CODEPEN_PEN_ID_RE.test(penId)) return { owner, penId }
  }

  return null
}

export function buildCodePenEmbedUrl(ref: string): string {
  const parsed = parseCodePenEmbedRef(ref)
  if (!parsed) return ref
  const url = new URL(`https://codepen.io/${parsed.owner}/embed/${parsed.penId}`)
  url.searchParams.set('default-tab', 'result')
  url.searchParams.set('editable', 'false')
  return url.toString()
}

export function isAllowedCodePenEmbedSrc(src: string): boolean {
  const ref = parseCodePenEmbedRef(src)
  if (!ref) return false
  const url = parseUrl(src)
  if (!url || !isCodePenHost(url.hostname)) return false
  return url.pathname === `/${ref.owner}/embed/${ref.penId}`
}

export function isCodePenUrl(input: string): boolean {
  return parseCodePenEmbedRef(input) != null
}
