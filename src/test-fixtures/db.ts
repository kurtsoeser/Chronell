import Database from 'better-sqlite3'
import { MIGRATIONS } from '../main/db/schema'

let sqliteNativeProbe: boolean | null = null

/** Prueft, ob better-sqlite3 fuer die aktuelle Node-Version geladen werden kann. */
export function isInMemorySqliteAvailable(): boolean {
  if (sqliteNativeProbe !== null) return sqliteNativeProbe
  try {
    const db = new Database(':memory:')
    db.close()
    sqliteNativeProbe = true
  } catch {
    sqliteNativeProbe = false
  }
  return sqliteNativeProbe
}

/** In-Memory-SQLite mit vollem Schema — fuer Repo-Integrationstests. */
export function createInMemoryTestDb(): Database.Database {
  if (!isInMemorySqliteAvailable()) {
    throw new Error(
      'better-sqlite3 ist fuer diese Node-Version nicht verfuegbar (lokal: npm rebuild better-sqlite3; nach Electron-Start ggf. npx electron-rebuild -f -w better-sqlite3)'
    )
  }
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  const sorted = [...MIGRATIONS].sort((a, b) => a.version - b.version)
  const migrate = db.transaction(() => {
    for (const migration of sorted) {
      db.exec(migration.sql)
      db.pragma(`user_version = ${migration.version}`)
    }
  })
  migrate()
  return db
}

export function getLatestSchemaVersion(): number {
  return Math.max(...MIGRATIONS.map((m) => m.version))
}
