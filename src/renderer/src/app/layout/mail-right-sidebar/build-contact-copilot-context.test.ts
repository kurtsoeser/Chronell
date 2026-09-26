/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildContactCopilotContext } from './build-contact-copilot-context'
import type { MailCorrespondenceItem, PeopleContactView } from '@shared/types'

function item(partial: Partial<MailCorrespondenceItem> & { id: number }): MailCorrespondenceItem {
  return {
    accountId: 'ms:a',
    folderId: null,
    threadId: null,
    remoteId: `r${partial.id}`,
    remoteThreadId: null,
    subject: 'Betreff',
    fromAddr: 'ada@example.com',
    fromName: 'Ada',
    snippet: 'Kurztext',
    sentAt: null,
    receivedAt: '2026-01-02T10:00:00Z',
    isRead: true,
    isFlagged: false,
    hasAttachments: false,
    importance: null,
    snoozedUntil: null,
    isFromMe: false,
    folderWellKnown: 'inbox',
    ...partial
  }
}

describe('buildContactCopilotContext', () => {
  beforeEach(() => {
    vi.stubGlobal('mailClient', {
      mail: {
        getMessage: vi.fn().mockResolvedValue({
          id: 1,
          bodyText: 'Vollständiger Mailtext zum Projekt',
          bodyHtml: null
        })
      }
    })
  })

  it('includes contact profile and correspondence list', async () => {
    const contact = {
      id: 9,
      displayName: 'Ada Lovelace',
      company: 'Analytical Engines',
      jobTitle: 'Mathematician',
      department: 'R&D',
      notes: 'Wichtig für Projekt X'
    } as PeopleContactView

    const ctx = await buildContactCopilotContext({
      displayName: 'Ada Lovelace',
      primaryEmail: 'ada@example.com',
      emails: ['ada@example.com', 'ada@work.com'],
      contact,
      historyItems: [item({ id: 1, subject: 'Kickoff' })],
      includeRecentBodies: true
    })

    const joined = ctx.join('\n')
    expect(joined).toContain('CONTACT')
    expect(joined).toContain('Ada Lovelace')
    expect(joined).toContain('Analytical Engines')
    expect(joined).toContain('MAIL_CORRESPONDENCE')
    expect(joined).toContain('Kickoff')
    expect(joined).toContain('RECENT_MESSAGE_BODIES')
    expect(joined).toContain('Vollständiger Mailtext')
  })

  it('skips bodies when disabled', async () => {
    const getMessage = window.mailClient.mail.getMessage as ReturnType<typeof vi.fn>
    const ctx = await buildContactCopilotContext({
      displayName: 'Ada',
      primaryEmail: 'ada@example.com',
      emails: ['ada@example.com'],
      contact: null,
      historyItems: [item({ id: 2 })],
      includeRecentBodies: false
    })
    expect(ctx.join('\n')).not.toContain('RECENT_MESSAGE_BODIES')
    expect(getMessage).not.toHaveBeenCalled()
  })
})
