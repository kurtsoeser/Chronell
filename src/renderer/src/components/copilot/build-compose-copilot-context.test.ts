/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildComposeCopilotContext,
  composeCopilotNeedsRecipients
} from './build-compose-copilot-context'
import type { ComposeDraft } from '@/stores/compose'

function baseDraft(patch: Partial<ComposeDraft> = {}): ComposeDraft {
  return {
    id: 'cmp-1',
    accountId: 'ms:acct',
    mode: 'new',
    to: '',
    cc: '',
    bcc: '',
    showCcBcc: false,
    subject: '',
    prependRichHtml: '<p></p>',
    prependPlain: '',
    signatureRichHtml: '',
    quotedHtml: '',
    attachments: [],
    referenceAttachments: [],
    importance: 'normal',
    isDeliveryReceiptRequested: false,
    isReadReceiptRequested: false,
    smimeEncrypt: false,
    smimeSign: false,
    scheduledSendAt: null,
    ...patch
  }
}

describe('composeCopilotNeedsRecipients', () => {
  it('allows reply without to-field check', () => {
    expect(composeCopilotNeedsRecipients(baseDraft({ mode: 'reply' }))).toBe(true)
  })

  it('requires recipient or subject for new mail', () => {
    expect(composeCopilotNeedsRecipients(baseDraft())).toBe(false)
    expect(composeCopilotNeedsRecipients(baseDraft({ subject: 'Hi' }))).toBe(true)
    expect(
      composeCopilotNeedsRecipients(baseDraft({ to: 'Ada <ada@example.com>' }))
    ).toBe(true)
  })
})

describe('buildComposeCopilotContext', () => {
  beforeEach(() => {
    vi.stubGlobal('mailClient', {
      mail: {
        getMessage: vi.fn(),
        listMessagesByThreads: vi.fn(),
        listCorrespondence: vi.fn()
      }
    })
  })

  it('includes draft meta and correspondence for new mail', async () => {
    const listCorrespondence = window.mailClient.mail.listCorrespondence as ReturnType<
      typeof vi.fn
    >
    listCorrespondence.mockResolvedValue({
      total: 1,
      items: [
        {
          id: 1,
          accountId: 'ms:acct',
          folderId: null,
          threadId: null,
          remoteId: 'r1',
          remoteThreadId: null,
          subject: 'Letzte Abstimmung',
          fromAddr: 'ada@example.com',
          fromName: 'Ada',
          snippet: 'Bitte um Feedback',
          sentAt: null,
          receivedAt: '2026-01-02T10:00:00Z',
          isRead: true,
          isFlagged: false,
          hasAttachments: false,
          importance: null,
          snoozedUntil: null,
          isFromMe: false,
          folderWellKnown: 'inbox'
        }
      ]
    })

    const ctx = await buildComposeCopilotContext(
      baseDraft({
        to: 'Ada <ada@example.com>',
        subject: 'Nächstes Meeting'
      })
    )

    expect(ctx.some((c) => c.includes('COMPOSE_DRAFT'))).toBe(true)
    expect(ctx.some((c) => c.includes('PRIOR_CORRESPONDENCE'))).toBe(true)
    expect(ctx.some((c) => c.includes('Letzte Abstimmung'))).toBe(true)
    expect(listCorrespondence).toHaveBeenCalled()
  })

  it('loads original mail and thread for reply', async () => {
    const getMessage = window.mailClient.mail.getMessage as ReturnType<typeof vi.fn>
    const listByThreads = window.mailClient.mail.listMessagesByThreads as ReturnType<typeof vi.fn>

    getMessage.mockResolvedValue({
      id: 42,
      accountId: 'ms:acct',
      folderId: null,
      threadId: 1,
      remoteId: 'r42',
      remoteThreadId: 'thread-1',
      subject: 'Projektstatus',
      fromAddr: 'bob@example.com',
      fromName: 'Bob',
      toAddrs: 'me@example.com',
      ccAddrs: null,
      bccAddrs: null,
      snippet: null,
      bodyHtml: null,
      bodyText: 'Können wir morgen sprechen?',
      sentAt: null,
      receivedAt: '2026-01-03T09:00:00Z',
      isRead: true,
      isFlagged: false,
      hasAttachments: false,
      importance: null,
      snoozedUntil: null
    })

    listByThreads.mockResolvedValue([
      {
        id: 41,
        accountId: 'ms:acct',
        folderId: null,
        threadId: 1,
        remoteId: 'r41',
        remoteThreadId: 'thread-1',
        subject: 'Projektstatus',
        fromAddr: 'me@example.com',
        fromName: 'Me',
        snippet: 'Hier der Stand',
        sentAt: '2026-01-02T08:00:00Z',
        receivedAt: null,
        isRead: true,
        isFlagged: false,
        hasAttachments: false,
        importance: null,
        snoozedUntil: null
      }
    ])

    const ctx = await buildComposeCopilotContext(
      baseDraft({
        mode: 'reply',
        to: 'bob@example.com',
        subject: 'Re: Projektstatus',
        replyToMessageId: 42,
        quotedHtml: '<p>Können wir morgen sprechen?</p>'
      })
    )

    expect(ctx.some((c) => c.includes('ORIGINAL_EMAIL'))).toBe(true)
    expect(ctx.some((c) => c.includes('Können wir morgen sprechen?'))).toBe(true)
    expect(ctx.some((c) => c.includes('CONVERSATION_THREAD'))).toBe(true)
  })
})
