import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const electronPath = require('electron')
const repoRoot = fileURLToPath(new URL('..', import.meta.url))
const cli = join(repoRoot, 'src', 'demo', 'build-demo-snapshot-cli.ts')
const tsxCli = join(repoRoot, 'node_modules', 'tsx', 'dist', 'cli.mjs')

const result = spawnSync(electronPath, [tsxCli, '--tsconfig', 'tsconfig.node.json', cli], {
  cwd: repoRoot,
  stdio: 'inherit',
  env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }
})

process.exit(result.status ?? 1)
