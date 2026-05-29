import type { AttachmentMeta } from './types'

/** Mindestgröße für „echte“ Anhänge (wie Lesepane). */
export const MIN_MAIL_ATTACHMENT_SIZE_BYTES = 200

export function isRealMailAttachment(
  a: Pick<AttachmentMeta, 'isInline' | 'size'>
): boolean {
  if (a.isInline) return false
  const size = a.size ?? 0
  if (size > 0 && size < MIN_MAIL_ATTACHMENT_SIZE_BYTES) return false
  return true
}
