import { marked } from 'marked'
import { sanitizeComposeHtmlFragment } from '@/lib/sanitize-compose-html'
import { linkifyCopilotCitationMarkers } from '@/components/copilot/copilot-sources'

/**
 * Copilot liefert oft Personen-Links auf office.com/search?EntityRepresentationId=…
 * und lose Attribution-URLs — fuer die UI zu Klartext/ohne Noise vereinfachen.
 */
export function preprocessCopilotMarkdown(markdown: string): string {
  let text = markdown.trim()
  if (!text) return ''

  text = text.replace(
    /\[([^\]]+)\]\(https?:\/\/(?:www\.)?office\.com\/search\?[^\s)]+\)/gi,
    '**$1**'
  )
  text = text.replace(
    /\[([^\]]+)\]\(https?:\/\/(?:www\.)?office\.com\/[^\s)]+\)/gi,
    '**$1**'
  )
  // Lose office.com-Such-URLs am Ende / in eigenen Zeilen entfernen
  text = text.replace(/^\s*https?:\/\/(?:www\.)?office\.com\/search\?[^\s]+\s*$/gim, '')
  text = linkifyCopilotCitationMarkers(text)
  text = text.replace(/\n{3,}/g, '\n\n').trim()
  return text
}

export function copilotMarkdownToSafeHtml(markdown: string): string {
  const prepared = preprocessCopilotMarkdown(markdown)
  if (!prepared) return ''
  // Bereits eingefuegte <sup>-Anker nicht von marked escapen: Platzhalter nutzen
  const tokens: string[] = []
  const withPlaceholders = prepared.replace(/<sup class="copilot-cite">[\s\S]*?<\/sup>/g, (m) => {
    const i = tokens.length
    tokens.push(m)
    return `%%COPILOT_CITE_${i}%%`
  })
  const parsed = marked.parse(withPlaceholders, { async: false, breaks: true, gfm: true })
  let html = typeof parsed === 'string' ? parsed : ''
  html = html.replace(/%%COPILOT_CITE_(\d+)%%/g, (_, i: string) => tokens[Number(i)] ?? '')
  return sanitizeComposeHtmlFragment(html)
}
