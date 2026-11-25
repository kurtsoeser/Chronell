import { app, type BrowserWindow } from 'electron'
import { resolve } from 'node:path'
import {
  extractChronellWebinarLaunchesFromArgv,
  type ChronellWebinarLaunch
} from '@shared/chronell-protocol'

const pending: ChronellWebinarLaunch[] = []

export function registerChronellProtocolClient(): void {
  if (process.platform !== 'win32' && process.platform !== 'darwin') return
  try {
    if (process.defaultApp && process.argv.length >= 2) {
      app.setAsDefaultProtocolClient('chronell', process.execPath, [
        resolve(process.argv[1]!)
      ])
    } else {
      app.setAsDefaultProtocolClient('chronell')
    }
  } catch (err) {
    console.error('[chronell-protocol] Registrierung fehlgeschlagen', err)
  }
}

export function enqueueChronellWebinarLaunchesFromArgv(argv: readonly string[]): void {
  for (const launch of extractChronellWebinarLaunchesFromArgv(argv)) {
    const key = `${launch.action}:${launch.eventId}`
    if (pending.some((p) => `${p.action}:${p.eventId}` === key)) continue
    pending.push(launch)
  }
}

export function drainChronellWebinarLaunches(): ChronellWebinarLaunch[] {
  if (pending.length === 0) return []
  return pending.splice(0, pending.length)
}

/** Renderer zieht die Queue selbst — Signal nur, wenn etwas wartet. */
export function notifyChronellWebinarLaunchesAvailable(win: BrowserWindow | null): void {
  if (!win || win.isDestroyed() || pending.length === 0) return
  const wc = win.webContents
  if (wc.isDestroyed()) return
  wc.send('events-os:webinar-launch-available')
}
