import Database from 'better-sqlite3'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { MIGRATIONS } from '../main/db/schema'
import { buildDemoAccounts } from './seed-accounts'
import {
  seedDemoCalendar,
  seedDemoConfig,
  seedDemoEntityLinks,
  seedDemoMail,
  seedDemoNotes,
  seedDemoPackManifest,
  seedDemoPeople,
  seedDemoTasks
} from './seed-content'
import { DEMO_PROFILE_MARKER_FILE } from '@shared/demo'
import { LOCAL_DATA_ARCHIVE_FORMAT_VERSION } from '@shared/types/local-data'
import { APP_PRODUCT_NAME } from '@shared/app-version'

export function applyMigrations(db: Database.Database): void {
  const current = (db.pragma('user_version', { simple: true }) as number) ?? 0
  const sorted = [...MIGRATIONS].sort((a, b) => a.version - b.version)
  const todo = sorted.filter((m) => m.version > current)
  const tx = db.transaction(() => {
    for (const migration of todo) {
      db.exec(migration.sql)
      db.pragma(`user_version = ${migration.version}`)
    }
  })
  tx()
}

export function buildDemoDatabase(dbPath: string): void {
  mkdirSync(join(dbPath, '..'), { recursive: true })
  const db = new Database(dbPath)
  try {
    db.pragma('foreign_keys = ON')
    applyMigrations(db)
    const mail = seedDemoMail(db)
    const calendar = seedDemoCalendar(db)
    seedDemoTasks(db)
    const contactIds = seedDemoPeople(db)
    const notes = seedDemoNotes(db, mail.messageIds)
    seedDemoEntityLinks(db, {
      messageIds: mail.messageIds,
      noteIds: notes.noteIds,
      contactIds,
      todoIds: mail.todoIds,
      calendarEventIds: calendar.eventIds
    })
  } finally {
    db.close()
  }
}

export interface BuildDemoPackOptions {
  outDir: string
}

export function buildDemoPackTree(outDir: string): void {
  mkdirSync(join(outDir, 'data'), { recursive: true })
  mkdirSync(join(outDir, 'secure'), { recursive: true })

  buildDemoDatabase(join(outDir, 'data', 'mail.db'))

  writeFileSync(
    join(outDir, 'secure', 'accounts.json'),
    JSON.stringify(buildDemoAccounts(), null, 2),
    'utf8'
  )
  writeFileSync(join(outDir, 'config.json'), JSON.stringify(seedDemoConfig(), null, 2), 'utf8')
  writeFileSync(join(outDir, DEMO_PROFILE_MARKER_FILE), 'demo-profile\n', 'utf8')
  writeFileSync(
    join(outDir, 'demo-pack-manifest.json'),
    JSON.stringify(seedDemoPackManifest(), null, 2),
    'utf8'
  )
  writeFileSync(
    join(outDir, '.mailclient-archive-manifest.json'),
    JSON.stringify(
      {
        formatVersion: LOCAL_DATA_ARCHIVE_FORMAT_VERSION,
        exportedAt: new Date().toISOString(),
        appVersion: '1.0.0',
        mode: 'portable',
        productName: APP_PRODUCT_NAME,
        demo: true
      },
      null,
      2
    ),
    'utf8'
  )
}
