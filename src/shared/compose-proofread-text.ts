function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** HTML aus dem Compose-Editor zu Klartext für Prüfdienste. */
export function composeEditorHtmlToPlainText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/\s+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

/** Korrigierten Klartext als einfaches Compose-HTML (Absätze). */
export function composePlainTextToEditorHtml(plain: string): string {
  const trimmed = plain.trim()
  if (!trimmed) return ''
  return trimmed
    .split(/\n{2,}/)
    .map((para) => {
      const lines = para.split('\n').map((line) => escapeHtml(line.trim())).filter(Boolean)
      if (lines.length === 0) return ''
      return `<p>${lines.join('<br>')}</p>`
    })
    .filter(Boolean)
    .join('')
}
