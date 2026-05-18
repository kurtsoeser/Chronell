import { app } from 'electron'
import { cp, mkdir, readdir, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { APP_PRODUCT_NAME } from '@shared/app-version'

/** Früherer Electron-`userData`-Ordner (package.json `name`: mailclient). */
export const LEGACY_USER_DATA_DIR_NAME = 'mailclient' as const

export const MIGRATION_MARKER_FILE = '.chronell-migrated-from-mailclient.json' as const

/** Chromium-Caches — werden beim Kopieren übersprungen (werden neu aufgebaut). */
export const SKIP_TOP_LEVEL_DIRS = new Set([
  'Cache',
  'Code Cache',
  'GPUCache',
  'DawnCache',
  'ShaderCache',
  'GrShaderCache',
  'blob_storage',
  'Network',
  'Service Worker',
  'Shared Dictionary',
  'VideoDecodeStats',
  'Crashpad'
])

export function shouldSkipTopLevelEntry(name: string): boolean {
  return SKIP_TOP_LEVEL_DIRS.has(name)
}

export function hasMeaningfulUserData(dir: string, exists: (p: string) => boolean): boolean {
  if (exists(join(dir, 'config.json'))) return true
  if (exists(join(dir, 'data', 'mail.db'))) return true
  if (exists(join(dir, 'secure'))) return true
  return false
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await stat(p)
    return true
  } catch {
    return false
  }
}

async function isDirEmpty(dir: string): Promise<boolean> {
  const entries = await readdir(dir)
  return entries.length === 0
}

async function copyLegacyTree(legacyDir: string, targetDir: string): Promise<void> {
  await mkdir(targetDir, { recursive: true })
  const entries = await readdir(legacyDir, { withFileTypes: true })
  for (const ent of entries) {
    if (shouldSkipTopLevelEntry(ent.name)) continue
    if (ent.name === MIGRATION_MARKER_FILE) continue
    const src = join(legacyDir, ent.name)
    const dest = join(targetDir, ent.name)
    await cp(src, dest, {
      recursive: true,
      force: false,
      errorOnExist: false,
      filter: (srcPath) => {
        const rel = srcPath.slice(legacyDir.length + 1).replace(/\\/g, '/')
        const top = rel.split('/')[0]
        return top ? !shouldSkipTopLevelEntry(top) : true
      }
    })
  }
}

export type UserDataMigrationResult =
  | { status: 'skipped'; reason: string }
  | { status: 'migrated'; from: string; to: string }
  | { status: 'already_done' }

/**
 * Kopiert `%APPDATA%\mailclient` → `%APPDATA%\Chronell` einmalig, wenn die neue
 * Installation noch leer ist. Muss vor `getDb()` / `loadConfig()` laufen.
 */
export async function migrateLegacyUserDataIfNeeded(): Promise<UserDataMigrationResult> {
  const legacyDir = join(app.getPath('appData'), LEGACY_USER_DATA_DIR_NAME)
  const targetDir = app.getPath('userData')

  if (legacyDir.toLowerCase() === targetDir.toLowerCase()) {
    return { status: 'skipped', reason: 'legacy_equals_target' }
  }

  const markerPath = join(targetDir, MIGRATION_MARKER_FILE)
  if (await pathExists(markerPath)) {
    return { status: 'already_done' }
  }

  if (!(await pathExists(legacyDir))) {
    return { status: 'skipped', reason: 'no_legacy_dir' }
  }

  const legacyHasData =
    (await pathExists(join(legacyDir, 'config.json'))) ||
    (await pathExists(join(legacyDir, 'data', 'mail.db'))) ||
    (await pathExists(join(legacyDir, 'secure')))

  if (!legacyHasData) {
    return { status: 'skipped', reason: 'legacy_empty' }
  }

  const targetExists = await pathExists(targetDir)
  if (targetExists) {
    const targetHasData =
      (await pathExists(join(targetDir, 'config.json'))) ||
      (await pathExists(join(targetDir, 'data', 'mail.db')))
    if (targetHasData) {
      return { status: 'skipped', reason: 'target_already_has_data' }
    }
    if (!(await isDirEmpty(targetDir))) {
      return { status: 'skipped', reason: 'target_nonempty' }
    }
  } else {
    await mkdir(targetDir, { recursive: true })
  }

  console.log(`[migration] Kopiere Benutzerdaten: ${legacyDir} → ${targetDir}`)
  await copyLegacyTree(legacyDir, targetDir)

  const payload = {
    migratedAt: new Date().toISOString(),
    from: legacyDir,
    to: targetDir,
    product: APP_PRODUCT_NAME
  }
  await writeFile(markerPath, JSON.stringify(payload, null, 2), 'utf8')
  console.log('[migration] Abgeschlossen. Alter Ordner bleibt als Backup:', legacyDir)

  return { status: 'migrated', from: legacyDir, to: targetDir }
}

/** Frühestmöglicher Aufruf: Anzeigename + userData-Pfad (nicht package.json `mailclient`). */
export function configureChronellAppPaths(): void {
  app.setName(APP_PRODUCT_NAME)
  app.setPath('userData', join(app.getPath('appData'), APP_PRODUCT_NAME))
}
