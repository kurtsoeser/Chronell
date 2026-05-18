import type { ComposeSendInput } from '@shared/types'
import { listAccounts } from './accounts'
import { sendMail as graphSendMail } from './graph/compose'
import { gmailSendMail } from './google/gmail-compose'
import {
  listDueScheduledCompose,
  markScheduledComposeSent,
  recordScheduledComposeSendFailure,
  markScheduledComposeInvalidPayload
} from './db/compose-scheduled-repo'
import { findFolderByWellKnown } from './db/folders-repo'
import { runFolderSync } from './sync-runner'
import { setWaitingForMessage } from './waiting-service'
import { disposeComposeDraft } from './compose-draft-dispose'

function isComposeSendInput(x: unknown): x is ComposeSendInput {
  if (!x || typeof x !== 'object') return false
  const o = x as Record<string, unknown>
  return (
    typeof o.accountId === 'string' &&
    typeof o.subject === 'string' &&
    typeof o.bodyHtml === 'string' &&
    Array.isArray(o.to)
  )
}

async function sendImmediate(input: ComposeSendInput): Promise<void> {
  const accounts = await listAccounts()
  const acc = accounts.find((a) => a.id === input.accountId)
  if (!acc) throw new Error('Konto nicht gefunden.')
  let draftConsumedOnSend = false
  if (acc.provider === 'google') {
    const r = await gmailSendMail(
      {
        accountId: input.accountId,
        subject: input.subject,
        bodyHtml: input.bodyHtml,
        to: input.to,
        cc: input.cc,
        bcc: input.bcc,
        attachments: input.attachments,
        replyToRemoteId: input.replyToRemoteId,
        replyMode: input.replyMode,
        remoteDraftId: input.remoteDraftId
      },
      acc.email,
      acc.displayName
    )
    draftConsumedOnSend = r.sentFromExistingDraft
  } else {
    const r = await graphSendMail({
      accountId: input.accountId,
      subject: input.subject,
      bodyHtml: input.bodyHtml,
      to: input.to,
      cc: input.cc,
      bcc: input.bcc,
      attachments: input.attachments,
      replyToRemoteId: input.replyToRemoteId,
      replyMode: input.replyMode,
      importance: input.importance,
      isDeliveryReceiptRequested: input.isDeliveryReceiptRequested,
      isReadReceiptRequested: input.isReadReceiptRequested,
      referenceAttachments: input.referenceAttachments,
      remoteDraftId: input.remoteDraftId
    })
    draftConsumedOnSend = r.sentFromExistingDraft
  }

  if (input.remoteDraftId?.trim() || input.linkedMessageId != null) {
    await disposeComposeDraft({
      accountId: input.accountId,
      remoteDraftId: input.remoteDraftId,
      linkedMessageId: input.linkedMessageId,
      draftConsumedOnSend
    })
  }

  const sentFolder = findFolderByWellKnown(input.accountId, 'sentitems')
  if (sentFolder) {
    void runFolderSync(sentFolder.id).catch(() => undefined)
  }
}

/**
 * Wird vom Mail-Polling-Tick aufgerufen: faellige geplante Nachrichten senden.
 */
export async function processScheduledComposeQueue(): Promise<void> {
  const due = listDueScheduledCompose(6)
  for (const row of due) {
    let input: ComposeSendInput
    try {
      const parsed: unknown = JSON.parse(row.payloadJson)
      if (!isComposeSendInput(parsed)) {
        throw new Error('Ungueltiger gespeicherter Compose-Payload.')
      }
      input = parsed
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      markScheduledComposeInvalidPayload(row.id, msg)
      continue
    }

    try {
      await sendImmediate(input)
      if (
        input.trackWaitingOnMessageId != null &&
        input.expectReplyInDays != null &&
        input.expectReplyInDays > 0
      ) {
        try {
          setWaitingForMessage(input.trackWaitingOnMessageId, input.expectReplyInDays)
        } catch (e) {
          console.warn('[scheduled-compose] waiting-for:', e)
        }
      }
      markScheduledComposeSent(row.id)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      recordScheduledComposeSendFailure(row.id, msg)
    }
  }
}
