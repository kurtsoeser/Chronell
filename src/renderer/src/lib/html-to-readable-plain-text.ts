/**
 * HTML-Mailbody in lesbaren Plain-Text fuer die Nur-Text-Ansicht.
 * Block-Elemente erzeugen Zeilenumbrueche; Markup wird entfernt.
 */
export function htmlToReadablePlainText(html: string): string {
  const trimmed = html.trim()
  if (!trimmed) return ''

  try {
    const doc = new DOMParser().parseFromString(trimmed, 'text/html')
    for (const br of Array.from(doc.querySelectorAll('br'))) {
      br.replaceWith(doc.createTextNode('\n'))
    }
    for (const block of Array.from(
      doc.querySelectorAll('p, div, tr, li, h1, h2, h3, h4, h5, h6, blockquote, pre, hr')
    )) {
      block.appendChild(doc.createTextNode('\n'))
    }
    for (const a of Array.from(doc.querySelectorAll('a[href]'))) {
      const href = (a.getAttribute('href') || '').trim()
      const label = (a.textContent || '').trim()
      if (href && label && href !== label && !label.includes(href)) {
        a.replaceWith(doc.createTextNode(`${label} <${href}>`))
      }
    }
    return (doc.body.textContent || '')
      .replace(/\u00a0/g, ' ')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  } catch {
    return trimmed
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|tr|li|h[1-6]|blockquote|pre)>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  }
}
