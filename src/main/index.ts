import { app, BrowserWindow, dialog, session, type WebContents } from 'electron'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { registerIpcHandlers } from './ipc'
import { getDb, getDbPath, closeDb } from './db'
import { listAccounts } from './accounts'
import { runInitialSync } from './sync-runner'
import { startCalendarSync, stopCalendarSync } from './calendar-sync-runner'
import { startMailPolling, stopMailPolling } from './mail-poll-runner'
import { loadConfig } from './config'
import { isAppOnline, startConnectivityMonitoring, stopConnectivityMonitoring } from './network-status'
import {
  isAppInternalNavigationUrl,
  normalizeExternalOpenUrl,
  openExternalIfAllowedSync
} from './open-external'
import { closeAllTeamsChatPopouts } from './teams-chat-popout'
import { closeAllMailReadingPopouts } from './mail-reading-popout'
import { pruneStaleAttachmentCache } from './attachment-cache'
import { applyPendingChromiumCachePurgeOnStartup } from './local-data-service'
import {
  configureChronellAppPaths,
  migrateLegacyUserDataIfNeeded
} from './user-data-migration'
import { APP_ID, APP_PRODUCT_NAME } from '@shared/app-version'
import { resolveAppWindowIcon } from './app-icon'

configureChronellAppPaths()

if (process.platform === 'win32') {
  app.setAppUserModelId(APP_ID)
}

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const isDev = !app.isPackaged

let mainWindow: BrowserWindow | null = null

let mailFrameRedirectRegistered = false

/**
 * Blockiert http(s)-Navigation in (Sub-)Frames **bevor** die Renderer-CSP greift
 * (sonst ERR_BLOCKED_BY_CSP im Mail-srcdoc-Iframe) und oeffnet stattdessen im OS-Browser.
 */
function registerMailFrameExternalRedirect(): void {
  if (mailFrameRedirectRegistered) return
  mailFrameRedirectRegistered = true
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    const rt = details.resourceType
    if (rt !== 'mainFrame' && rt !== 'subFrame') {
      callback({})
      return
    }
    const url = details.url
    if (isAppInternalNavigationUrl(url)) {
      callback({})
      return
    }
    if (normalizeExternalOpenUrl(url)) {
      openExternalIfAllowedSync(url)
      callback({ cancel: true })
      return
    }
    if (rt === 'subFrame') {
      callback({ cancel: true })
      return
    }
    callback({})
  })
}

function attachExternalNavigationGuards(contents: WebContents): void {
  contents.setWindowOpenHandler((details) => {
    openExternalIfAllowedSync(details.url)
    return { action: 'deny' }
  })
  /**
   * Jede WebContents (auch Popups aus sandboxed Mail-Iframes) — nicht nur das
   * Hauptfenster. Sonst laedt ein Kindfenster https unter der Renderer-CSP und
   * scheitert mit ERR_BLOCKED_BY_CSP statt im Systembrowser zu oeffnen.
   */
  contents.on('will-frame-navigate', (event) => {
    const url = event.url
    if (isAppInternalNavigationUrl(url)) return

    if (normalizeExternalOpenUrl(url)) {
      event.preventDefault()
      openExternalIfAllowedSync(url)
      return
    }

    if (!event.isMainFrame) {
      event.preventDefault()
    }
  })
}

app.on('web-contents-created', (_event, contents) => {
  if (contents.getType() === 'webview') return
  attachExternalNavigationGuards(contents)
})

function applyWindowIcon(win: BrowserWindow): void {
  const icon = resolveAppWindowIcon()
  if (!icon) return
  win.setIcon(icon)
}

function createMainWindow(): void {
  const icon = resolveAppWindowIcon()
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#0e0e12',
    title: APP_PRODUCT_NAME,
    ...(icon ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      /** Fuer das Chat-Modul (<webview> mit WhatsApp Web). */
      webviewTag: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    if (mainWindow) applyWindowIcon(mainWindow)
    mainWindow?.show()
  })

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    void mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(async () => {
  const migration = await migrateLegacyUserDataIfNeeded().catch((e) => {
    console.error('[migration] fehlgeschlagen:', e)
    return { status: 'skipped' as const, reason: 'error' }
  })
  if (migration.status === 'migrated') {
    console.log('[migration] Konten & Einstellungen übernommen von', migration.from)
  }

  registerMailFrameExternalRedirect()
  await applyPendingChromiumCachePurgeOnStartup().catch((e) =>
    console.warn('[startup] chromium-cache purge:', e)
  )
  try {
    getDb()
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e)
    const dbPath = getDbPath()
    console.error('[db] Start fehlgeschlagen:', detail, dbPath)
    await dialog.showMessageBox({
      type: 'error',
      title: `${APP_PRODUCT_NAME} — Datenbank`,
      message: 'Die lokale Datenbank konnte nicht geöffnet werden.',
      detail: `${detail}\n\nSpeicherort:\n${dbPath}\n\nHinweise:\n• Alle Chronell-/Electron-Fenster schließen und erneut starten\n• Prüfen, ob ein Virenscanner den Ordner blockiert\n• Bei anhaltendem Fehler: App beenden, Dateien mail.db-wal und mail.db-shm im data-Ordner löschen (falls vorhanden) und neu starten`,
      buttons: ['Beenden']
    })
    app.quit()
    return
  }
  void pruneStaleAttachmentCache().catch((e) =>
    console.warn('[startup] attachment-cache prune:', e)
  )
  registerIpcHandlers()
  createMainWindow()
  startConnectivityMonitoring()

  try {
    const cfg = await loadConfig()
    app.setLoginItemSettings({ openAtLogin: !!cfg.launchOnLogin, path: process.execPath })
  } catch (e) {
    console.warn('[startup] launchOnLogin:', e)
  }

  if (app.isPackaged && process.env.UPDATE_BASE_URL) {
    void import('electron-updater')
      .then(({ autoUpdater }) => {
        autoUpdater.setFeedURL({ provider: 'generic', url: process.env.UPDATE_BASE_URL! })
        void autoUpdater.checkForUpdatesAndNotify().catch(() => undefined)
      })
      .catch((e) => console.warn('[startup] autoUpdater:', e))
  }

  const accounts = await listAccounts()
  if (isAppOnline()) {
    for (const account of accounts) {
      void runInitialSync(account.id).catch((e) =>
        console.error('[startup] sync failed for', account.id, e)
      )
    }
  } else {
    console.warn('[startup] offline — Initial-Sync wird uebersprungen.')
  }

  startMailPolling()
  startCalendarSync()
  const { startMailBodyIndexRunner } = await import('./mail-body-index-queue')
  startMailBodyIndexRunner()

  const cfg = await loadConfig()
  if (cfg.profileDataMode === 'cloud') {
    const { readStoredSession } = await import('./sync-profile/supabase-session')
    const session = await readStoredSession()
    if (session) {
      const { startProfileSyncRunner } = await import('./sync-profile/profile-sync-runner')
      startProfileSyncRunner()
    }
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
    }
  })
})

app.on('before-quit', () => {
  closeAllTeamsChatPopouts()
  closeAllMailReadingPopouts()
  stopMailPolling()
  stopCalendarSync()
  stopConnectivityMonitoring()
  void import('./mail-body-index-queue').then((m) => m.stopMailBodyIndexRunner())
  void import('./sync-profile/profile-sync-runner').then((m) => m.stopProfileSyncRunner())
})

app.on('window-all-closed', () => {
  stopMailPolling()
  stopCalendarSync()
  stopConnectivityMonitoring()
  void import('./mail-body-index-queue').then((m) => m.stopMailBodyIndexRunner())
  void import('./sync-profile/profile-sync-runner').then((m) => m.stopProfileSyncRunner())
  closeDb()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
