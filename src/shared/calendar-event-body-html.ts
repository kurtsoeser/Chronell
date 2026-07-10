import { buildMsFormsResponseUrl, parseMsFormsUrl } from './note-msforms-embed'

const URL_IN_TEXT_RE = /(https?:\/\/[^\s<>"']+)/gi
const IFRAME_SRC_RE =
  /<iframe\b[^>]*\bsrc=["']([^"']+)["'][^>]*(?:\/>|>[\s\S]*?<\/iframe>)/gi

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function linkifyEscapedHtml(escaped: string): string {
  return escaped.replace(URL_IN_TEXT_RE, (url) => `<a href="${url}">${url}</a>`)
}

function calendarLinkParagraph(url: string, label?: string): string {
  const href = escapeHtml(url)
  const text = escapeHtml(label ?? url)
  return `<p><a href="${href}" rel="noopener noreferrer" target="_blank">${text}</a></p>`
}

/**
 * Ersetzt iframe-Einbettungen (z. B. Microsoft-Forms-Share-Code) durch klickbare Links,
 * bevor Sanitizer iframes entfernen.
 */
export function promoteIframeSourcesToLinksInHtml(html: string): string {
  if (!/<iframe\b/i.test(html)) return html

  return html.replace(IFRAME_SRC_RE, (_match, rawSrc: string) => {
    const src = rawSrc.trim()
    const formsRef = parseMsFormsUrl(src)
    if (formsRef) {
      const openUrl = buildMsFormsResponseUrl(formsRef)
      return calendarLinkParagraph(openUrl, openUrl)
    }
    if (/^https?:\/\//i.test(src)) {
      return calendarLinkParagraph(src)
    }
    return ''
  })
}

/** Editor-HTML fuer Graph/Google: iframe-Links erhalten, bereinigen, nackte URLs linkifizieren. */
export function prepareCalendarEventDescriptionFromEditorHtml(
  editorHtml: string,
  sanitizeHtml: (html: string) => string
): string | null {
  const promoted = promoteIframeSourcesToLinksInHtml(editorHtml.trim())
  const sanitized = sanitizeHtml(promoted)
  return prepareCalendarEventBodyHtml(sanitized)
}

export function isEffectivelyEmptyCalendarBodyHtml(html: string): boolean {
  const t = html
    .replace(/<[^>]+>/gi, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\u00a0/g, ' ')
    .trim()
  return t.length === 0
}

/** Bare URLs ausserhalb bestehender Anker zu klickbaren Links machen. */
export function linkifyBareUrlsInHtmlFragment(html: string): string {
  const parts = html.split(/(<a\b[^>]*>[\s\S]*?<\/a>)/gi)
  return parts
    .map((part, index) => {
      if (index % 2 === 1) return part
      return part.replace(URL_IN_TEXT_RE, (url) => `<a href="${url}">${url}</a>`)
    })
    .join('')
}

/**
 * Kalender-Beschreibung fuer Microsoft Graph (contentType HTML) und Google `description`.
 * Wandelt Plain-Text in HTML um und linkifiziert nackte URLs.
 */
export function prepareCalendarEventBodyHtml(html: string | null | undefined): string | null {
  const trimmed = html?.trim().replace(/\0/g, '')
  if (!trimmed || isEffectivelyEmptyCalendarBodyHtml(trimmed)) return null

  if (/<[a-z][\s\S]*>/i.test(trimmed)) {
    return linkifyBareUrlsInHtmlFragment(trimmed)
  }

  return `<p>${linkifyEscapedHtml(escapeHtml(trimmed).replace(/\n/g, '<br>'))}</p>`
}
