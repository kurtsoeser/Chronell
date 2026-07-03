import { app, BrowserWindow, dialog, session, type WebContents } from 'electron'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { registerIpcHandlers } from './ipc'
import { getDb, getDbPath, closeDb } from './db'
import { listAccounts } from './accounts'
import { findFolderByWellKnown } from './db/folders-repo'
import { countMessagesInFolder } from './db/messages-repo'
import { runInitialSync } from './sync-runner'
import { repairAllMicrosoftMailSyncIfNeeded } from './mail-sync-repair'
import { warnProviderAuthOnce } from './auth/auth-errors'
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
import { closeAllQuickCapturePopouts } from './quick-capture-popout'
import { closeAllPanelPopouts } from './panel-popout/panel-popout-window'
import {
  registerNotesGlobalShortcuts,
  unregisterNotesGlobalShortcuts
} from './notes-global-shortcuts'
import { pruneStaleAttachmentCache } from './attachment-cache'
import { applyPendingChromiumCachePurgeOnStartup } from './local-data-service'
import { logBackgroundError } from './log-background-error'
import {
  configureChronellAppPaths,
  migrateLegacyUserDataIfNeeded
} from './user-data-migration'
import { APP_ID, APP_PRODUCT_NAME } from '@shared/app-version'
import {
  isAllowedNoteEmbedSubFrameUrl,
  NOTE_EMBED_HTTP_ORIGIN
} from '@shared/note-embed-frame'
import { attachChromiumZoomShortcutGuard } from './zoom-shortcut-guard'
import { resolveAppWindowIcon } from './app-icon'
import { mainWindowTitleBarOptions } from './window-titlebar'
import { attachWindowMaximizedEvents } from './window-state-events'
import {
  startMailBodyIndexRunner,
  stopMailBodyIndexRunner
} from './mail-body-index-runner-bridge'
import {
  startMailAttachmentIndexRunner,
  stopMailAttachmentIndexRunner
} from './mail-attachment-index-queue'
import { readStoredSession } from './sync-profile/supabase-session'
import {
  startProfileSyncRunner,
  stopProfileSyncRunner
} from './sync-profile/profile-sync-runner-bridge'
import {
  enqueueIcsFilePath,
  extractIcsPathsFromArgv,
  isIcsFilePath,
  notifyRendererOfPendingIcsFiles
} from './ics-open-queue'
import {
  registerNoteAttachmentMediaProtocol,
  registerNoteAttachmentMediaScheme
} from './note-attachment-media-protocol'
import {
  registerNoteM365VideoProtocol,
  registerNoteM365VideoScheme
} from './note-m365-video-protocol'

configureChronellAppPaths()

registerNoteAttachmentMediaScheme()
registerNoteM365VideoScheme()

for (const icsPath of extractIcsPathsFromArgv(process.argv)) {
  enqueueIcsFilePath(icsPath)
}

const gotSingleInstanceLock = app.requestSingleInstanceLock()
if (!gotSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', (_event, argv) => {
    for (const icsPath of extractIcsPathsFromArgv(argv)) {
      enqueueIcsFilePath(icsPath)
    }
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.show()
      mainWindow.focus()
      notifyRendererOfPendingIcsFiles(mainWindow)
    }
  })

  app.on('open-file', (event, filePath) => {
    event.preventDefault()
    if (!isIcsFilePath(filePath)) return
    enqueueIcsFilePath(filePath)
    notifyRendererOfPendingIcsFiles(mainWindow)
  })
}

if (process.platform === 'win32') {
  app.setAppUserModelId(APP_ID)
}

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const isDev = !app.isPackaged

let mainWindow: BrowserWindow | null = null

let mailFrameRedirectRegistered = false
let noteEmbedHeadersRegistered = false

/**
 * YouTube/Forms-Embeds in Notizen brauchen einen gültigen HTTP-Referer (YouTube-Fehler 153).
 * Unter file:// sendet Chromium keinen brauchbaren Referer — daher explizit setzen.
 */
function registerNoteEmbedRequestHeaders(): void {
  if (noteEmbedHeadersRegistered) return
  noteEmbedHeadersRegistered = true
  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    if (details.resourceType !== 'subFrame' || !isAllowedNoteEmbedSubFrameUrl(details.url)) {
      callback({ requestHeaders: details.requestHeaders })
      return
    }
    const requestHeaders = {
      ...details.requestHeaders,
      Referer: `${NOTE_EMBED_HTTP_ORIGIN}/`
    }
    callback({ requestHeaders })
  })
}

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
    if (rt === 'subFrame' && isAllowedNoteEmbedSubFrameUrl(url)) {
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

    if (!event.isMainFrame && isAllowedNoteEmbedSubFrameUrl(url)) return

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
    ...mainWindowTitleBarOptions(),
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

  attachChromiumZoomShortcutGuard(mainWindow.webContents)
  attachWindowMaximizedEvents(mainWindow)

  mainWindow.on('ready-to-show', () => {
    if (mainWindow) applyWindowIcon(mainWindow)
    mainWindow?.show()
  })

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    void mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.webContents.once('did-finish-load', () => {
    notifyRendererOfPendingIcsFiles(mainWindow)
  })
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
  registerNoteEmbedRequestHeaders()
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
  await registerNoteAttachmentMediaProtocol()
  await registerNoteM365VideoProtocol()
  createMainWindow()
  registerNotesGlobalShortcuts()
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
        void autoUpdater.checkForUpdatesAndNotify().catch((err) => logBackgroundError('startup.autoUpdater', err))
      })
      .catch((e) => console.warn('[startup] autoUpdater:', e))
  }

  const accounts = await listAccounts()
  if (isAppOnline()) {
    await repairAllMicrosoftMailSyncIfNeeded()
    for (const account of accounts) {
      if (account.provider === 'microsoft') {
        const inbox = findFolderByWellKnown(account.id, 'inbox')
        if (inbox && countMessagesInFolder(inbox.id) > 0) {
          continue
        }
      }
      void runInitialSync(account.id).catch((e) => warnProviderAuthOnce('startup', account.id, e))
    }
  } else {
    console.warn('[startup] offline — Initial-Sync wird uebersprungen.')
  }

  startMailPolling()
  startCalendarSync()
  startMailBodyIndexRunner()
  startMailAttachmentIndexRunner()

  const cfg = await loadConfig()
  if (cfg.profileDataMode === 'cloud') {
    const session = await readStoredSession()
    if (session) {
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
  unregisterNotesGlobalShortcuts()
  closeAllTeamsChatPopouts()
  closeAllMailReadingPopouts()
  closeAllQuickCapturePopouts()
  closeAllPanelPopouts()
  stopMailPolling()
  stopCalendarSync()
  stopConnectivityMonitoring()
  stopMailBodyIndexRunner()
  stopMailAttachmentIndexRunner()
  stopProfileSyncRunner()
})

app.on('window-all-closed', () => {
  stopMailPolling()
  stopCalendarSync()
  stopConnectivityMonitoring()
  stopMailBodyIndexRunner()
  stopMailAttachmentIndexRunner()
  stopProfileSyncRunner()
  closeDb()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
