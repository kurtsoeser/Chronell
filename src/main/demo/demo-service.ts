import { app } from 'electron'
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  DEMO_PACK_MANIFEST_NAME,
  DEMO_PACK_ZIP_NAME,
  DEMO_PROFILE_MARKER_FILE
} from '@shared/demo'
import type { DemoStatus } from '@shared/types'
import {
  clearUserDataForReplace,
  getUserDataPath,
  restoreLocalDataArchive
} from '../local-data-service'
import { closeDb } from '../db'
import { demoProfileMarkerPath, isDemoProfileActive, isDemoProfileRequested } from './demo-profile'

const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url))

export function getBundledDemoPackPath(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, 'demo', DEMO_PACK_ZIP_NAME)
  }
  return join(REPO_ROOT, 'resources', 'demo', DEMO_PACK_ZIP_NAME)
}

function demoPackInstalled(userDataPath: string): boolean {
  return (
    existsSync(join(userDataPath, 'data', 'mail.db')) &&
    existsSync(join(userDataPath, 'secure', 'accounts.json'))
  )
}

export async function readDemoPackManifest(): Promise<{
  version: number
  scenario: string | null
} | null> {
  const userData = getUserDataPath()
  const path = join(userData, DEMO_PACK_MANIFEST_NAME)
  if (!existsSync(path)) {
    const bundled = join(REPO_ROOT, 'resources', 'demo', DEMO_PACK_MANIFEST_NAME)
    if (!existsSync(bundled)) return null
    try {
      const raw = await readFile(bundled, 'utf8')
      const parsed = JSON.parse(raw) as { version?: number; scenario?: string }
      return { version: parsed.version ?? 1, scenario: parsed.scenario ?? null }
    } catch {
      return null
    }
  }
  try {
    const raw = await readFile(path, 'utf8')
    const parsed = JSON.parse(raw) as { version?: number; scenario?: string }
    return { version: parsed.version ?? 1, scenario: parsed.scenario ?? null }
  } catch {
    return null
  }
}

export async function ensureDemoPackInstalled(): Promise<void> {
  const userDataPath = getUserDataPath()
  if (demoPackInstalled(userDataPath)) {
    if (!existsSync(demoProfileMarkerPath(userDataPath))) {
      await writeFile(demoProfileMarkerPath(userDataPath), 'demo-profile\n', 'utf8')
    }
    return
  }

  const packPath = getBundledDemoPackPath()
  if (!existsSync(packPath)) {
    throw new Error(`Demo-Paket nicht gefunden: ${packPath}. Bitte npm run demo:build-pack ausführen.`)
  }

  closeDb()
  await restoreLocalDataArchive(packPath, { mode: 'replace' })
  await writeFile(demoProfileMarkerPath(userDataPath), 'demo-profile\n', 'utf8')
}

export async function resetDemoProfile(): Promise<void> {
  if (!isDemoProfileRequested() && !isDemoProfileActive()) {
    throw new Error('Reset nur im Demo-Profil möglich.')
  }
  const packPath = getBundledDemoPackPath()
  if (!existsSync(packPath)) {
    throw new Error(`Demo-Paket nicht gefunden: ${packPath}`)
  }
  closeDb()
  const userDataPath = getUserDataPath()
  await clearUserDataForReplace(userDataPath)
  await restoreLocalDataArchive(packPath, { mode: 'merge' })
  await writeFile(demoProfileMarkerPath(userDataPath), 'demo-profile\n', 'utf8')
  app.relaunch({ args: process.argv.slice(1).filter((a) => a !== '--demo').concat('--demo') })
  app.exit(0)
}

export function relaunchWithDemoFlag(enableDemo: boolean): void {
  const args = process.argv.slice(1).filter((a) => a !== '--demo')
  if (enableDemo) args.push('--demo')
  app.relaunch({ args })
  app.exit(0)
}

export async function getDemoStatus(): Promise<DemoStatus> {
  const userDataPath = getUserDataPath()
  const manifest = await readDemoPackManifest()
  const active = isDemoProfileActive()
  return {
    active,
    userDataPath,
    packVersion: manifest?.version ?? null,
    scenario: manifest?.scenario ?? null,
    canReset: active,
    canExit: active
  }
}

export async function exportDemoPackTo(zipPath: string): Promise<string> {
  const { exportLocalDataArchive } = await import('../local-data-service')
  await exportLocalDataArchive(zipPath, 'portable')
  return zipPath
}

export async function writeDemoPackMarker(userDataPath: string): Promise<void> {
  await mkdir(userDataPath, { recursive: true })
  await writeFile(demoProfileMarkerPath(userDataPath), 'demo-profile\n', 'utf8')
}
