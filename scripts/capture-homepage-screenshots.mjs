/**
 * Reset Demo-Profil und starte Electron im Homepage-Capture-Modus.
 *
 *   npm run capture:homepage-screenshots
 */
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const outDir = path.join(repoRoot, 'docs', 'assets', 'screenshots')

function run(command, args, env = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
      env,
      stdio: 'inherit',
      shell: process.platform === 'win32'
    })
    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${command} ${args.join(' ')} exit ${code}`))
    })
  })
}

async function main() {
  console.log('==> Demo-Profil zurücksetzen …')
  await run(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'demo:reset'])

  console.log('==> Electron Capture starten …')
  console.log(`    Output: ${outDir}`)

  const env = {
    ...process.env,
    CHRONELL_DEMO: '1',
    CHRONELL_CAPTURE_HOMEPAGE: '1',
    CHRONELL_CAPTURE_OUT: outDir,
    CHRONELL_NO_VERSION_PROMPT: '1'
  }

  await run(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['electron-vite', 'dev'],
    env
  )

  console.log('Homepage-Screenshots fertig.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
