import { app, type BrowserWindow } from 'electron'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const SHOTS = [
  'mail-triage',
  'calendar',
  'design',
  'connections',
  'work',
  'dashboard'
] as const

export type HomepageCaptureShotId = (typeof SHOTS)[number]

export function isHomepageCaptureRequested(): boolean {
  return (
    process.env.CHRONELL_CAPTURE_HOMEPAGE === '1' ||
    process.argv.includes('--capture-homepage')
  )
}

function captureOutDir(): string {
  const fromEnv = process.env.CHRONELL_CAPTURE_OUT?.trim()
  if (fromEnv) return fromEnv
  return join(app.getAppPath(), 'docs', 'assets', 'screenshots')
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitForCaptureBridge(win: BrowserWindow, timeoutMs = 60_000): Promise<boolean> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (win.isDestroyed()) return false
    try {
      const ready = await win.webContents.executeJavaScript(
        `Boolean(window.__CHRONELL_HOMEPAGE_CAPTURE__?.ready?.())`
      )
      if (ready) return true
    } catch {
      // renderer not ready yet
    }
    await sleep(400)
  }
  return false
}

/**
 * Setzt Fenstergröße, wechselt Demo-Ansichten und schreibt PNGs für die Landing Page.
 * Beendet die App danach (Exit 0 bei Erfolg).
 */
export async function runHomepageScreenshotCapture(win: BrowserWindow): Promise<void> {
  const outDir = captureOutDir()
  mkdirSync(outDir, { recursive: true })

  win.setMenuBarVisibility(false)
  win.setBounds({ x: 40, y: 40, width: 1280, height: 800 })
  win.show()
  win.focus()

  console.log('[capture] warte auf Renderer-Bridge …')
  const bridged = await waitForCaptureBridge(win)
  if (!bridged) {
    console.error('[capture] Bridge nicht bereit — Abbruch.')
    app.exit(1)
    return
  }

  // Demo-Banner ausblenden (Marketing-Screenshots)
  try {
    await win.webContents.insertCSS(`
      [data-demo-banner], .demo-mode-banner { display: none !important; }
    `)
  } catch {
    // ignore
  }

  // Demo-Daten / erste Paints
  await sleep(2800)

  for (const shotId of SHOTS) {
    console.log(`[capture] ${shotId} …`)
    try {
      await win.webContents.executeJavaScript(
        `window.__CHRONELL_HOMEPAGE_CAPTURE__.prepareShot(${JSON.stringify(shotId)})`
      )
    } catch (e) {
      console.error(`[capture] prepareShot(${shotId}) fehlgeschlagen:`, e)
      app.exit(1)
      return
    }
    await sleep(500)
    const image = await win.webContents.capturePage()
    const png = image.toPNG()
    const outPath = join(outDir, `${shotId}.png`)
    writeFileSync(outPath, png)
    console.log(`[capture] geschrieben: ${outPath} (${Math.round(png.length / 1024)} KB)`)
  }

  console.log(`[capture] fertig — ${SHOTS.length} Screenshots in ${outDir}`)
  app.exit(0)
}
