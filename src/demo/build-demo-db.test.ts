import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import Database from 'better-sqlite3'
import { describe, expect, it } from 'vitest'
import { applyMigrations, buildDemoDatabase } from './build-demo-db'
import { isDemoAccount } from '../main/demo/demo-accounts'
import { buildDemoAccounts } from './seed-accounts'
import { isInMemorySqliteAvailable } from '../test-fixtures/db'

const sqliteOk = isInMemorySqliteAvailable()

describe.skipIf(!sqliteOk)('build-demo-db', () => {
  it(
    'erzeugt Schema v49 mit Demo-Daten',
    { timeout: 60_000 },
    () => {
    const dir = mkdtempSync(join(tmpdir(), 'chronell-demo-db-'))
    const dbPath = join(dir, 'mail.db')
    try {
      buildDemoDatabase(dbPath)
      const db = new Database(dbPath, { readonly: true })
      try {
        const version = db.pragma('user_version', { simple: true }) as number
        expect(version).toBeGreaterThanOrEqual(49)

        const folderCount = (
          db.prepare('SELECT COUNT(*) AS c FROM folders').get() as { c: number }
        ).c
        expect(folderCount).toBeGreaterThanOrEqual(3)

        const messageCount = (
          db.prepare('SELECT COUNT(*) AS c FROM messages').get() as { c: number }
        ).c
        expect(messageCount).toBeGreaterThanOrEqual(12)

        const linkCount = (
          db.prepare('SELECT COUNT(*) AS c FROM entity_links').get() as { c: number }
        ).c
        expect(linkCount).toBeGreaterThanOrEqual(10)

        const noteCount = (
          db.prepare('SELECT COUNT(*) AS c FROM user_notes').get() as { c: number }
        ).c
        expect(noteCount).toBeGreaterThanOrEqual(8)

        const eventCount = (
          db.prepare('SELECT COUNT(*) AS c FROM calendar_events').get() as { c: number }
        ).c
        expect(eventCount).toBeGreaterThanOrEqual(12)

        const taskCount = (
          db.prepare('SELECT COUNT(*) AS c FROM cloud_tasks').get() as { c: number }
        ).c
        expect(taskCount).toBeGreaterThanOrEqual(18)

        const mailTodoCount = (
          db.prepare('SELECT COUNT(*) AS c FROM todos').get() as { c: number }
        ).c
        expect(mailTodoCount).toBeGreaterThanOrEqual(8)

        for (const row of db.prepare('SELECT ref_a_key, ref_b_key FROM entity_links').all() as Array<{
          ref_a_key: string
          ref_b_key: string
        }>) {
          expect(row.ref_a_key < row.ref_b_key).toBe(true)
        }
      } finally {
        db.close()
      }
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  }
  )

  it('applyMigrations ist idempotent', () => {
    const dir = mkdtempSync(join(tmpdir(), 'chronell-demo-mig-'))
    const dbPath = join(dir, 'mail.db')
    try {
      const db = new Database(dbPath)
      try {
        applyMigrations(db)
        const v1 = db.pragma('user_version', { simple: true }) as number
        applyMigrations(db)
        const v2 = db.pragma('user_version', { simple: true }) as number
        expect(v2).toBe(v1)
      } finally {
        db.close()
      }
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe('demo accounts', () => {
  it('markiert Demo-Konten als schreibgeschützt', () => {
    for (const acc of buildDemoAccounts()) {
      expect(isDemoAccount(acc)).toBe(true)
      expect(acc.provider).toBe('demo')
    }
  })
})
