#!/usr/bin/env node
/**
 * Prueft Repo-Coverage-Schwellen nach `vitest run --coverage`.
 * Voraussetzung: better-sqlite3 fuer System-Node (npm rebuild better-sqlite3).
 *
 * Aufruf: node scripts/verify-repo-coverage.mjs [p0|p1|all] [--no-run]
 */
import { execSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { REPO_COVERAGE_TIERS } from './lib/repo-coverage-targets.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
const summaryPath = join(root, 'coverage', 'coverage-summary.json')

const tierArg = process.argv.find((a) => a === 'p0' || a === 'p1' || a === 'all') ?? 'p0'
const targets = REPO_COVERAGE_TIERS[tierArg]
if (!targets) {
  console.error(`Unbekannte Stufe: ${tierArg} (p0, p1, all)`)
  process.exit(1)
}

function probeSqlite() {
  try {
    const Database = require('better-sqlite3')
    const db = new Database(':memory:')
    db.close()
    return true
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('better-sqlite3 nicht nutzbar fuer Vitest:', msg.split('\n')[0])
    console.error('Hinweis: Electron/IDE-Prozesse beenden, dann `npm rebuild better-sqlite3`')
    return false
  }
}

function findCoverageEntry(summary, relativePath) {
  const suffix = relativePath.replace(/\\/g, '/')
  for (const [key, value] of Object.entries(summary)) {
    if (key === 'total') continue
    if (key.replace(/\\/g, '/').endsWith(suffix)) return value
  }
  return null
}

const runCoverage = !process.argv.includes('--no-run')

if (!probeSqlite()) {
  process.exit(1)
}

if (runCoverage) {
  console.log('Starte vitest run --coverage …')
  execSync('npx vitest run --coverage', { cwd: root, stdio: 'inherit' })
}

if (!existsSync(summaryPath)) {
  console.error(`Fehlt: ${summaryPath} — json-summary Reporter in vitest.config.ts aktiv?`)
  process.exit(1)
}

const summary = JSON.parse(readFileSync(summaryPath, 'utf8'))
const errors = []
const rows = []

for (const { file, minStatements } of targets) {
  const entry = findCoverageEntry(summary, file)
  if (!entry) {
    errors.push(`${file}: nicht im Coverage-Report`)
    continue
  }
  const pct = entry.statements?.pct ?? 0
  const covered = entry.statements?.covered ?? 0
  const total = entry.statements?.total ?? 0
  rows.push({ file, pct, covered, total, minStatements, ok: pct >= minStatements })
  if (pct < minStatements) {
    errors.push(`${file}: Statements ${pct}% < Ziel ${minStatements}% (${covered}/${total})`)
  }
}

const label = tierArg.toUpperCase()
console.log(`\n${label}-Repo-Coverage (Statements):`)
for (const row of rows) {
  const mark = row.ok ? 'OK' : 'FAIL'
  console.log(`  [${mark}] ${row.file}: ${row.pct}% (${row.covered}/${row.total}), Ziel >= ${row.minStatements}%`)
}

if (errors.length > 0) {
  console.error(`\n${label}-Coverage nicht erfuellt:`)
  for (const e of errors) console.error(`  - ${e}`)
  process.exit(1)
}

console.log(`\n${label}-Coverage-Ziel erfuellt.`)
