import type { BrowserWindow } from 'electron'

const WINDOW_MAXIMIZED_CHANNEL = 'app:window-maximized-changed'

/** Informiert den Renderer ueber Maximiert-Zustand (eigene Fenster-Buttons). */
export function attachWindowMaximizedEvents(win: BrowserWindow): void {
  const send = (maximized: boolean): void => {
    if (win.isDestroyed()) return
    win.webContents.send(WINDOW_MAXIMIZED_CHANNEL, maximized)
  }
  win.on('maximize', () => send(true))
  win.on('unmaximize', () => send(false))
}
