import type { MailListItem } from '@shared/types'
import type { MessageRuleContextRow } from '../main/db/messages-repo-core'

/** Minimale MailListItem-Fixture für Store-/Listen-Tests. */
export function makeMailListItem(id: number, overrides: Partial<MailListItem> = {}): MailListItem {
  return {
    id,
    accountId: 'acc-1',
    folderId: 1,
    threadId: null,
    remoteId: `r-${id}`,
    remoteThreadId: null,
    subject: `Mail ${id}`,
    fromAddr: 'a@example.com',
    fromName: null,
    snippet: '',
    receivedAt: `2026-06-${String(id).padStart(2, '0')}T10:00:00.000Z`,
    sentAt: null,
    isRead: false,
    isFlagged: false,
    hasAttachments: false,
    importance: 'normal',
    snoozedUntil: null,
    ...overrides
  }
}

/** Minimale Regel-Kontext-Fixture für rule-evaluator-Tests. */
export function makeMessageRuleContext(
  overrides: Partial<MessageRuleContextRow> = {}
): MessageRuleContextRow {
  return {
    id: 1,
    accountId: 'acc-1',
    folderId: 10,
    fromAddr: 'sender@example.com',
    fromName: 'Sender',
    toAddrs: 'me@example.com',
    ccAddrs: null,
    subject: 'Test subject',
    bodyText: 'Hello world',
    hasAttachments: false,
    listId: null,
    importance: 'normal',
    isRead: false,
    receivedAt: '2026-06-01T10:00:00.000Z',
    ...overrides
  }
}
