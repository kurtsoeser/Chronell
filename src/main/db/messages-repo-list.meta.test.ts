import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type Database from 'better-sqlite3'
import { createInMemoryTestDb, isInMemorySqliteAvailable } from '../../test-fixtures/db'
import { insertTestFolder, insertTestMessage } from '../../test-fixtures/db-mail-seed'

const { testDbRef } = vi.hoisted(() => ({
  testDbRef: { current: null as Database.Database | null }
}))

vi.mock('./index', () => ({
  getDb: () => {
    if (!testDbRef.current) throw new Error('test db not initialized')
    return testDbRef.current
  }
}))

import { listMessagesForMetaCriteria } from './messages-repo-list'

describe.skipIf(!isInMemorySqliteAvailable())('listMessagesForMetaCriteria', () => {
  const accountId = 'acc-1'

  beforeEach(() => {
    testDbRef.current = createInMemoryTestDb()
  })

  afterEach(() => {
    testDbRef.current?.close()
    testDbRef.current = null
  })

  it('liefert nur ungelesene Mails bei unreadOnly', () => {
    const inbox = insertTestFolder(testDbRef.current!, {
      accountId,
      remoteId: 'inbox',
      name: 'Inbox',
      wellKnown: 'inbox'
    })
    insertTestMessage(testDbRef.current!, {
      accountId,
      folderId: inbox.id,
      remoteId: 'm1',
      subject: 'Ungelesen',
      isRead: false
    })
    insertTestMessage(testDbRef.current!, {
      accountId,
      folderId: inbox.id,
      remoteId: 'm2',
      subject: 'Gelesen',
      isRead: true
    })

    const hits = listMessagesForMetaCriteria({ unreadOnly: true }, null)
    expect(hits).toHaveLength(1)
    expect(hits[0]!.subject).toBe('Ungelesen')
  })

  it('schliesst Papierkorb und Junk ohne scopeFolderIds aus', () => {
    const inbox = insertTestFolder(testDbRef.current!, {
      accountId,
      remoteId: 'inbox',
      name: 'Inbox',
      wellKnown: 'inbox'
    })
    const junk = insertTestFolder(testDbRef.current!, {
      accountId,
      remoteId: 'junk',
      name: 'Junk',
      wellKnown: 'junkemail'
    })
    const trash = insertTestFolder(testDbRef.current!, {
      accountId,
      remoteId: 'trash',
      name: 'Trash',
      wellKnown: 'deleteditems'
    })
    insertTestMessage(testDbRef.current!, {
      accountId,
      folderId: inbox.id,
      remoteId: 'inbox-mail',
      subject: 'Inbox Mail'
    })
    insertTestMessage(testDbRef.current!, {
      accountId,
      folderId: junk.id,
      remoteId: 'junk-mail',
      subject: 'Junk Mail'
    })
    insertTestMessage(testDbRef.current!, {
      accountId,
      folderId: trash.id,
      remoteId: 'trash-mail',
      subject: 'Trash Mail'
    })

    const hits = listMessagesForMetaCriteria({ unreadOnly: true }, null)
    expect(hits.map((m) => m.subject)).toEqual(['Inbox Mail'])
  })

  it('respektiert scopeFolderIds', () => {
    const inbox = insertTestFolder(testDbRef.current!, {
      accountId,
      remoteId: 'inbox',
      name: 'Inbox',
      wellKnown: 'inbox'
    })
    const custom = insertTestFolder(testDbRef.current!, {
      accountId,
      remoteId: 'custom',
      name: 'Custom'
    })
    insertTestMessage(testDbRef.current!, {
      accountId,
      folderId: inbox.id,
      remoteId: 'inbox-mail',
      subject: 'Inbox'
    })
    insertTestMessage(testDbRef.current!, {
      accountId,
      folderId: custom.id,
      remoteId: 'custom-mail',
      subject: 'Custom'
    })

    const hits = listMessagesForMetaCriteria(
      { scopeFolderIds: [custom.id], unreadOnly: true },
      null
    )
    expect(hits).toHaveLength(1)
    expect(hits[0]!.subject).toBe('Custom')
  })

  it('respektiert limit', () => {
    const inbox = insertTestFolder(testDbRef.current!, {
      accountId,
      remoteId: 'inbox',
      name: 'Inbox',
      wellKnown: 'inbox'
    })
    for (let i = 0; i < 5; i++) {
      insertTestMessage(testDbRef.current!, {
        accountId,
        folderId: inbox.id,
        remoteId: `m${i}`,
        subject: `Mail ${i}`,
        isRead: false,
        receivedAt: `2026-01-${String(10 + i).padStart(2, '0')}T10:00:00.000Z`
      })
    }

    const hits = listMessagesForMetaCriteria({ unreadOnly: true }, 2)
    expect(hits).toHaveLength(2)
  })

  it('liefert leeres Array ohne aktiven Filter', () => {
    expect(listMessagesForMetaCriteria({}, null)).toEqual([])
  })

  it('filtert flaggedOnly und hasAttachmentsOnly', () => {
    const db = testDbRef.current!
    const inbox = insertTestFolder(db, {
      accountId,
      remoteId: 'inbox',
      name: 'Inbox',
      wellKnown: 'inbox'
    })
    insertTestMessage(db, {
      accountId,
      folderId: inbox.id,
      remoteId: 'flagged',
      subject: 'Markiert',
      isFlagged: true
    })
    insertTestMessage(db, {
      accountId,
      folderId: inbox.id,
      remoteId: 'plain',
      subject: 'Normal'
    })
    insertTestMessage(db, {
      accountId,
      folderId: inbox.id,
      remoteId: 'att',
      subject: 'Anhang',
      hasAttachments: true
    })

    const flagged = listMessagesForMetaCriteria({ flaggedOnly: true }, null)
    expect(flagged.map((m) => m.subject)).toEqual(['Markiert'])

    const withAtt = listMessagesForMetaCriteria({ hasAttachmentsOnly: true }, null)
    expect(withAtt.map((m) => m.subject)).toEqual(['Anhang'])
  })

  it('filtert fromContains', () => {
    const db = testDbRef.current!
    const inbox = insertTestFolder(db, {
      accountId,
      remoteId: 'inbox',
      name: 'Inbox',
      wellKnown: 'inbox'
    })
    insertTestMessage(db, {
      accountId,
      folderId: inbox.id,
      remoteId: 'vendor',
      subject: 'Rechnung',
      fromAddr: 'billing@vendor.com'
    })
    insertTestMessage(db, {
      accountId,
      folderId: inbox.id,
      remoteId: 'other',
      subject: 'News',
      fromAddr: 'news@example.com'
    })

    const hits = listMessagesForMetaCriteria({ fromContains: 'vendor' }, null)
    expect(hits).toHaveLength(1)
    expect(hits[0]!.subject).toBe('Rechnung')
  })

  it('wendet Ausnahmen an (NOT)', () => {
    const db = testDbRef.current!
    const inbox = insertTestFolder(db, {
      accountId,
      remoteId: 'inbox',
      name: 'Inbox',
      wellKnown: 'inbox'
    })
    insertTestMessage(db, {
      accountId,
      folderId: inbox.id,
      remoteId: 'keep',
      subject: 'Behalten',
      fromAddr: 'team@firma.de',
      isRead: false
    })
    insertTestMessage(db, {
      accountId,
      folderId: inbox.id,
      remoteId: 'skip',
      subject: 'Newsletter',
      fromAddr: 'newsletter@firma.de',
      isRead: false
    })

    const hits = listMessagesForMetaCriteria(
      {
        unreadOnly: true,
        exceptions: [{ fromContains: 'newsletter' }]
      },
      null
    )
    expect(hits.map((m) => m.subject)).toEqual(['Behalten'])
  })

  it('filtert categoriesAny ueber message_tags', () => {
    const db = testDbRef.current!
    const inbox = insertTestFolder(db, {
      accountId,
      remoteId: 'inbox',
      name: 'Inbox',
      wellKnown: 'inbox'
    })
    const tagged = insertTestMessage(db, {
      accountId,
      folderId: inbox.id,
      remoteId: 'cat',
      subject: 'Kategorie'
    })
    insertTestMessage(db, {
      accountId,
      folderId: inbox.id,
      remoteId: 'plain',
      subject: 'Ohne'
    })
    db.prepare(
      'INSERT INTO message_tags (message_id, account_id, tag) VALUES (?, ?, ?)'
    ).run(tagged.id, accountId, 'VIP')

    const hits = listMessagesForMetaCriteria({ categoriesAny: ['VIP'] }, null)
    expect(hits).toHaveLength(1)
    expect(hits[0]!.subject).toBe('Kategorie')
  })
})
