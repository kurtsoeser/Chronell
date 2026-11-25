import type { AttachmentMeta } from './types'

/** Mindestgröße für „echte“ Anhänge (wie Lesepane). */
export const MIN_MAIL_ATTACHMENT_SIZE_BYTES = 200

const INLINE_IMAGE_NAME = /\.(png|jpe?g|gif|webp|bmp|svg|ico)$/i

/**
 * Sichtbare Dateianhänge (nicht Signatur-/cid-Bilder, nicht Mikro-Artefakte).
 * Outlook/Graph setzt `isInline` manchmal auch für echte PDFs/Dokumente —
 * die sollen in der Anhangsleiste und im Verlauf trotzdem erscheinen.
 */
export function isRealMailAttachment(
  a: Pick<AttachmentMeta, 'isInline' | 'size' | 'contentType' | 'name'>
): boolean {
  const size = a.size ?? 0
  if (size > 0 && size < MIN_MAIL_ATTACHMENT_SIZE_BYTES) return false

  if (!a.isInline) return true

  const ct = (a.contentType ?? '').split(';')[0]?.trim().toLowerCase() ?? ''
  if (ct.startsWith('image/')) return false
  const name = (a.name ?? '').trim()
  if (name && INLINE_IMAGE_NAME.test(name)) return false
  // Ohne Namen/Typ eher Body-Artefakt als Download-Anhang
  if (!name && !ct) return false
  return true
}
