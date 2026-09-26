import { hardenWebinarInvitationLinksForOutlook } from '@/lib/build-webinar-invitation-html'
import DOMPurify from 'dompurify'
import { dedupeRepeatedWebinarTailSections, prepareCalendarEventBodyHtml } from '@shared/calendar-event-body-html'

/** Graph-Kalender-Body: Webinar-HTML mit Tabellen/Styles/Links — ohne Compose-Editor-Neutralisierung. */
const WEBINAR_SANITIZE: DOMPurify.Config = {
  ALLOWED_TAGS: [
    'a',
    'b',
    'br',
    'div',
    'em',
    'h1',
    'h2',
    'h3',
    'hr',
    'i',
    'img',
    'li',
    'ol',
    'p',
    's',
    'span',
    'strong',
    'sub',
    'sup',
    'table',
    'tbody',
    'td',
    'th',
    'thead',
    'tr',
    'u',
    'ul'
  ],
  ALLOWED_ATTR: [
    'href',
    'target',
    'rel',
    'style',
    'class',
    'id',
    'colspan',
    'rowspan',
    'src',
    'alt',
    'width',
    'height',
    'align',
    'valign',
    'border',
    'cellpadding',
    'cellspacing',
    'bgcolor',
    'data-mail-external'
  ],
  ALLOW_DATA_ATTR: true,
  ADD_DATA_URI_TAGS: ['img'],
  ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel|data|cid):|(?:[a-z-]+):|#)/i,
  FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'style'],
  FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover']
}

/**
 * Stellt echte https-hrefs wieder her, falls ein globaler Mail-Sanitize-Hook
 * `href="#"` + `data-mail-external` hinterlassen hat.
 */
export function restoreWebinarExternalHrefs(html: string): string {
  return html.replace(/<a\b([^>]*)>/gi, (full, attrs: string) => {
    const hrefMatch = attrs.match(/\bhref\s*=\s*["']([^"']*)["']/i)
    const href = (hrefMatch?.[1] ?? '').trim()
    const extMatch = attrs.match(/\bdata-mail-external\s*=\s*["']([^"']*)["']/i)
    const external = (extMatch?.[1] ?? '').trim()
    if (!external) return full
    if (href && href !== '#' && !href.startsWith('#')) return full
    let next = attrs.replace(/\bhref\s*=\s*["'][^"']*["']/i, `href="${external}"`)
    if (!/\bhref\s*=/i.test(next)) next = `${next} href="${external}"`
    next = next.replace(/\s*\bdata-mail-external\s*=\s*["'][^"']*["']/i, '')
    return `<a${next.startsWith(' ') ? next : ` ${next}`}>`
  })
}

export function sanitizeWebinarInvitationHtml(html: string): string {
  const trimmed = html.trim()
  if (!trimmed) return ''
  const sanitized = DOMPurify.sanitize(trimmed, WEBINAR_SANITIZE as import('dompurify').Config)
  return hardenWebinarInvitationLinksForOutlook(restoreWebinarExternalHrefs(sanitized))
}

/** Webinar-Body fuer Graph: CID/data-URLs behalten, Links linkifizieren. */
export function prepareWebinarInvitationBodyForGraph(html: string): string | null {
  const sanitized = sanitizeWebinarInvitationHtml(html)
  if (!sanitized) return null
  const prepared = prepareCalendarEventBodyHtml(sanitized)
  if (!prepared) return null
  return dedupeRepeatedWebinarTailSections(prepared)
}
