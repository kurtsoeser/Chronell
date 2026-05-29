import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/sanitize', () => ({
  replaceInlineCidImages: (html: string): string => html,
  stripUnresolvedCidUrls: (html: string): string => html,
  sanitizeMailHtml: (html: string): string => html
}))

import { buildContactHistoryPreviewBodyHtml } from './contact-history-preview-body'
import type { MailFull } from '@shared/types'

function minimalMail(overrides: Partial<MailFull>): MailFull {
  return {
    id: 1,
    accountId: 'a',
    remoteId: 'r',
    folderId: 1,
    subject: 'Test',
    fromAddr: 'a@b.c',
    fromName: null,
    toAddrs: null,
    ccAddrs: null,
    snippet: null,
    receivedAt: null,
    sentAt: null,
    isRead: true,
    isFlagged: false,
    hasAttachments: false,
    bodyHtml: null,
    bodyText: null,
    ...overrides
  } as MailFull
}

describe('buildContactHistoryPreviewBodyHtml', () => {
  it('prefers HTML over plain text when both exist', () => {
    const html = buildContactHistoryPreviewBodyHtml(
      minimalMail({
        bodyHtml: '<p><strong>HTML</strong> body</p>',
        bodyText: 'Plain only'
      }),
      null
    )
    expect(html).toContain('<strong>HTML</strong>')
    expect(html).not.toContain('Plain only')
  })

  it('falls back to plain text when no HTML', () => {
    const html = buildContactHistoryPreviewBodyHtml(
      minimalMail({ bodyText: 'Plain fallback' }),
      null
    )
    expect(html).toContain('Plain fallback')
    expect(html).toContain('contact-history-preview-plain')
  })
})
