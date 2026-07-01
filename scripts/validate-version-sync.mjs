#!/usr/bin/env node
/**
 * Prüft, ob package.json und app-version.ts dieselbe Version tragen.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')

const packageJsonPath = path.join(repoRoot, 'package.json')
const appVersionPath = path.join(repoRoot, 'src/shared/app-version.ts')

const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
const appVersionSrc = fs.readFileSync(appVersionPath, 'utf8')

const pkgVersion = pkg.version
const match = appVersionSrc.match(/export const APP_VERSION = '([^']+)'/)
const appVersion = match?.[1]

let failed = false

if (!appVersion) {
  console.error('[version] APP_VERSION in app-version.ts nicht gefunden.')
  failed = true
} else if (pkgVersion !== appVersion) {
  console.error(
    `[version] Abweichung: package.json=${pkgVersion}, app-version.ts=${appVersion}`
  )
  failed = true
}

if (!failed) {
  console.log(`[version] OK — ${pkgVersion}`)
}

process.exit(failed ? 1 : 0)
