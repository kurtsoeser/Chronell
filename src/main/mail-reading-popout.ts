import { app, BrowserWindow, screen } from 'electron'
import { resolveAppWindowIcon } from './app-icon'
import { popoutWindowTitleBarOptions } from './window-titlebar'
import { attachChromiumZoomShortcutGuard } from './zoom-shortcut-guard'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { MailReadingPopoutKey, MailReadingPopoutOpenInput } from '@shared/types'
import { broadcastMailReadingPopoutClosed } from './ipc/ipc-broadcasts'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const isDev = !app.isPackaged

const POPOUT_WIDTH = 720
const POPOUT_HEIGHT = 820
const CASCADE_OFFSET = 28

function popoutKey(messageId: number): MailReadingPopoutKey {
  return String(messageId)
}

function buildHashRoute(messageId: number): string {
  const params = new URLSearchParams({ messageId: String(messageId) })
  return `mail-reading-popout?${params.toString()}`
}

function loadPopoutRenderer(win: BrowserWindow, messageId: number): void {
  const hash = buildHashRoute(messageId)
  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (isDev && devUrl) {
    const base = devUrl.replace(/#.*$/, '')
    void win.loadURL(`${base}#${hash}`)
    return
  }
  void win.loadFile(join(__dirname, '../renderer/index.html'), { hash })
}

function nextCascadePosition(): { x: number; y: number } {
  const n = popoutWindows.size
  const display = screen.getPrimaryDisplay()
  const work = display.workArea
  const baseX = work.x + Math.max(0, work.width - POPOUT_WIDTH - 48)
  const baseY = work.y + Math.max(0, Math.floor((work.height - POPOUT_HEIGHT) / 2))
  return { x: baseX + n * CASCADE_OFFSET, y: baseY + n * CASCADE_OFFSET }
}

const popoutWindows = new Map<MailReadingPopoutKey, BrowserWindow>()
const popoutMeta = new Map<MailReadingPopoutKey, { title: string; alwaysOnTop: boolean }>()

function getMeta(key: MailReadingPopoutKey, fallbackTitle: string): { title: string; alwaysOnTop: boolean } {
  return popoutMeta.get(key) ?? { title: fallbackTitle, alwaysOnTop: true }
}

export function isMailReadingPopoutOpen(messageId: number): boolean {
  const win = popoutWindows.get(popoutKey(messageId))
  return win != null && !win.isDestroyed()
}

export function focusMailReadingPopout(messageId: number): boolean {
  const win = popoutWindows.get(popoutKey(messageId))
  if (!win || win.isDestroyed()) return false
  if (win.isMinimized()) win.restore()
  win.show()
  win.focus()
  return true
}

export function closeMailReadingPopout(messageId: number): void {
  const key = popoutKey(messageId)
  const win = popoutWindows.get(key)
  if (!win || win.isDestroyed()) {
    popoutWindows.delete(key)
    popoutMeta.delete(key)
    return
  }
  win.close()
}

export function getMailReadingPopoutAlwaysOnTop(messageId: number): boolean {
  const win = popoutWindows.get(popoutKey(messageId))
  if (!win || win.isDestroyed()) return false
  return win.isAlwaysOnTop()
}

export function setMailReadingPopoutAlwaysOnTop(messageId: number, alwaysOnTop: boolean): void {
  const key = popoutKey(messageId)
  const win = popoutWindows.get(key)
  if (!win || win.isDestroyed()) return
  win.setAlwaysOnTop(alwaysOnTop, 'floating')
  const meta = popoutMeta.get(key)
  if (meta) popoutMeta.set(key, { ...meta, alwaysOnTop })
}

export function openMailReadingPopout(input: MailReadingPopoutOpenInput): void {
  const messageId = input.messageId
  if (!Number.isFinite(messageId) || messageId <= 0) {
    throw new Error('Nachrichten-ID erforderlich.')
  }
  const key = popoutKey(messageId)
  const existing = popoutWindows.get(key)
  if (existing && !existing.isDestroyed()) {
    focusMailReadingPopout(messageId)
    return
  }

  const title = input.title?.trim() || 'E-Mail'
  const alwaysOnTop = input.alwaysOnTop !== false
  const { x, y } = nextCascadePosition()

  const icon = resolveAppWindowIcon()
  const win = new BrowserWindow({
    width: POPOUT_WIDTH,
    height: POPOUT_HEIGHT,
    minWidth: 420,
    minHeight: 480,
    x,
    y,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#0e0e12',
    title,
    alwaysOnTop,
    ...popoutWindowTitleBarOptions(),
    ...(icon ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true
    }
  })

  if (alwaysOnTop) {
    win.setAlwaysOnTop(true, 'floating')
  }

  attachChromiumZoomShortcutGuard(win.webContents)

  popoutWindows.set(key, win)
  popoutMeta.set(key, { title, alwaysOnTop })

  win.on('ready-to-show', () => {
    if (!win.isDestroyed()) win.show()
  })

  win.on('closed', () => {
    popoutWindows.delete(key)
    popoutMeta.delete(key)
    broadcastMailReadingPopoutClosed({ messageId })
  })

  loadPopoutRenderer(win, messageId)
}

export function closeAllMailReadingPopouts(): void {
  for (const win of [...popoutWindows.values()]) {
    if (!win.isDestroyed()) win.close()
  }
  popoutWindows.clear()
  popoutMeta.clear()
}
