import { readFile, writeFile } from 'node:fs/promises'
import { ipcMain, dialog, BrowserWindow, type OpenDialogOptions, type SaveDialogOptions } from 'electron'
import {
  IPC,
  type SettingsAutoBackupRunResult,
  type SettingsAutoBackupStatus,
  type SettingsBackupDirectoryPickResult,
  type SettingsBackupExportResult,
  type SettingsBackupPickResult
} from '@shared/types'
import type { SettingsBackupPayload } from '@shared/types'
import { summarizeSettingsBackupPayload } from '@shared/settings-backup-summary'
import type { SettingsBackupContentsSummary } from '@shared/settings-backup-summary'
import { loadConfig, updateConfig } from '../config'
import {
  applySettingsBackupPayload,
  buildSettingsBackupPayload,
  parseSettingsBackupJson
} from '../settings-backup-service'
import { runAutoSettingsBackup } from '../settings-auto-backup-service'

function parseLocalStorageArg(localStorage: unknown): Record<string, string> {
  if (!localStorage || typeof localStorage !== 'object' || Array.isArray(localStorage)) {
    throw new Error('Ungueltiger localStorage-Export.')
  }
  const flat: Record<string, string> = {}
  for (const [k, v] of Object.entries(localStorage as Record<string, unknown>)) {
    if (typeof v === 'string') flat[k] = v
  }
  return flat
}

export function registerSettingsBackupIpc(): void {
  ipcMain.removeHandler(IPC.settingsBackup.exportToFile)
  ipcMain.removeHandler(IPC.settingsBackup.pickAndRead)
  ipcMain.removeHandler(IPC.settingsBackup.applyFull)
  ipcMain.removeHandler(IPC.settingsBackup.buildPreview)
  ipcMain.removeHandler(IPC.settingsBackup.summarize)
  ipcMain.removeHandler(IPC.settingsBackup.getAutoBackupStatus)
  ipcMain.removeHandler(IPC.settingsBackup.setAutoBackup)
  ipcMain.removeHandler(IPC.settingsBackup.pickAutoBackupDirectory)
  ipcMain.removeHandler(IPC.settingsBackup.runAutoBackupNow)

  ipcMain.handle(
    IPC.settingsBackup.exportToFile,
    async (event, localStorage: unknown): Promise<SettingsBackupExportResult> => {
      const flat = parseLocalStorageArg(localStorage)
      const win = BrowserWindow.fromWebContents(event.sender)
      const options: SaveDialogOptions = {
        title: 'Einstellungen exportieren',
        defaultPath: `mailclient-einstellungen-${new Date().toISOString().slice(0, 10)}.json`,
        filters: [{ name: 'JSON', extensions: ['json'] }]
      }
      const { canceled, filePath } = await (win
        ? dialog.showSaveDialog(win, options)
        : dialog.showSaveDialog(options))
      if (canceled || !filePath) {
        return { ok: false, cancelled: true }
      }
      const payload = await buildSettingsBackupPayload(flat)
      await writeFile(filePath, JSON.stringify(payload, null, 2), 'utf8')
      return { ok: true, path: filePath }
    }
  )

  ipcMain.handle(IPC.settingsBackup.pickAndRead, async (event): Promise<SettingsBackupPickResult> => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const options: OpenDialogOptions = {
      title: 'Einstellungen importieren',
      filters: [{ name: 'JSON', extensions: ['json'] }],
      properties: ['openFile']
    }
    const { canceled, filePaths } = await (win
      ? dialog.showOpenDialog(win, options)
      : dialog.showOpenDialog(options))
    if (canceled || !filePaths?.[0]) {
      return { ok: false, cancelled: true }
    }
    try {
      const raw = await readFile(filePaths[0], 'utf8')
      const backup = parseSettingsBackupJson(raw)
      return { ok: true, backup }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      return { ok: false, error: message }
    }
  })

  ipcMain.handle(
    IPC.settingsBackup.applyFull,
    async (_event, backup: unknown): Promise<void> => {
      if (!backup || typeof backup !== 'object') {
        throw new Error('Ungueltige Sicherung.')
      }
      const raw = JSON.stringify(backup)
      const parsed = parseSettingsBackupJson(raw) as SettingsBackupPayload
      await applySettingsBackupPayload(parsed)
    }
  )

  ipcMain.handle(
    IPC.settingsBackup.buildPreview,
    async (_event, localStorage: unknown): Promise<SettingsBackupContentsSummary> => {
      const flat = parseLocalStorageArg(localStorage)
      const payload = await buildSettingsBackupPayload(flat)
      return summarizeSettingsBackupPayload(payload)
    }
  )

  ipcMain.handle(
    IPC.settingsBackup.summarize,
    async (_event, backup: unknown): Promise<SettingsBackupContentsSummary> => {
      if (!backup || typeof backup !== 'object') {
        throw new Error('Ungueltige Sicherung.')
      }
      const raw = JSON.stringify(backup)
      const parsed = parseSettingsBackupJson(raw) as SettingsBackupPayload
      return summarizeSettingsBackupPayload(parsed)
    }
  )

  ipcMain.handle(
    IPC.settingsBackup.getAutoBackupStatus,
    async (): Promise<SettingsAutoBackupStatus> => {
      const config = await loadConfig()
      return {
        enabled: config.settingsAutoBackupEnabled === true,
        directory: config.settingsAutoBackupDirectory ?? null,
        lastAt: config.settingsAutoBackupLastAt ?? null,
        lastPath: config.settingsAutoBackupLastPath ?? null,
        lastError: config.settingsAutoBackupLastError ?? null
      }
    }
  )

  ipcMain.handle(
    IPC.settingsBackup.setAutoBackup,
    async (
      _event,
      patch: { enabled?: boolean; directory?: string | null }
    ): Promise<SettingsAutoBackupStatus> => {
      const partial: {
        settingsAutoBackupEnabled?: boolean
        settingsAutoBackupDirectory?: string | null
      } = {}
      if (typeof patch.enabled === 'boolean') {
        partial.settingsAutoBackupEnabled = patch.enabled
      }
      if ('directory' in patch) {
        const d = patch.directory
        partial.settingsAutoBackupDirectory =
          d == null || (typeof d === 'string' && !d.trim()) ? null : d.trim()
      }
      await updateConfig(partial)
      const config = await loadConfig()
      return {
        enabled: config.settingsAutoBackupEnabled === true,
        directory: config.settingsAutoBackupDirectory ?? null,
        lastAt: config.settingsAutoBackupLastAt ?? null,
        lastPath: config.settingsAutoBackupLastPath ?? null,
        lastError: config.settingsAutoBackupLastError ?? null
      }
    }
  )

  ipcMain.handle(
    IPC.settingsBackup.pickAutoBackupDirectory,
    async (event): Promise<SettingsBackupDirectoryPickResult> => {
      const win = BrowserWindow.fromWebContents(event.sender)
      const { canceled, filePaths } = await (win
        ? dialog.showOpenDialog(win, { properties: ['openDirectory', 'createDirectory'] })
        : dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] }))
      if (canceled || !filePaths?.[0]) {
        return { ok: false, cancelled: true }
      }
      await updateConfig({ settingsAutoBackupDirectory: filePaths[0] })
      return { ok: true, path: filePaths[0] }
    }
  )

  ipcMain.handle(
    IPC.settingsBackup.runAutoBackupNow,
    async (_event, localStorage: unknown): Promise<SettingsAutoBackupRunResult> => {
      let flat: Record<string, string> | undefined
      try {
        flat = parseLocalStorageArg(localStorage)
      } catch {
        flat = undefined
      }
      return runAutoSettingsBackup(flat)
    }
  )
}
