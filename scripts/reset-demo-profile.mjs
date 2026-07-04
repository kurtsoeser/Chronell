import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'

const execFileAsync = promisify(execFile)
const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url))
const DEMO_PACK_ZIP = join(REPO_ROOT, 'resources', 'demo', 'chronell-demo-pack.zip')
const DEMO_MARKER = '.chronell-demo-profile'

const SKIP_DIRS = new Set([
  'Cache',
  'Code Cache',
  'GPUCache',
  'DawnGraphiteCache',
  'DawnWebGPUCache',
  'blob_storage',
  'attachment-cache'
])

function demoUserDataPath() {
  const appData = process.env.APPDATA
  if (!appData) {
    throw new Error('APPDATA nicht gesetzt — nur unter Windows unterstützt.')
  }
  return join(appData, 'Chronell-Demo')
}

async function clearDemoUserData(userDataPath) {
  const entries = await readdir(userDataPath, { withFileTypes: true }).catch(() => [])
  for (const ent of entries) {
    if (SKIP_DIRS.has(ent.name)) continue
    await rm(join(userDataPath, ent.name), { recursive: true, force: true })
  }
}

async function main() {
  if (!existsSync(DEMO_PACK_ZIP)) {
    throw new Error(`Demo-Paket fehlt: ${DEMO_PACK_ZIP}\nBitte zuerst: npm run demo:build-pack`)
  }

  const userDataPath = demoUserDataPath()
  await mkdir(userDataPath, { recursive: true })
  await clearDemoUserData(userDataPath)
  await execFileAsync('tar', ['-xf', DEMO_PACK_ZIP, '-C', userDataPath], { windowsHide: true })
  await writeFile(join(userDataPath, DEMO_MARKER), 'demo-profile\n', 'utf8')
  console.log(`[demo:reset] Profil zurückgesetzt: ${userDataPath}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
