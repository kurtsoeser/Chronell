import { app, BrowserWindow, screen } from 'electron'
import { resolveAppWindowIcon } from '../app-icon'
import { popoutWindowTitleBarOptions } from '../window-titlebar'
import { attachChromiumZoomShortcutGuard } from '../zoom-shortcut-guard'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { PanelPopoutKind, PanelPopoutOpenInput, PanelPopoutRef } from '@shared/panel-popout'
import { broadcastPanelPopoutClosed } from '../ipc/ipc-broadcasts'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const isDev = !app.isPackaged

const CASCADE_OFFSET = 28

const PANEL_SIZE: Record<
  PanelPopoutKind,
  { width: number; height: number; minWidth: number; minHeight: number }
> = {
  'mail-calendar': { width: 400, height: 720, minWidth: 300, minHeight: 400 },
  'calendar-zeitliste': { width: 420, height: 760, minWidth: 300, minHeight: 420 },
  'calendar-preview': { width: 520, height: 720, minWidth: 320, minHeight: 400 },
  'calendar-event': { width: 720, height: 820, minWidth: 560, minHeight: 480 },
  'connections-preview': { width: 520, height: 720, minWidth: 320, minHeight: 400 },
  compose: { width: 760, height: 680, minWidth: 520, minHeight: 420 },
  'custom-view-zone': { width: 640, height: 560, minWidth: 280, minHeight: 220 }
}

function windowKey(panel: PanelPopoutKind, instanceKey?: string): string {
  const ik = instanceKey?.trim() || ''
  return ik ? `${panel}::${ik}` : panel
}

function buildHashRoute(input: PanelPopoutOpenInput): string {
  const params = new URLSearchParams({ panel: input.panel })
  if (input.instanceKey?.trim()) {
    params.set('instanceKey', input.instanceKey.trim())
  }
  if (input.stashKey?.trim()) {
    params.set('stashKey', input.stashKey.trim())
  }
  if (input.params) {
    for (const [k, v] of Object.entries(input.params)) {
      if (v != null && String(v).length > 0) params.set(k, String(v))
    }
  }
  return `panel-popout?${params.toString()}`
}

function loadPopoutRenderer(win: BrowserWindow, input: PanelPopoutOpenInput): void {
  const hash = buildHashRoute(input)
  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (isDev && devUrl) {
    const base = devUrl.replace(/#.*$/, '')
    void win.loadURL(`${base}#${hash}`)
    return
  }
  void win.loadFile(join(__dirname, '../renderer/index.html'), { hash })
}

function nextCascadePosition(width: number, height: number): { x: number; y: number } {
  const n = popoutWindows.size
  const display = screen.getPrimaryDisplay()
  const work = display.workArea
  const baseX = work.x + Math.max(0, work.width - width - 48)
  const baseY = work.y + Math.max(0, Math.floor((work.height - height) / 2))
  return { x: baseX + n * CASCADE_OFFSET, y: baseY + n * CASCADE_OFFSET }
}

const popoutWindows = new Map<string, BrowserWindow>()

export function isPanelPopoutOpen(panel: PanelPopoutKind, instanceKey?: string): boolean {
  const win = popoutWindows.get(windowKey(panel, instanceKey))
  return win != null && !win.isDestroyed()
}

export function focusPanelPopout(panel: PanelPopoutKind, instanceKey?: string): boolean {
  const win = popoutWindows.get(windowKey(panel, instanceKey))
  if (!win || win.isDestroyed()) return false
  if (win.isMinimized()) win.restore()
  win.show()
  win.focus()
  return true
}

export function closePanelPopout(panel: PanelPopoutKind, instanceKey?: string): void {
  const key = windowKey(panel, instanceKey)
  const win = popoutWindows.get(key)
  if (!win || win.isDestroyed()) {
    popoutWindows.delete(key)
    return
  }
  win.close()
}

export function openPanelPopout(input: PanelPopoutOpenInput): void {
  const key = windowKey(input.panel, input.instanceKey)
  const existing = popoutWindows.get(key)
  if (existing && !existing.isDestroyed()) {
    focusPanelPopout(input.panel, input.instanceKey)
    return
  }

  const size = PANEL_SIZE[input.panel]
  const alwaysOnTop = input.alwaysOnTop !== false
  const { x, y } = nextCascadePosition(size.width, size.height)
  const icon = resolveAppWindowIcon()

  const win = new BrowserWindow({
    width: size.width,
    height: size.height,
    minWidth: size.minWidth,
    minHeight: size.minHeight,
    x,
    y,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#0e0e12',
    title: input.title?.trim() || 'Chronell',
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

  win.on('ready-to-show', () => {
    if (!win.isDestroyed()) win.show()
  })

  win.on('closed', () => {
    popoutWindows.delete(key)
    broadcastPanelPopoutClosed({
      panel: input.panel,
      instanceKey: input.instanceKey?.trim() || ''
    })
  })

  loadPopoutRenderer(win, input)
}

export function closeAllPanelPopouts(): void {
  for (const win of [...popoutWindows.values()]) {
    if (!win.isDestroyed()) win.close()
  }
  popoutWindows.clear()
}

export function parsePanelPopoutRef(raw: PanelPopoutRef): PanelPopoutRef {
  return {
    panel: raw.panel,
    instanceKey: raw.instanceKey?.trim() || undefined
  }
}
