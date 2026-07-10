export const NOTE_MSFORMS_EMBED_ATTR = 'data-note-msforms-id' as const
export const NOTE_MSFORMS_EMBED_HOST_ATTR = 'data-note-msforms-host' as const
export const NOTE_MSFORMS_EMBED_CLASS = 'note-msforms-embed' as const

export type MsFormsEmbedHost = 'forms.office.com' | 'forms.cloud.microsoft'

export interface MsFormsEmbedRef {
  formId: string
  host: MsFormsEmbedHost
}

const MSFORMS_HOSTS = new Set<MsFormsEmbedHost>(['forms.office.com', 'forms.cloud.microsoft'])

const MSFORMS_RESPONSE_PATH = '/Pages/ResponsePage.aspx'

function normalizeMsFormsHost(hostname: string): MsFormsEmbedHost | null {
  const host = hostname.replace(/^www\./, '') as MsFormsEmbedHost
  return MSFORMS_HOSTS.has(host) ? host : null
}

function parseMsFormsUrlObject(url: URL): MsFormsEmbedRef | null {
  const host = normalizeMsFormsHost(url.hostname)
  if (!host) return null
  if (url.pathname !== MSFORMS_RESPONSE_PATH) return null
  const formId = url.searchParams.get('id')?.trim()
  if (!formId) return null
  return { formId, host }
}

/** Microsoft-Forms-Referenz aus ResponsePage-URL extrahieren. */
export function parseMsFormsUrl(input: string): MsFormsEmbedRef | null {
  const raw = input.trim()
  if (!raw) return null

  let url: URL
  try {
    url = new URL(raw)
  } catch {
    try {
      url = new URL(`https://${raw}`)
    } catch {
      return null
    }
  }
  return parseMsFormsUrlObject(url)
}

/** Öffentliche Formular-URL zum Ausfüllen (ohne embed=true). */
export function buildMsFormsResponseUrl(ref: MsFormsEmbedRef): string {
  const url = new URL(`https://${ref.host}${MSFORMS_RESPONSE_PATH}`)
  url.searchParams.set('id', ref.formId)
  return url.toString()
}

export function buildMsFormsEmbedUrl(ref: MsFormsEmbedRef): string {
  const url = new URL(buildMsFormsResponseUrl(ref))
  url.searchParams.set('embed', 'true')
  return url.toString()
}

export function isAllowedMsFormsEmbedSrc(src: string): boolean {
  const ref = parseMsFormsUrl(src)
  if (!ref) return false
  let url: URL
  try {
    url = new URL(src.trim())
  } catch {
    return false
  }
  return url.searchParams.get('embed') === 'true'
}

export function isMsFormsResponseUrl(input: string): boolean {
  return parseMsFormsUrl(input) != null
}
