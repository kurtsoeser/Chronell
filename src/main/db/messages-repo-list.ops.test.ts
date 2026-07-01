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

import {
  countMessagesForAccount,
  countMessagesInFolder,
  countUnreadMessagesInAllInboxes,
  findRecentSentMessageId,
  listInboxMessagesAllAccounts,
  listMessagesByAccount,
  listMessagesByCategoryTag,
  listMessagesByFolder
} from './messages-repo-list'

describe.skipIf(!isInMemorySqliteAvailable())('messages-repo-list ops', () => {
  const accountA = 'acc-a'
  const accountB = 'acc-b'

  beforeEach(() => {
    testDbRef.current = createInMemoryTestDb()
  })

  afterEach(() => {
    testDbRef.current?.close()
    testDbRef.current = null
  })

  function seedInbox(accountId: string, remoteSuffix: string) {
    return insertTestFolder(testDbRef.current!, {
      accountId,
      remoteId: `inbox-${remoteSuffix}`,
      name: 'Inbox',
      wellKnown: 'inbox'
    })
  }

  it('listMessagesByFolder sortiert nach received_at absteigend und respektiert limit', () => {
    const folder = seedInbox(accountA, '1')
    insertTestMessage(testDbRef.current!, {
      accountId: accountA,
      folderId: folder.id,
      remoteId: 'old',
      subject: 'Alt',
      receivedAt: '2026-01-10T10:00:00.000Z'
    })
    insertTestMessage(testDbRef.current!, {
      accountId: accountA,
      folderId: folder.id,
      remoteId: 'new',
      subject: 'Neu',
      receivedAt: '2026-01-20T10:00:00.000Z'
    })

    const hits = listMessagesByFolder(folder.id, 1)
    expect(hits).toHaveLength(1)
    expect(hits[0]!.subject).toBe('Neu')
  })

  it('listMessagesByAccount filtert nach Konto', () => {
    const inboxA = seedInbox(accountA, 'a')
    const inboxB = seedInbox(accountB, 'b')
    insertTestMessage(testDbRef.current!, {
      accountId: accountA,
      folderId: inboxA.id,
      remoteId: 'a-mail',
      subject: 'A'
    })
    insertTestMessage(testDbRef.current!, {
      accountId: accountB,
      folderId: inboxB.id,
      remoteId: 'b-mail',
      subject: 'B'
    })

    const hits = listMessagesByAccount(accountA)
    expect(hits).toHaveLength(1)
    expect(hits[0]!.subject).toBe('A')
  })

  it('countMessagesInFolder und countMessagesForAccount', () => {
    const inbox = seedInbox(accountA, 'cnt')
    insertTestMessage(testDbRef.current!, {
      accountId: accountA,
      folderId: inbox.id,
      remoteId: 'm1',
      subject: 'Eins'
    })
    insertTestMessage(testDbRef.current!, {
      accountId: accountA,
      folderId: inbox.id,
      remoteId: 'm2',
      subject: 'Zwei'
    })

    expect(countMessagesInFolder(inbox.id)).toBe(2)
    expect(countMessagesForAccount(accountA)).toBe(2)
    expect(countMessagesForAccount(accountB)).toBe(0)
  })

  it('listMessagesByCategoryTag filtert Tag und schliesst Junk aus', () => {
    const db = testDbRef.current!
    const inbox = seedInbox(accountA, 'cat')
    const junk = insertTestFolder(db, {
      accountId: accountA,
      remoteId: 'junk',
      name: 'Junk',
      wellKnown: 'junkemail'
    })
    const tagged = insertTestMessage(db, {
      accountId: accountA,
      folderId: inbox.id,
      remoteId: 'tagged',
      subject: 'Wichtig'
    })
    insertTestMessage(db, {
      accountId: accountA,
      folderId: junk.id,
      remoteId: 'junk-tagged',
      subject: 'Spam Wichtig'
    })
    db.prepare(
      'INSERT INTO message_tags (message_id, account_id, tag) VALUES (?, ?, ?)'
    ).run(tagged.id, accountA, 'Important')

    const hits = listMessagesByCategoryTag({
      accountId: accountA,
      category: 'Important',
      limit: null
    })
    expect(hits).toHaveLength(1)
    expect(hits[0]!.subject).toBe('Wichtig')
  })

  it('listInboxMessagesAllAccounts nur Posteingaenge und optional ohne Todo-Join', () => {
    const db = testDbRef.current!
    const inbox = seedInbox(accountA, 'unified')
    const drafts = insertTestFolder(db, {
      accountId: accountA,
      remoteId: 'drafts',
      name: 'Drafts',
      wellKnown: 'drafts'
    })
    const inboxMsg = insertTestMessage(db, {
      accountId: accountA,
      folderId: inbox.id,
      remoteId: 'inbox-1',
      subject: 'Inbox'
    })
    insertTestMessage(db, {
      accountId: accountA,
      folderId: drafts.id,
      remoteId: 'draft-1',
      subject: 'Draft'
    })
    db.prepare(
      `INSERT INTO todos (message_id, account_id, due_kind, status, created_at)
       VALUES (?, ?, 'today', 'open', datetime('now'))`
    ).run(inboxMsg.id, accountA)

    const withTodo = listInboxMessagesAllAccounts(10)
    expect(withTodo).toHaveLength(1)
    expect(withTodo[0]!.subject).toBe('Inbox')
    expect(withTodo[0]!.todoId).toBeGreaterThan(0)

    const withoutTodo = listInboxMessagesAllAccounts(10, { includeOpenTodo: false })
    expect(withoutTodo[0]!.todoId).toBeUndefined()
  })

  it('countUnreadMessagesInAllInboxes zaehlt nur ungelesene Inbox-Mails', () => {
    const db = testDbRef.current!
    const inbox = seedInbox(accountA, 'unread')
    insertTestMessage(db, {
      accountId: accountA,
      folderId: inbox.id,
      remoteId: 'u1',
      subject: 'Ungelesen',
      isRead: false
    })
    insertTestMessage(db, {
      accountId: accountA,
      folderId: inbox.id,
      remoteId: 'u2',
      subject: 'Gelesen',
      isRead: true
    })

    expect(countUnreadMessagesInAllInboxes()).toBe(1)
  })

  it('findRecentSentMessageId findet Betreff im Gesendet-Ordner', () => {
    const db = testDbRef.current!
    const sent = insertTestFolder(db, {
      accountId: accountA,
      remoteId: 'sent',
      name: 'Sent',
      wellKnown: 'sentitems'
    })
    const now = new Date().toISOString()
    db.prepare(
      `INSERT INTO messages (
         account_id, folder_id, remote_id, subject, sent_at, received_at,
         is_read, is_flagged, has_attachments
       ) VALUES (?, ?, ?, ?, ?, ?, 1, 0, 0)`
    ).run(accountA, sent.id, 'sent-1', 'Antwort an Team', now, now)

    const id = findRecentSentMessageId(accountA, 'Antwort an Team')
    expect(id).toBeGreaterThan(0)

    const missing = findRecentSentMessageId(accountA, 'Anderer Betreff')
    expect(missing).toBeGreaterThan(0)
  })
})
