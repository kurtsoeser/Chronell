import { mkdir, readdir, writeFile, unlink, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { loadConfig, updateConfig } from './config'
import { buildSettingsBackupPayload } from './settings-backup-service'
import { getCachedProfileUiPrefs } from './sync-profile/profile-sync-ui-prefs-cache'

const AUTO_BACKUP_DEBOUNCE_MS = 120_000
const DATED_BACKUP_RETENTION = 5
const LATEST_FILENAME = 'mailclient-einstellungen-latest.json'
const DATED_PREFIX = 'mailclient-einstellungen-'

let debounceTimer: ReturnType<typeof setTimeout> | null = null
let backupInFlight = false

/** Nach Regeln, Workflow, VIP oder Profil-Änderungen. */
export function notifySettingsBackupDataChanged(): void {
  scheduleAutoSettingsBackup()
}

export function scheduleAutoSettingsBackup(): void {
  if (debounceTimer != null) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    debounceTimer = null
    void runAutoSettingsBackup()
  }, AUTO_BACKUP_DEBOUNCE_MS)
}

export async function runAutoSettingsBackup(
  localStorageOverride?: Record<string, string>
): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  if (backupInFlight) {
    return { ok: false, error: 'Auto-Backup läuft bereits.' }
  }
  const config = await loadConfig()
  if (!config.settingsAutoBackupEnabled) {
    return { ok: false, error: 'Auto-Backup ist deaktiviert.' }
  }
  const dir = config.settingsAutoBackupDirectory?.trim()
  if (!dir) {
    return { ok: false, error: 'Kein Zielordner für Auto-Backup gewählt.' }
  }

  backupInFlight = true
  try {
    await mkdir(dir, { recursive: true })
    const cached = getCachedProfileUiPrefs()
    const localStorage =
      localStorageOverride && Object.keys(localStorageOverride).length > 0
        ? localStorageOverride
        : cached
    const payload = await buildSettingsBackupPayload(localStorage)
    const json = JSON.stringify(payload, null, 2)
    const latestPath = join(dir, LATEST_FILENAME)
    await writeFile(latestPath, json, 'utf8')

    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const datedPath = join(dir, `${DATED_PREFIX}${stamp}.json`)
    await writeFile(datedPath, json, 'utf8')
    await pruneDatedBackups(dir)

    await updateConfig({
      settingsAutoBackupLastAt: new Date().toISOString(),
      settingsAutoBackupLastPath: latestPath,
      settingsAutoBackupLastError: null
    })
    return { ok: true, path: latestPath }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    await updateConfig({ settingsAutoBackupLastError: message })
    return { ok: false, error: message }
  } finally {
    backupInFlight = false
  }
}

async function pruneDatedBackups(dir: string): Promise<void> {
  let entries: string[]
  try {
    entries = await readdir(dir)
  } catch {
    return
  }
  const dated = entries.filter(
    (name) => name.startsWith(DATED_PREFIX) && name.endsWith('.json') && name !== LATEST_FILENAME
  )
  if (dated.length <= DATED_BACKUP_RETENTION) return

  const withMtime: Array<{ name: string; mtime: number }> = []
  for (const name of dated) {
    try {
      const st = await stat(join(dir, name))
      withMtime.push({ name, mtime: st.mtimeMs })
    } catch {
      /* skip */
    }
  }
  withMtime.sort((a, b) => b.mtime - a.mtime)
  for (const old of withMtime.slice(DATED_BACKUP_RETENTION)) {
    try {
      await unlink(join(dir, old.name))
    } catch {
      /* skip */
    }
  }
}
