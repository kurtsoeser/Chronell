import { marked } from 'marked'
import { NOTE_INK_HTML_SOURCE_ATTR } from '@shared/note-ink-document'
import { prepareNoteEditorHtml } from '@/lib/sanitize-compose-html'

const HTML_ROOT_TAG =
  /^<(p|div|h[1-6]|ul|ol|blockquote|table|hr|br|img|span|strong|em|a)\b/i

/** Erkennt gespeichertes HTML (TipTap/Compose) vs. Legacy-Markdown. */
export function isLikelyNoteHtml(body: string): boolean {
  const trimmed = body.trim()
  if (!trimmed) return true
  if (!trimmed.startsWith('<')) return false
  return HTML_ROOT_TAG.test(trimmed)
}

/** Markdown-Notiz in bereinigtes HTML fuer TipTap umwandeln. */
export function markdownToNoteHtml(markdown: string): string {
  const trimmed = markdown.trim()
  if (!trimmed) return ''
  const parsed = marked.parse(trimmed, { async: false, breaks: true, gfm: true })
  return prepareNoteEditorHtml(typeof parsed === 'string' ? parsed : '')
}

/** Leeren TipTap-Inhalt fuer die DB normalisieren. */
export function normalizeNoteBodyForStorage(html: string): string {
  const trimmed = html.trim()
  if (!trimmed) return ''
  if (trimmed === '<p></p>' || trimmed === '<p><br></p>' || trimmed === '<p><br/></p>') {
    return ''
  }
  return html
}

/** Editor-HTML aus gespeichertem Notiz-Body (inkl. Markdown-Migration). */
export function prepareNoteBodyForEditor(body: string): {
  html: string
  migratedFromMarkdown: boolean
} {
  const trimmed = body.trim()
  if (!trimmed) {
    return { html: '', migratedFromMarkdown: false }
  }
  if (isLikelyNoteHtml(trimmed)) {
    return { html: prepareNoteEditorHtml(trimmed), migratedFromMarkdown: false }
  }
  return { html: markdownToNoteHtml(trimmed), migratedFromMarkdown: true }
}

/** Vorschau-Text fuer Listen/Dashboard (HTML oder Markdown). */
export function notePreviewText(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (isLikelyNoteHtml(trimmed)) {
    return trimmed
      .slice(0, 2400)
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<\/p>/gi, ' ')
      .replace(/<\/li>/gi, ' ')
      .replace(/<\/h[1-6]>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 1200)
  }
  return markdownPreviewText(trimmed)
}

/** Editor-HTML in DB-Format bringen. */
export function storedBodyFromEditorHtml(editorHtml: string): string {
  return normalizeNoteBodyForStorage(editorHtml)
}

/** Ink-Vorschaubilder: data:-URL im Editor und note-media:// in der DB gelten als gleich. */
function normalizeInkImageSrcForCompare(html: string): string {
  if (!html.includes(NOTE_INK_HTML_SOURCE_ATTR)) return html
  return html.replace(/<img\b[^>]*>/gi, (tag) => {
    if (!tag.includes(NOTE_INK_HTML_SOURCE_ATTR)) return tag
    const idMatch = tag.match(new RegExp(`${NOTE_INK_HTML_SOURCE_ATTR}="(\\d+)"`))
    if (!idMatch) return tag
    if (/src="[^"]*"/i.test(tag)) {
      return tag.replace(/src="[^"]*"/i, `src="ink:${idMatch[1]}"`)
    }
    return tag
  })
}

function storedBodyForEditingCompare(html: string): string {
  return storedBodyFromEditorHtml(normalizeInkImageSrcForCompare(html))
}

/** Zwei Notiz-Bodies vergleichen (Editor-HTML oder gespeichert). */
export function noteBodiesEqual(a: string, b: string): boolean {
  return storedBodyForEditingCompare(a) === storedBodyForEditingCompare(b)
}

/** Hat die Notiz sichtbaren Inhalt? */
export function hasNoteBodyContent(body: string): boolean {
  return storedBodyFromEditorHtml(body).length > 0
}

/** Legacy-Markdown-Vorschau (Klartext). */
export function markdownPreviewText(value: string): string {
  return value
    .slice(0, 1200)
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^\s{0,3}(#{1,6}|[-*+]\s+|\d+\.\s+|>\s?)/gm, '')
    .replace(/[*_~>#]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}
