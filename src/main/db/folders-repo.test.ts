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
  adjustFolderUnread,
  deleteFolderLocal,
  findFolderById,
  findFolderByRemoteId,
  findFolderByWellKnown,
  insertFolderLocal,
  isProtectedFolder,
  listFavoriteFolderIdsForAccount,
  listFoldersByAccount,
  reconcileAllFolderUnreadForAccount,
  setFolderFavoriteLocal,
  setFolderWellKnownLocal,
  upsertFolders
} from './folders-repo'

const ACCOUNT = 'acc-test'

function folderInput(
  remoteId: string,
  name: string,
  wellKnown: string | null = null
) {
  return {
    accountId: ACCOUNT,
    remoteId,
    name,
    parentRemoteId: null as string | null,
    wellKnown,
    unreadCount: 0,
    totalCount: 0
  }
}

describe.skipIf(!isInMemorySqliteAvailable())('folders-repo', () => {
  beforeEach(() => {
    testDbRef.current = createInMemoryTestDb()
  })

  afterEach(() => {
    testDbRef.current?.close()
    testDbRef.current = null
  })

  it('upsertFolders behaelt lokales well_known wenn Graph NULL liefert', () => {
    upsertFolders([folderInput('fld-snooze', 'Snoozed', null)])
    const created = findFolderByRemoteId(ACCOUNT, 'fld-snooze')
    expect(created).not.toBeNull()
    setFolderWellKnownLocal(created!.id, 'snoozed')

    upsertFolders([
      {
        ...folderInput('fld-snooze', 'Snoozed (Server)', null),
        unreadCount: 3,
        totalCount: 10
      }
    ])

    const after = findFolderByRemoteId(ACCOUNT, 'fld-snooze')
    expect(after?.wellKnown).toBe('snoozed')
    expect(after?.name).toBe('Snoozed (Server)')
    expect(after?.unreadCount).toBe(3)
    expect(after?.totalCount).toBe(10)
  })

  it('upsertFolders ueberschreibt well_known wenn Graph einen Wert liefert', () => {
    upsertFolders([folderInput('fld-inbox', 'Posteingang', 'inbox')])
    upsertFolders([folderInput('fld-inbox', 'Inbox', 'drafts')])

    const row = findFolderByWellKnown(ACCOUNT, 'drafts')
    expect(row?.remoteId).toBe('fld-inbox')
    expect(row?.name).toBe('Inbox')
  })

  it('listFoldersByAccount sortiert well_known vor benutzerdefinierten Ordnern', () => {
    upsertFolders([
      folderInput('fld-z', 'Zebra Custom'),
      folderInput('fld-inbox', 'Posteingang', 'inbox'),
      folderInput('fld-a', 'Alpha Custom'),
      folderInput('fld-drafts', 'Entwuerfe', 'drafts')
    ])

    const names = listFoldersByAccount(ACCOUNT).map((f) => f.name)
    expect(names).toEqual(['Posteingang', 'Entwuerfe', 'Alpha Custom', 'Zebra Custom'])
  })

  it('listFoldersByAccount trennt Konten', () => {
    upsertFolders([folderInput('fld-1', 'Konto A', 'inbox')])
    upsertFolders([
      {
        ...folderInput('fld-2', 'Konto B', 'inbox'),
        accountId: 'acc-other'
      }
    ])

    expect(listFoldersByAccount(ACCOUNT)).toHaveLength(1)
    expect(listFoldersByAccount('acc-other')).toHaveLength(1)
  })

  it('reconcileAllFolderUnreadForAccount zaehlt ungelesene Nachrichten im Ordner', () => {
    const db = testDbRef.current!
    const folder = insertTestFolder(db, {
      accountId: ACCOUNT,
      remoteId: 'fld-inbox',
      name: 'Inbox',
      wellKnown: 'inbox'
    })
    db.prepare('UPDATE folders SET unread_count = 99 WHERE id = ?').run(folder.id)
    insertTestMessage(db, {
      accountId: ACCOUNT,
      folderId: folder.id,
      remoteId: 'msg-1',
      subject: 'A',
      isRead: false
    })
    insertTestMessage(db, {
      accountId: ACCOUNT,
      folderId: folder.id,
      remoteId: 'msg-2',
      subject: 'B',
      isRead: false
    })
    insertTestMessage(db, {
      accountId: ACCOUNT,
      folderId: folder.id,
      remoteId: 'msg-3',
      subject: 'C',
      isRead: true
    })

    reconcileAllFolderUnreadForAccount(ACCOUNT)

    expect(findFolderById(folder.id)?.unreadCount).toBe(2)
  })

  it('adjustFolderUnread clamped bei 0', () => {
    upsertFolders([folderInput('fld-x', 'Test')])
    const folder = findFolderByRemoteId(ACCOUNT, 'fld-x')!

    adjustFolderUnread(folder.id, 5)
    expect(findFolderById(folder.id)?.unreadCount).toBe(5)

    adjustFolderUnread(folder.id, -10)
    expect(findFolderById(folder.id)?.unreadCount).toBe(0)
  })

  it('deleteFolderLocal entfernt Ordner und zugehoerige Nachrichten', () => {
    const db = testDbRef.current!
    const folder = insertTestFolder(db, {
      accountId: ACCOUNT,
      remoteId: 'fld-del',
      name: 'Loeschen'
    })
    insertTestMessage(db, {
      accountId: ACCOUNT,
      folderId: folder.id,
      remoteId: 'msg-del',
      subject: 'X'
    })

    deleteFolderLocal(folder.id)

    expect(findFolderById(folder.id)).toBeNull()
    const msgCount = db
      .prepare('SELECT COUNT(*) AS c FROM messages WHERE folder_id = ?')
      .get(folder.id) as { c: number }
    expect(msgCount.c).toBe(0)
  })

  it('insertFolderLocal gibt id zurueck und upsertet bei Konflikt', () => {
    const id1 = insertFolderLocal(folderInput('fld-local', 'Lokal'))
    expect(id1).toBeGreaterThan(0)
    expect(findFolderById(id1)?.name).toBe('Lokal')

    const id2 = insertFolderLocal({
      ...folderInput('fld-local', 'Lokal umbenannt'),
      unreadCount: 1,
      totalCount: 2
    })
    expect(id2).toBe(id1)
    expect(findFolderById(id1)?.name).toBe('Lokal umbenannt')
  })

  it('setFolderFavoriteLocal und listFavoriteFolderIdsForAccount', () => {
    upsertFolders([
      folderInput('fld-fav-1', 'Fav 1'),
      folderInput('fld-fav-2', 'Fav 2'),
      folderInput('fld-plain', 'Plain')
    ])
    const f1 = findFolderByRemoteId(ACCOUNT, 'fld-fav-1')!
    const f2 = findFolderByRemoteId(ACCOUNT, 'fld-fav-2')!
    setFolderFavoriteLocal(f1.id, true)
    setFolderFavoriteLocal(f2.id, true)

    expect(listFavoriteFolderIdsForAccount(ACCOUNT)).toEqual([f1.id, f2.id])
  })
})

describe('isProtectedFolder', () => {
  it('schuetzt Standard- und MailClient-Aliase', () => {
    expect(isProtectedFolder({ wellKnown: 'inbox' } as import('@shared/types').MailFolder)).toBe(
      true
    )
    expect(
      isProtectedFolder({ wellKnown: 'mailclient_wip' } as import('@shared/types').MailFolder)
    ).toBe(true)
    expect(isProtectedFolder({ wellKnown: null } as import('@shared/types').MailFolder)).toBe(
      false
    )
    expect(
      isProtectedFolder({ wellKnown: 'custom-label' } as import('@shared/types').MailFolder)
    ).toBe(false)
  })
})
