import type { AttachmentMeta } from '@shared/types'
import { listAccounts } from './accounts'
import { isDemoAccount } from './demo/demo-accounts'
import { listAttachmentsMeta } from './graph/attachments'
import {
  downloadEwsAttachmentBytes,
  listEwsAttachmentsMeta
} from './ews/attachments-ews'
import {
  gmailDownloadAttachmentBytes,
  gmailListAttachmentsMeta
} from './google/gmail-attachments'
import { shouldUseEwsForMicrosoftMail } from './ews/microsoft-mail-transport'
import { downloadAttachmentBytes } from './graph/attachments'
import { getMessageById } from './db/messages-repo-ops'
import { isGraphItemNotFound } from './graph/graph-request-errors'

/**
 * Listet Anhang-Metadaten einer Mail vom Provider (Graph / EWS / Gmail).
 */
export async function fetchMailAttachmentsMeta(messageId: number): Promise<AttachmentMeta[]> {
  const msg = getMessageById(messageId)
  if (!msg?.remoteId?.trim()) return []

  try {
    const accounts = await listAccounts()
    const acc = accounts.find((a) => a.id === msg.accountId)
    if (acc && isDemoAccount(acc)) return []
    if (acc?.provider === 'google') {
      return await gmailListAttachmentsMeta(msg.accountId, msg.remoteId)
    }
    if (await shouldUseEwsForMicrosoftMail(msg.accountId)) {
      return await listEwsAttachmentsMeta(msg.accountId, msg.remoteId)
    }
    return await listAttachmentsMeta(msg.accountId, msg.remoteId)
  } catch (e) {
    if (!isGraphItemNotFound(e)) {
      console.warn('[mail-attachment-fetch] list failed:', e)
    }
    return []
  }
}

export async function downloadMailAttachmentBytes(
  messageId: number,
  attachmentId: string
): Promise<{ name: string; contentType: string | null; bytes: Buffer }> {
  const msg = getMessageById(messageId)
  if (!msg?.remoteId?.trim()) {
    throw new Error('Mail nicht gefunden.')
  }
  const accounts = await listAccounts()
  const acc = accounts.find((a) => a.id === msg.accountId)
  if (acc && isDemoAccount(acc)) {
    throw new Error('Demo-Modus: Anhänge werden nicht vom Provider geladen.')
  }
  if (acc?.provider === 'google') {
    return gmailDownloadAttachmentBytes(msg.accountId, msg.remoteId, attachmentId)
  }
  if (await shouldUseEwsForMicrosoftMail(msg.accountId)) {
    return downloadEwsAttachmentBytes(msg.accountId, attachmentId)
  }
  return downloadAttachmentBytes(msg.accountId, msg.remoteId, attachmentId)
}
