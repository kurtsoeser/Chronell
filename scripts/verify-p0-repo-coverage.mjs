#!/usr/bin/env node
/** @deprecated Nutze scripts/verify-repo-coverage.mjs p0 */
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const args = ['scripts/verify-repo-coverage.mjs', 'p0', ...process.argv.slice(2)]
const r = spawnSync(process.execPath, args, { cwd: root, stdio: 'inherit' })
process.exit(r.status ?? 1)
