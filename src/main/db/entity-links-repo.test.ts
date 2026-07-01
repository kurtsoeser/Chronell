import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type Database from 'better-sqlite3'
import { createInMemoryTestDb, isInMemorySqliteAvailable } from '../../test-fixtures/db'
import { insertTestFolder, insertTestMessage, insertTestNote } from '../../test-fixtures/db-mail-seed'

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
  addEntityLink,
  deleteAllEntityLinksForRef,
  entityLinkExists,
  findEntityLinkId,
  listAllEntityLinkRows,
  mailEntityRef,
  noteEntityRef,
  purgeOrphanedEntityLinks,
  removeEntityLink
} from './entity-links-repo'

const ACCOUNT = 'acc-links'

describe.skipIf(!isInMemorySqliteAvailable())('entity-links-repo', () => {
  beforeEach(() => {
    testDbRef.current = createInMemoryTestDb()
  })

  afterEach(() => {
    testDbRef.current?.close()
    testDbRef.current = null
  })

  function seedMailAndNote(): { mailId: number; noteId: number } {
    const db = testDbRef.current!
    const inbox = insertTestFolder(db, {
      accountId: ACCOUNT,
      remoteId: 'inbox',
      name: 'Inbox'
    })
    const mail = insertTestMessage(db, {
      accountId: ACCOUNT,
      folderId: inbox.id,
      remoteId: 'm-1',
      subject: 'Verknuepft'
    })
    const noteId = insertTestNote(db, { title: 'Notiz' })
    return { mailId: mail.id, noteId }
  }

  it('addEntityLink verknuepft Mail und Notiz idempotent', () => {
    const { mailId, noteId } = seedMailAndNote()
    const mailRef = mailEntityRef(mailId)
    const noteRef = noteEntityRef(noteId)

    const id1 = addEntityLink(mailRef, noteRef, 'related')
    const id2 = addEntityLink(noteRef, mailRef, 'related')

    expect(id1).toBeGreaterThan(0)
    expect(id2).toBe(id1)
    expect(entityLinkExists(mailRef, noteRef)).toBe(true)
    expect(findEntityLinkId(noteRef, mailRef)).toBe(id1)
    expect(listAllEntityLinkRows()).toHaveLength(1)
  })

  it('addEntityLink lehnt Selbstverknuepfung ab', () => {
    const { mailId } = seedMailAndNote()
    const ref = mailEntityRef(mailId)
    expect(() => addEntityLink(ref, ref)).toThrow(/selbst/)
  })

  it('removeEntityLink loescht die Verbindung', () => {
    const { mailId, noteId } = seedMailAndNote()
    const mailRef = mailEntityRef(mailId)
    const noteRef = noteEntityRef(noteId)
    const linkId = addEntityLink(mailRef, noteRef)

    removeEntityLink(linkId)

    expect(entityLinkExists(mailRef, noteRef)).toBe(false)
    expect(listAllEntityLinkRows()).toHaveLength(0)
  })

  it('deleteAllEntityLinksForRef entfernt alle Kanten eines Endpunkts', () => {
    const db = testDbRef.current!
    const { mailId, noteId } = seedMailAndNote()
    const mailRef = mailEntityRef(mailId)
    const noteRef = noteEntityRef(noteId)
    const note2 = insertTestNote(db, { title: 'Zweite Notiz' })
    addEntityLink(mailRef, noteRef)
    addEntityLink(mailRef, noteEntityRef(note2))

    deleteAllEntityLinksForRef(mailRef)

    expect(listAllEntityLinkRows()).toHaveLength(0)
  })

  it('purgeOrphanedEntityLinks entfernt Verknuepfungen mit geloeschter Mail', () => {
    const db = testDbRef.current!
    const { mailId, noteId } = seedMailAndNote()
    addEntityLink(mailEntityRef(mailId), noteEntityRef(noteId))
    expect(listAllEntityLinkRows()).toHaveLength(1)

    db.prepare('DELETE FROM messages WHERE id = ?').run(mailId)

    const removed = purgeOrphanedEntityLinks()
    expect(removed).toBe(1)
    expect(listAllEntityLinkRows()).toHaveLength(0)
  })
})
