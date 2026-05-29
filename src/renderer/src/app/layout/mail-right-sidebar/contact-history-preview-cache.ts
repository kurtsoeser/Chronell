import type { AttachmentMeta, MailFull } from '@shared/types'

export interface ContactHistoryPreviewPayload {
  message: MailFull
  attachments: AttachmentMeta[]
  /** Data-URIs fuer eingebettete cid:-Bilder (Signatur, Logo). */
  inlineImages: Record<string, string>
}

const MAX_ENTRIES = 20
const cache = new Map<number, ContactHistoryPreviewPayload>()

export function getContactHistoryPreviewCached(
  messageId: number
): ContactHistoryPreviewPayload | null {
  return cache.get(messageId) ?? null
}

export function setContactHistoryPreviewCached(
  messageId: number,
  payload: ContactHistoryPreviewPayload
): void {
  if (cache.has(messageId)) {
    cache.delete(messageId)
  }
  cache.set(messageId, payload)
  while (cache.size > MAX_ENTRIES) {
    const oldest = cache.keys().next().value
    if (oldest === undefined) break
    cache.delete(oldest)
  }
}

export function clearContactHistoryPreviewCache(): void {
  cache.clear()
}
