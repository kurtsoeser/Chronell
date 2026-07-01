import { isLikelyNoteHtml, markdownToNoteHtml } from '@/lib/note-body-html'

/**
 * Notiz-Inhalt fuer Vorschau: HTML durchreichen, Legacy-Markdown rendern,
 * oder Klartext mit klickbaren http(s)-Links.
 */
export function notesToPreviewHtml(notes: string): string {
  const trimmed = notes.trim()
  if (!trimmed) return ''

  if (isLikelyNoteHtml(trimmed)) {
    return trimmed
  }

  if (/[#*_`[\]>-]/.test(trimmed) || /^\s*[-*+]\s/m.test(trimmed) || /^\s*\d+\.\s/m.test(trimmed)) {
    return markdownToNoteHtml(trimmed)
  }

  const escaped = trimmed
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

  return escaped
    .replace(/(https?:\/\/[^\s<>"']+)/gi, (url) => `<a href="${url}">${url}</a>`)
    .replace(/\n/g, '<br>')
}
