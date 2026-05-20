/**
 * Startet postbuild-win.ps1 per -File (ohne Shell-$-Expansion, zuverlaessig aus npm).
 */
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const scriptPath = path.join(repoRoot, 'scripts', 'postbuild-win.ps1')
const extraArgs = process.argv.slice(2)

const result = spawnSync(
  'powershell.exe',
  ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath, ...extraArgs],
  { cwd: repoRoot, stdio: 'inherit', windowsHide: true }
)

if (result.error) {
  console.error(result.error.message)
  process.exit(1)
}

process.exit(result.status ?? 1)
