import type { MailListItem } from '@shared/types'
import { dedupeMailListThreadMessagesById } from '@/lib/mail-list-ui'

/** QuickStep auf eine Mail oder alle Nachrichten einer Konversation anwenden. */
export async function runMailQuickStep(
  quickStepId: number,
  primary: MailListItem,
  bulkThread?: MailListItem[]
): Promise<void> {
  const targets =
    bulkThread && bulkThread.length > 1
      ? dedupeMailListThreadMessagesById(bulkThread)
      : [primary]
  for (const x of targets) {
    await window.mailClient.mail.runQuickStep({ quickStepId, messageId: x.id })
  }
}
