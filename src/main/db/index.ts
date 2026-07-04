import { app } from 'electron'
import Database, { type Database as DbType } from 'better-sqlite3'
import { mkdirSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { MIGRATIONS } from './schema'
import { scheduleMessageParticipantsBackfillIfNeeded } from './message-participants-repo'
import { migrateLegacyLinksToEntityLinks } from './entity-links-migrate'
import { purgeOrphanedEntityLinks } from './entity-links-repo'
import { backfillNoteBodyFtsTextIfNeeded } from './user-notes-repo'

let dbInstance: DbType | null = null

export function getDbPath(): string {
  const userDataDir = app.getPath('userData')
  return join(userDataDir, 'data', 'mail.db')
}

function isSqliteIoError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const code = (err as { code?: string }).code
  if (code === 'SQLITE_IOERR') return true
  const message = (err as { message?: string }).message ?? ''
  return /disk I\/O error/i.test(message) || /SQLITE_IOERR/i.test(message)
}

function removeWalSidecarFiles(dbPath: string): void {
  for (const suffix of ['-wal', '-shm', '-journal']) {
    try {
      unlinkSync(`${dbPath}${suffix}`)
    } catch {
      // fehlt oder gesperrt
    }
  }
}

function configureJournalMode(db: DbType, dbPath: string): void {
  try {
    db.pragma('journal_mode = WAL')
    db.pragma('synchronous = NORMAL')
    return
  } catch (walErr) {
    if (!isSqliteIoError(walErr)) throw walErr
    console.warn('[db] WAL-Modus fehlgeschlagen, versuche Wiederherstellung:', walErr)
  }

  removeWalSidecarFiles(dbPath)

  try {
    db.pragma('journal_mode = WAL')
    db.pragma('synchronous = NORMAL')
    console.log('[db] WAL-Modus nach Bereinigung wiederhergestellt')
    return
  } catch {
    // weiter mit DELETE
  }

  try {
    db.pragma('journal_mode = DELETE')
    db.pragma('synchronous = FULL')
    console.warn('[db] Nutze journal_mode=DELETE (WAL nicht verfügbar)')
  } catch (deleteErr) {
    throw new Error(
      `SQLite-Journal konnte nicht initialisiert werden (${dbPath}): ${
        deleteErr instanceof Error ? deleteErr.message : String(deleteErr)
      }`
    )
  }
}

function openDatabase(dbPath: string): DbType {
  mkdirSync(join(dbPath, '..'), { recursive: true })
  const db = new Database(dbPath)
  try {
    db.pragma('busy_timeout = 5000')
    configureJournalMode(db, dbPath)
    db.pragma('foreign_keys = ON')
    return db
  } catch (e) {
    try {
      db.close()
    } catch {
      // ignore
    }
    removeWalSidecarFiles(dbPath)
    throw e
  }
}

export function getDb(): DbType {
  if (dbInstance) return dbInstance

  const dbPath = getDbPath()
  let db: DbType
  try {
    db = openDatabase(dbPath)
  } catch (firstErr) {
    if (!isSqliteIoError(firstErr)) throw firstErr
    console.warn('[db] Erster Öffnungsversuch fehlgeschlagen, zweiter Versuch:', firstErr)
    removeWalSidecarFiles(dbPath)
    db = openDatabase(dbPath)
  }

  dbInstance = db
  try {
    runMigrations(db)
    backfillNoteBodyFtsTextIfNeeded()
    migrateLegacyLinksToEntityLinks(db)
    purgeOrphanedEntityLinks()
    scheduleMessageParticipantsBackfillIfNeeded()
  } catch (e) {
    dbInstance = null
    try {
      db.close()
    } catch {
      // ignore
    }
    throw e
  }

  return db
}

function runMigrations(db: DbType): void {
  const current = (db.pragma('user_version', { simple: true }) as number) ?? 0
  const sorted = [...MIGRATIONS].sort((a, b) => a.version - b.version)
  const todo = sorted.filter((m) => m.version > current)
  if (todo.length === 0) return

  console.log(`[db] migrating from version ${current} to ${sorted[sorted.length - 1]!.version}`)
  const tx = db.transaction(() => {
    for (const migration of todo) {
      console.log(`[db]   applying v${migration.version}: ${migration.description}`)
      db.exec(migration.sql)
      db.pragma(`user_version = ${migration.version}`)
    }
  })
  tx()
}

export function closeDb(): void {
  if (dbInstance) {
    dbInstance.close()
    dbInstance = null
  }
}
