import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type Database from 'better-sqlite3'
import { createInMemoryTestDb, isInMemorySqliteAvailable } from '../../test-fixtures/db'

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
  createMetaFolder,
  deleteMetaFolder,
  getMetaFolder,
  listMetaFolders,
  reorderMetaFolders,
  updateMetaFolder,
  validateMetaFolderInput
} from './meta-folders-repo'

describe.skipIf(!isInMemorySqliteAvailable())('meta-folders-repo', () => {
  beforeEach(() => {
    testDbRef.current = createInMemoryTestDb()
  })

  afterEach(() => {
    testDbRef.current?.close()
    testDbRef.current = null
  })

  it('validateMetaFolderInput prueft Name und Filter', () => {
    expect(validateMetaFolderInput('', { unreadOnly: true })).toMatch(/Name/)
    expect(validateMetaFolderInput('OK', {})).toMatch(/Filter/)
    expect(validateMetaFolderInput('OK', { unreadOnly: true })).toBeNull()
    expect(
      validateMetaFolderInput('OK', {
        unreadOnly: true,
        exceptions: [{ textQuery: '  ' }]
      })
    ).toMatch(/Ausnahmen/)
  })

  it('createMetaFolder und listMetaFolders Roundtrip', () => {
    const created = createMetaFolder({
      name: 'Wichtig',
      criteria: { unreadOnly: true }
    })
    expect(created.id).toBeGreaterThan(0)
    expect(created.name).toBe('Wichtig')
    expect(created.criteria.unreadOnly).toBe(true)

    const all = listMetaFolders()
    expect(all).toHaveLength(1)
    expect(all[0]!.id).toBe(created.id)
  })

  it('updateMetaFolder aendert Name und Criteria', () => {
    const created = createMetaFolder({
      name: 'Alt',
      criteria: { unreadOnly: true }
    })
    const updated = updateMetaFolder({
      id: created.id,
      name: 'Neu',
      criteria: { flaggedOnly: true }
    })
    expect(updated.name).toBe('Neu')
    expect(updated.criteria.flaggedOnly).toBe(true)
    expect(getMetaFolder(created.id)?.name).toBe('Neu')
  })

  it('reorderMetaFolders setzt sort_order', () => {
    const a = createMetaFolder({ name: 'A', criteria: { unreadOnly: true } })
    const b = createMetaFolder({ name: 'B', criteria: { flaggedOnly: true } })
    reorderMetaFolders([b.id, a.id])

    const ordered = listMetaFolders()
    expect(ordered.map((f) => f.name)).toEqual(['B', 'A'])
  })

  it('deleteMetaFolder entfernt Eintrag', () => {
    const created = createMetaFolder({
      name: 'Weg',
      criteria: { unreadOnly: true }
    })
    deleteMetaFolder(created.id)
    expect(getMetaFolder(created.id)).toBeNull()
    expect(listMetaFolders()).toHaveLength(0)
  })
})
