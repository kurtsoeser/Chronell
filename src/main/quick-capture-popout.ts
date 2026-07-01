import { app, BrowserWindow, screen } from 'electron'
import { resolveAppWindowIcon } from './app-icon'
import { popoutWindowTitleBarOptions } from './window-titlebar'
import { attachChromiumZoomShortcutGuard } from './zoom-shortcut-guard'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const isDev = !app.isPackaged

const POPOUT_WIDTH = 440
const POPOUT_HEIGHT = 420

let quickCaptureWindow: BrowserWindow | null = null

function buildHashRoute(): string {
  return 'quick-capture-popout'
}

function loadPopoutRenderer(win: BrowserWindow): void {
  const hash = buildHashRoute()
  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (isDev && devUrl) {
    const base = devUrl.replace(/#.*$/, '')
    void win.loadURL(`${base}#${hash}`)
    return
  }
  void win.loadFile(join(__dirname, '../renderer/index.html'), { hash })
}

function nextPosition(): { x: number; y: number } {
  const display = screen.getPrimaryDisplay()
  const work = display.workArea
  const x = work.x + Math.max(24, work.width - POPOUT_WIDTH - 32)
  const y = work.y + Math.max(24, Math.floor(work.height * 0.12))
  return { x, y }
}

export function isQuickCapturePopoutOpen(): boolean {
  return quickCaptureWindow != null && !quickCaptureWindow.isDestroyed()
}

export function focusQuickCapturePopout(): boolean {
  if (!quickCaptureWindow || quickCaptureWindow.isDestroyed()) return false
  if (quickCaptureWindow.isMinimized()) quickCaptureWindow.restore()
  quickCaptureWindow.show()
  quickCaptureWindow.focus()
  return true
}

export function closeQuickCapturePopout(): void {
  if (!quickCaptureWindow || quickCaptureWindow.isDestroyed()) {
    quickCaptureWindow = null
    return
  }
  quickCaptureWindow.close()
}

export function toggleQuickCapturePopout(): void {
  if (isQuickCapturePopoutOpen()) {
    closeQuickCapturePopout()
    return
  }
  openQuickCapturePopout()
}

export function openQuickCapturePopout(): void {
  if (isQuickCapturePopoutOpen()) {
    focusQuickCapturePopout()
    return
  }

  const { x, y } = nextPosition()
  const win = new BrowserWindow({
    width: POPOUT_WIDTH,
    height: POPOUT_HEIGHT,
    minWidth: 360,
    minHeight: 300,
    x,
    y,
    show: false,
    title: 'Schnellnotiz',
    icon: resolveAppWindowIcon(),
    ...popoutWindowTitleBarOptions(),
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  quickCaptureWindow = win
  attachChromiumZoomShortcutGuard(win.webContents)

  win.on('closed', () => {
    if (quickCaptureWindow === win) quickCaptureWindow = null
  })

  loadPopoutRenderer(win)
  win.once('ready-to-show', () => {
    if (win.isDestroyed()) return
    win.show()
    win.focus()
  })
}

export function closeAllQuickCapturePopouts(): void {
  closeQuickCapturePopout()
}
