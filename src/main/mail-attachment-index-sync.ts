import { isRealMailAttachment } from '@shared/mail-attachment-filter'
import {
  markMessageAttachmentsIndexed,
  replaceMessageAttachments,
  type AttachmentUpsertInput
} from './db/attachments-repo'
import { getMessageById } from './db/messages-repo-ops'
import { fetchMailAttachmentsMeta } from './mail-attachment-fetch'

/**
 * Holt Anhang-Metadaten vom Provider und schreibt den lokalen Index.
 * Markiert die Mail auch dann als indexiert, wenn keine „echten“ Anhänge existieren.
 */
export async function indexMessageAttachments(messageId: number): Promise<boolean> {
  const msg = getMessageById(messageId)
  if (!msg) return false

  if (!msg.hasAttachments) {
    markMessageAttachmentsIndexed(messageId)
    replaceMessageAttachments(messageId, [])
    return true
  }

  if (!msg.remoteId?.trim()) {
    return false
  }

  const meta = await fetchMailAttachmentsMeta(messageId)
  const receivedAt = msg.receivedAt ?? msg.sentAt ?? null
  const rows: AttachmentUpsertInput[] = meta.filter(isRealMailAttachment).map((a) => ({
    remoteId: a.id,
    name: a.name,
    mime: a.contentType,
    size: a.size,
    contentId: a.contentId,
    isInline: a.isInline,
    accountId: msg.accountId,
    receivedAt,
    subject: msg.subject ?? '',
    fromAddr: msg.fromAddr ?? msg.fromName ?? null
  }))

  replaceMessageAttachments(messageId, rows)
  markMessageAttachmentsIndexed(messageId)

  const realCount = meta.filter(isRealMailAttachment).length
  if (realCount === 0 && meta.length > 0) {
    // DB hat nur Inline/kleine Einträge; Lesepane zeigt sie nicht — Index ist trotzdem vollständig.
  }

  return true
}
