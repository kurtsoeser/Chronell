import { existsSync } from 'node:fs'
import { extname, resolve } from 'node:path'
import type { BrowserWindow } from 'electron'

const pendingIcsPaths: string[] = []

export function isIcsFilePath(filePath: string): boolean {
  if (!filePath?.trim()) return false
  try {
    return extname(resolve(filePath)).toLowerCase() === '.ics'
  } catch {
    return false
  }
}

/** Kommandozeilen-Argumente nach .ics-Dateipfaden durchsuchen. */
export function extractIcsPathsFromArgv(argv: readonly string[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const raw of argv) {
    if (!raw || raw.startsWith('-')) continue
    if (!isIcsFilePath(raw)) continue
    try {
      const p = resolve(raw)
      if (!existsSync(p)) continue
      if (seen.has(p)) continue
      seen.add(p)
      out.push(p)
    } catch {
      /* skip invalid paths */
    }
  }
  return out
}

export function enqueueIcsFilePath(filePath: string): void {
  const p = resolve(filePath)
  if (!isIcsFilePath(p)) return
  if (pendingIcsPaths.includes(p)) return
  pendingIcsPaths.push(p)
}

export function drainPendingIcsPaths(): string[] {
  if (pendingIcsPaths.length === 0) return []
  return pendingIcsPaths.splice(0, pendingIcsPaths.length)
}

export function notifyRendererOfPendingIcsFiles(win: BrowserWindow | null): void {
  if (!win || win.isDestroyed()) return
  const wc = win.webContents
  if (wc.isDestroyed()) return
  for (const filePath of drainPendingIcsPaths()) {
    wc.send('calendar:ics-file-open', { filePath })
  }
}
