import { execFile } from 'node:child_process'
import { copyFile, mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import { DEMO_PACK_MANIFEST_NAME, DEMO_PACK_ZIP_NAME } from '@shared/demo'
import { buildDemoPackTree } from './build-demo-db'

const execFileAsync = promisify(execFile)
const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url))

async function main(): Promise<void> {
  const resourcesDemo = join(REPO_ROOT, 'resources', 'demo')
  const outZip = join(resourcesDemo, DEMO_PACK_ZIP_NAME)
  const staging = join(REPO_ROOT, '.demo-pack-staging')

  await rm(staging, { recursive: true, force: true })
  await mkdir(resourcesDemo, { recursive: true })

  buildDemoPackTree(staging)

  await copyFile(
    join(staging, DEMO_PACK_MANIFEST_NAME),
    join(resourcesDemo, DEMO_PACK_MANIFEST_NAME)
  )

  await rm(outZip, { force: true })
  await execFileAsync('tar', ['-a', '-cf', outZip, '-C', staging, '.'], { windowsHide: true })
  await rm(staging, { recursive: true, force: true })

  console.log(`[demo:build-pack] ${outZip}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
