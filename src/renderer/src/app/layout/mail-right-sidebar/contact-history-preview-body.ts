import type { MailFull } from '@shared/types'
import {
  replaceInlineCidImages,
  sanitizeMailHtml,
  stripUnresolvedCidUrls
} from '@/lib/sanitize'

const MAX_PLAIN_CHARS = 4_000

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** HTML-Vorschau fuer Hover (wie Lesefenster: HTML zuerst, kein Laden externer Bilder). */
export function buildContactHistoryPreviewBodyHtml(
  message: MailFull,
  snippet: string | null | undefined,
  inlineImages: Record<string, string> = {}
): string {
  if (message.bodyHtml?.trim()) {
    const withInline = replaceInlineCidImages(message.bodyHtml, inlineImages)
    return sanitizeMailHtml(stripUnresolvedCidUrls(withInline), { loadImages: false })
  }
  if (message.bodyText?.trim()) {
    const text =
      message.bodyText.length > MAX_PLAIN_CHARS
        ? `${message.bodyText.slice(0, MAX_PLAIN_CHARS)}…`
        : message.bodyText
    return `<div class="contact-history-preview-plain">${escapeHtml(text).replace(/\n/g, '<br>')}</div>`
  }
  if (snippet?.trim()) {
    return `<div class="contact-history-preview-plain">${escapeHtml(snippet.trim())}</div>`
  }
  return ''
}

export function buildContactHistoryPreviewSnippetHtml(snippet: string): string {
  return `<div class="contact-history-preview-plain">${escapeHtml(snippet.trim())}</div>`
}
