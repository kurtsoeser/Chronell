/** Escaped Text fuer einfaches HTML-Fragment (Cloud-Link im Composer). */
function escapeHtmlText(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function escapeHtmlAttr(s: string): string {
  return escapeHtmlText(s).replace(/'/g, '&#39;')
}

/** Link-Zeile fuer TipTap / gesendete HTML-Mail. */
export function cloudFileLinkHtml(name: string, webUrl: string): string {
  const href = escapeHtmlAttr(webUrl.trim())
  const label = escapeHtmlText(name.trim() || webUrl)
  return `<p><a href="${href}" rel="noopener noreferrer">${label}</a></p>`
}

export function appendHtmlToComposeBody(current: string, fragment: string): string {
  const cur = current.replace(/<p><\/p>\s*$/i, '').trim()
  if (!fragment.trim()) return cur
  return cur ? `${cur}${fragment}` : fragment
}
