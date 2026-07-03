import { NOTE_EMBED_HTTP_ORIGIN } from './note-embed-constants'

export const NOTE_CALENDLY_EMBED_ATTR = 'data-note-calendly-path' as const
export const NOTE_CALENDLY_EMBED_CLASS = 'note-calendly-embed' as const

const CALENDLY_RESERVED_SEGMENTS = new Set([
  'about',
  'app',
  'blog',
  'careers',
  'developers',
  'features',
  'help',
  'integrations',
  'login',
  'logout',
  'pricing',
  'privacy',
  'resources',
  'security',
  'signup',
  'solutions',
  'terms',
  'www'
])

const CALENDLY_SEGMENT_RE = /^[a-z0-9][a-z0-9_-]*$/i

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

function isCalendlyHost(hostname: string): boolean {
  const host = hostname.replace(/^www\./, '')
  return host === 'calendly.com'
}

function normalizeCalendlyPath(pathname: string): string | null {
  const segments = pathname.split('/').filter(Boolean)
  if (segments.length < 1 || segments.length > 2) return null

  const user = segments[0] ?? ''
  if (!CALENDLY_SEGMENT_RE.test(user) || CALENDLY_RESERVED_SEGMENTS.has(user.toLowerCase())) {
    return null
  }

  if (segments.length === 1) return user

  const event = segments[1] ?? ''
  if (!CALENDLY_SEGMENT_RE.test(event) || CALENDLY_RESERVED_SEGMENTS.has(event.toLowerCase())) {
    return null
  }

  return `${user}/${event}`
}

/** Calendly-Buchungspfad (`user` oder `user/event`) aus Teilen- oder Embed-URL. */
export function parseCalendlyPath(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  if (!trimmed.includes('://') && !trimmed.includes('calendly.com')) {
    const slashPath = normalizeCalendlyPath(`/${trimmed}`)
    if (slashPath) return slashPath
  }

  const url = parseUrl(trimmed)
  if (!url || !isCalendlyHost(url.hostname)) return null
  return normalizeCalendlyPath(url.pathname)
}

export function buildCalendlyEmbedUrl(path: string): string {
  const normalized = parseCalendlyPath(path) ?? path.replace(/^\//, '')
  const url = new URL(`https://calendly.com/${normalized}`)
  url.searchParams.set('embed_domain', NOTE_EMBED_HTTP_ORIGIN.replace(/^https?:\/\//, ''))
  url.searchParams.set('embed_type', 'Inline')
  return url.toString()
}

export function isAllowedCalendlyEmbedSrc(src: string): boolean {
  return parseCalendlyPath(src) != null
}

export function isCalendlyUrl(input: string): boolean {
  return parseCalendlyPath(input) != null
}
