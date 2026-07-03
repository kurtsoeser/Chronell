export const NOTE_TYPEFORM_EMBED_ATTR = 'data-note-typeform-id' as const
export const NOTE_TYPEFORM_EMBED_CLASS = 'note-typeform-embed' as const

const TYPEFORM_ID_RE = /^[A-Za-z0-9]+$/

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

function isTypeformHost(hostname: string): boolean {
  return hostname === 'form.typeform.com' || hostname.endsWith('.typeform.com')
}

/** Typeform-Formular-ID aus Teilen- oder Embed-URL extrahieren. */
export function parseTypeformId(input: string): string | null {
  const url = parseUrl(input)
  if (!url || !isTypeformHost(url.hostname)) return null

  const toMatch = /^\/to\/([^/?]+)/.exec(url.pathname)
  if (!toMatch?.[1]) return null
  const id = toMatch[1].trim()
  return TYPEFORM_ID_RE.test(id) ? id : null
}

export function buildTypeformEmbedUrl(formId: string): string {
  return `https://form.typeform.com/to/${encodeURIComponent(formId)}?typeform-embed=embedful&typeform-medium=embed-sdk`
}

export function isAllowedTypeformEmbedSrc(src: string): boolean {
  return parseTypeformId(src) != null
}

export function isTypeformUrl(input: string): boolean {
  return parseTypeformId(input) != null
}
