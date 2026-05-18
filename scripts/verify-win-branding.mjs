#!/usr/bin/env node
/**
 * Prüft nach dem Windows-Build: EXE-Name, Version-Metadaten, icon.ico vorhanden.
 * Aufruf: node scripts/verify-win-branding.mjs [version]
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const version = process.argv[2] || pkg.version
const unpacked = join(root, 'release', version, 'win-unpacked')
const exePath = join(unpacked, 'Chronell.exe')
const iconPath = join(root, 'resources', 'icon.ico')

const errors = []

if (!existsSync(iconPath)) {
  errors.push(`Fehlt: ${iconPath} — npm run sync-branding`)
}
if (!existsSync(exePath)) {
  errors.push(`Fehlt: ${exePath} — Build unvollständig`)
} else {
  const info = (await import('node:child_process')).execSync(
    `powershell -NoProfile -Command "(Get-Item '${exePath.replace(/'/g, "''")}').VersionInfo | Select-Object FileDescription, ProductName, OriginalFilename | ConvertTo-Json"`,
    { encoding: 'utf8' }
  )
  const meta = JSON.parse(info)
  if (meta.FileDescription !== 'Chronell') {
    errors.push(`FileDescription ist "${meta.FileDescription}", erwartet Chronell`)
  }
  if (meta.ProductName !== 'Chronell') {
    errors.push(`ProductName ist "${meta.ProductName}", erwartet Chronell`)
  }
  if (meta.OriginalFilename !== 'Chronell.exe') {
    errors.push(`OriginalFilename ist "${meta.OriginalFilename}", erwartet Chronell.exe`)
  }
}

const asarPath = join(unpacked, 'resources', 'app.asar')
if (existsSync(asarPath)) {
  const asar = await import('@electron/asar')
  const packed = JSON.parse(asar.extractFile(asarPath, 'package.json').toString())
  if (packed.productName !== 'Chronell') {
    errors.push(`app.asar package.json productName: ${packed.productName ?? '(fehlt)'}`)
  }
  if (packed.name !== 'chronell') {
    errors.push(`app.asar package.json name: ${packed.name} (erwartet chronell)`)
  }
}

if (errors.length) {
  console.error('Branding-Verifikation FEHLGESCHLAGEN:\n')
  for (const e of errors) console.error('  -', e)
  process.exit(1)
}

console.log(`OK: Chronell ${version} — EXE, Metadaten und Icon-Voraussetzungen`)
