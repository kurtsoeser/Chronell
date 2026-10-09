import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type Database from 'better-sqlite3'
import { createInMemoryTestDb, isInMemorySqliteAvailable } from '../../test-fixtures/db'
import {
  insertTestAttachment,
  insertTestFolder,
  insertTestMessage,
  insertTestMessageParticipant,
  insertTestMessageTag
} from '../../test-fixtures/db-mail-seed'

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
  searchMessagesAdvanced,
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

  it('searchMessages findet Mails per FTS ueber Empfaenger-Anzeigename', () => {
    const db = testDbRef.current!
    const sent = insertTestFolder(db, {
      accountId: ACCOUNT,
      remoteId: 'sent',
      name: 'Sent',
      wellKnown: 'sentitems'
    })
    const target = insertTestMessage(db, {
      accountId: ACCOUNT,
      folderId: sent.id,
      remoteId: 'm-to-monika',
      subject: 'Kurze Notiz',
      bodyText: 'ohne Namen im Text',
      toAddrs: 'Monika Beispiel <monika.beispiel@example.com>'
    })
    insertTestMessage(db, {
      accountId: ACCOUNT,
      folderId: sent.id,
      remoteId: 'm-other',
      subject: 'Andere Mail',
      bodyText: 'neutral',
      toAddrs: 'peter@example.com'
    })

    const hits = searchMessages('Monika')
    expect(hits.some((h) => h.id === target.id)).toBe(true)
  })

  it('searchMessages findet Mails per Anhang-Dateiname', () => {
    const db = testDbRef.current!
    const inbox = insertTestFolder(db, {
      accountId: ACCOUNT,
      remoteId: 'inbox',
      name: 'Inbox',
      wellKnown: 'inbox'
    })
    const target = insertTestMessage(db, {
      accountId: ACCOUNT,
      folderId: inbox.id,
      remoteId: 'm-att',
      subject: 'Ohne Treffer im Text',
      bodyText: 'neutral'
    })
    insertTestAttachment(db, { messageId: target.id, name: 'Vertrag_Monika_2024.pdf' })

    const hits = searchMessages('Vertrag Monika')
    expect(hits.some((h) => h.id === target.id)).toBe(true)
  })

  it('searchMessages findet Mails per Teilnehmer-E-Mail', () => {
    const db = testDbRef.current!
    const inbox = insertTestFolder(db, {
      accountId: ACCOUNT,
      remoteId: 'inbox2',
      name: 'Inbox',
      wellKnown: 'inbox'
    })
    const target = insertTestMessage(db, {
      accountId: ACCOUNT,
      folderId: inbox.id,
      remoteId: 'm-participant',
      subject: 'Kurz',
      bodyText: 'x',
      toAddrs: null
    })
    insertTestMessageParticipant(db, {
      messageId: target.id,
      accountId: ACCOUNT,
      email: 'monika.schmidt@firma.example'
    })

    const hits = searchMessages('monika.schmidt')
    expect(hits.some((h) => h.id === target.id)).toBe(true)
  })

  it('searchMessagesAdvanced filtert Kategorie und Gesendet-Datum', () => {
    const db = testDbRef.current!
    const sent = insertTestFolder(db, {
      accountId: ACCOUNT,
      remoteId: 'sent2',
      name: 'Sent',
      wellKnown: 'sentitems'
    })
    const target = insertTestMessage(db, {
      accountId: ACCOUNT,
      folderId: sent.id,
      remoteId: 'm-cat',
      subject: 'Mit Kategorie',
      bodyText: 'body',
      receivedAt: '2026-01-01T10:00:00.000Z'
    })
    db.prepare('UPDATE messages SET sent_at = ? WHERE id = ?').run(
      '2026-03-15T14:00:00.000Z',
      target.id
    )
    insertTestMessageTag(db, { messageId: target.id, accountId: ACCOUNT, tag: 'Wichtig' })

    const hits = searchMessagesAdvanced({
      categoryContains: 'Wicht',
      dateKind: 'sent',
      dateFrom: '2026-03-15',
      dateTo: '2026-03-15'
    })
    expect(hits).toHaveLength(1)
    expect(hits[0]!.id).toBe(target.id)
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
