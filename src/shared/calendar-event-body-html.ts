const URL_IN_TEXT_RE = /(https?:\/\/[^\s<>"']+)/gi

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
