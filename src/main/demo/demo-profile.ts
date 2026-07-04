import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'
import {
  DEMO_PROFILE_MARKER_FILE,
  DEMO_USER_DATA_DIR_NAME
} from '@shared/demo'

let demoProfileRequested: boolean | null = null

/** Must run before `configureChronellAppPaths()`. */
export function isDemoProfileRequested(): boolean {
  if (demoProfileRequested != null) return demoProfileRequested
  if (process.env.CHRONELL_DEMO === '1') {
    demoProfileRequested = true
    return true
  }
  demoProfileRequested = process.argv.includes('--demo')
  return demoProfileRequested
}

export function getDemoUserDataDirName(): string {
  return DEMO_USER_DATA_DIR_NAME
}

export function isDemoProfileActive(): boolean {
  if (isDemoProfileRequested()) return true
  try {
    const userData = app.getPath('userData')
    if (userData.replace(/\\/g, '/').toLowerCase().endsWith(`/${DEMO_USER_DATA_DIR_NAME.toLowerCase()}`)) {
      return true
    }
    return existsSync(join(userData, DEMO_PROFILE_MARKER_FILE))
  } catch {
    return false
  }
}

export function demoProfileMarkerPath(userDataPath?: string): string {
  const root = userDataPath ?? app.getPath('userData')
  return join(root, DEMO_PROFILE_MARKER_FILE)
}
