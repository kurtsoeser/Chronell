import { NOTE_INK_HTML_SOURCE_ATTR } from '@shared/note-ink-document'
import { noteAttachmentMediaUrl } from '@shared/note-attachment-media-url'
import { findPngAttachmentForInkJson } from '@/lib/note-ink-load'

/** Ersetzt Legacy-Ink-Vorschaubilder (data:-URL) durch `note-media://`-Anhang-URLs. */
export async function rewriteInkBase64ToMediaUrls(
  noteId: number,
  bodyHtml: string
): Promise<string> {
  if (!bodyHtml.includes(NOTE_INK_HTML_SOURCE_ATTR) || !bodyHtml.includes('data:image')) {
    return bodyHtml
  }

  const attachments = await window.mailClient.notes.attachments.list(noteId)
  const doc = new DOMParser().parseFromString(bodyHtml, 'text/html')
  let changed = false

  for (const img of doc.querySelectorAll(`img[${NOTE_INK_HTML_SOURCE_ATTR}]`)) {
    const src = img.getAttribute('src') ?? ''
    if (!src.startsWith('data:image')) continue

    const inkJsonId = Number(img.getAttribute(NOTE_INK_HTML_SOURCE_ATTR))
    if (!Number.isFinite(inkJsonId) || inkJsonId <= 0) continue

    const inkAttachment = attachments.find((att) => att.id === inkJsonId)
    if (!inkAttachment) continue

    const pngAttachment = findPngAttachmentForInkJson(inkAttachment, attachments)
    if (!pngAttachment) continue

    img.setAttribute('src', noteAttachmentMediaUrl(noteId, pngAttachment.id))
    changed = true
  }

  return changed ? doc.body.innerHTML : bodyHtml
}
