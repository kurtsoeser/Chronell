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
  clearMessageSnooze,
  deleteMessageLocal,
  listDueSnoozes,
  listSnoozedMessages,
  searchMessages,
  setMessageSnooze
} from './messages-repo-ops'

const ACCOUNT = 'acc-ops'

describe.skipIf(!isInMemorySqliteAvailable())('messages-repo-ops', () => {
  beforeEach(() => {
    testDbRef.current = createInMemoryTestDb()
  })

  afterEach(() => {
    testDbRef.current?.close()
    testDbRef.current = null
  })

  it('searchMessages liefert leer bei leerer Query', () => {
    expect(searchMessages('')).toEqual([])
    expect(searchMessages('   ')).toEqual([])
  })

  it('searchMessages findet Mails per FTS ueber Betreff und Body', () => {
    const db = testDbRef.current!
    const inbox = insertTestFolder(db, {
      accountId: ACCOUNT,
      remoteId: 'inbox',
      name: 'Inbox',
      wellKnown: 'inbox'
    })
    insertTestMessage(db, {
      accountId: ACCOUNT,
      folderId: inbox.id,
      remoteId: 'm-alpha',
      subject: 'Alpha Bericht',
      bodyText: 'unrelated body'
    })
    const target = insertTestMessage(db, {
      accountId: ACCOUNT,
      folderId: inbox.id,
      remoteId: 'm-beta',
      subject: 'Sonstiges',
      bodyText: 'EinzigartigesSuchwort im Fliesstext'
    })
    insertTestMessage(db, {
      accountId: ACCOUNT,
      folderId: inbox.id,
      remoteId: 'm-gamma',
      subject: 'Gamma',
      bodyText: 'no match'
    })

    const hits = searchMessages('EinzigartigesSuchwort')
    expect(hits).toHaveLength(1)
    expect(hits[0]!.id).toBe(target.id)
    expect(hits[0]!.folderName).toBe('Inbox')
    expect(hits[0]!.folderWellKnown).toBe('inbox')
  })

  it('setMessageSnooze und clearMessageSnooze', () => {
    const db = testDbRef.current!
    const inbox = insertTestFolder(db, {
      accountId: ACCOUNT,
      remoteId: 'inbox',
      name: 'Inbox',
      wellKnown: 'inbox'
    })
    const snoozed = insertTestFolder(db, {
      accountId: ACCOUNT,
      remoteId: 'snoozed',
      name: 'Snoozed',
      wellKnown: 'snoozed'
    })
    const msg = insertTestMessage(db, {
      accountId: ACCOUNT,
      folderId: snoozed.id,
      remoteId: 'm-snooze',
      subject: 'Spaeter'
    })

    setMessageSnooze(msg.id, '2026-12-01T08:00:00.000Z', inbox.id)

    const row = db
      .prepare('SELECT snoozed_until, snoozed_from_folder_id FROM messages WHERE id = ?')
      .get(msg.id) as { snoozed_until: string; snoozed_from_folder_id: number }
    expect(row.snoozed_until).toBe('2026-12-01T08:00:00.000Z')
    expect(row.snoozed_from_folder_id).toBe(inbox.id)

    const listed = listSnoozedMessages()
    expect(listed.some((m) => m.id === msg.id)).toBe(true)
    expect(listed.find((m) => m.id === msg.id)?.snoozedFromFolderName).toBe('Inbox')

    clearMessageSnooze(msg.id)
    const cleared = db
      .prepare('SELECT snoozed_until, snoozed_from_folder_id FROM messages WHERE id = ?')
      .get(msg.id) as { snoozed_until: string | null; snoozed_from_folder_id: number | null }
    expect(cleared.snoozed_until).toBeNull()
    expect(cleared.snoozed_from_folder_id).toBeNull()
  })

  it('listDueSnoozes liefert faellige Snoozes', () => {
    const db = testDbRef.current!
    const inbox = insertTestFolder(db, {
      accountId: ACCOUNT,
      remoteId: 'inbox',
      name: 'Inbox',
      wellKnown: 'inbox'
    })
    const snoozed = insertTestFolder(db, {
      accountId: ACCOUNT,
      remoteId: 'snoozed',
      name: 'Snoozed',
      wellKnown: 'snoozed'
    })
    const due = insertTestMessage(db, {
      accountId: ACCOUNT,
      folderId: snoozed.id,
      remoteId: 'm-due',
      subject: 'Faellig'
    })
    const future = insertTestMessage(db, {
      accountId: ACCOUNT,
      folderId: snoozed.id,
      remoteId: 'm-future',
      subject: 'Spaeter'
    })

    db.prepare(
      `UPDATE messages
       SET snoozed_until = datetime('now', '-1 hour'),
           snoozed_from_folder_id = ?
       WHERE id = ?`
    ).run(inbox.id, due.id)
    db.prepare(
      `UPDATE messages
       SET snoozed_until = datetime('now', '+1 day'),
           snoozed_from_folder_id = ?
       WHERE id = ?`
    ).run(inbox.id, future.id)

    const dueRows = listDueSnoozes()
    expect(dueRows).toHaveLength(1)
    expect(dueRows[0]!.id).toBe(due.id)
    expect(dueRows[0]!.snoozedFromFolderId).toBe(inbox.id)
  })

  it('deleteMessageLocal entfernt die Mail', () => {
    const db = testDbRef.current!
    const inbox = insertTestFolder(db, {
      accountId: ACCOUNT,
      remoteId: 'inbox',
      name: 'Inbox'
    })
    const msg = insertTestMessage(db, {
      accountId: ACCOUNT,
      folderId: inbox.id,
      remoteId: 'm-del',
      subject: 'Weg'
    })

    deleteMessageLocal(msg.id)

    const count = db.prepare('SELECT COUNT(*) AS c FROM messages WHERE id = ?').get(msg.id) as {
      c: number
    }
    expect(count.c).toBe(0)
  })
})
