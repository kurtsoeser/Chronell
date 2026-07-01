#!/usr/bin/env node
/**
 * Vergleicht verschachtelte i18n-Keys zwischen de.json und en.json.
 * Exit 1 bei fehlenden Keys in einer der Dateien.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')

const localeDir = path.join(repoRoot, 'src/renderer/src/locales')
const locales = ['de', 'en']

function collectKeys(obj, prefix = '') {
  const keys = []
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
    return keys
  }
  for (const [key, value] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${key}` : key
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      keys.push(...collectKeys(value, full))
    } else {
      keys.push(full)
    }
  }
  return keys
}

function loadLocale(code) {
  const filePath = path.join(localeDir, `${code}.json`)
  const raw = fs.readFileSync(filePath, 'utf8')
  return JSON.parse(raw)
}

const keysByLocale = Object.fromEntries(
  locales.map((code) => [code, new Set(collectKeys(loadLocale(code)))])
)

let failed = false

for (const base of locales) {
  const others = locales.filter((l) => l !== base)
  for (const other of others) {
    const missing = [...keysByLocale[other]].filter((k) => !keysByLocale[base].has(k)).sort()
    if (missing.length > 0) {
      failed = true
      console.error(`[i18n] ${missing.length} Key(s) in ${other}.json fehlen in ${base}.json:`)
      for (const key of missing.slice(0, 30)) {
        console.error(`  - ${key}`)
      }
      if (missing.length > 30) {
        console.error(`  ... und ${missing.length - 30} weitere`)
      }
    }
  }
}

if (!failed) {
  const counts = Object.fromEntries(locales.map((l) => [l, keysByLocale[l].size]))
  console.log(
    `[i18n] OK — ${locales.map((l) => `${l}: ${counts[l]} Keys`).join(', ')}`
  )
}

process.exit(failed ? 1 : 0)
