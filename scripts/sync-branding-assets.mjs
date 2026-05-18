#!/usr/bin/env node
/**
 * Kopiert Master-Branding aus resources/branding/ in Renderer-public, Electron-Icon und docs/assets.
 * Erzeugt verkleinerte PNG/ICO für Fensterleiste und Favicon (Windows braucht ≤256 px, kein 2k-PNG).
 * Nach Logo-Tausch: npm run sync-branding
 */
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const iconSvg = join(root, 'resources', 'branding', 'Chromell-icon.svg')
const iconPng = join(root, 'resources', 'branding', 'chronell-icon.png')
const logoPng = join(root, 'resources', 'branding', 'chronell-logo.png')

if (!existsSync(iconSvg)) {
  console.error('Fehlt:', iconSvg)
  process.exit(1)
}

const svgTargets = [
  join(root, 'src', 'renderer', 'public', 'chronell-icon.svg'),
  join(root, 'docs', 'assets', 'chronell-icon.svg')
]

for (const dest of svgTargets) {
  mkdirSync(dirname(dest), { recursive: true })
  copyFileSync(iconSvg, dest)
  console.log('→', dest)
}

async function rasterizeIcons() {
  if (!existsSync(iconPng)) {
    console.warn('Hinweis: Kein Raster-Icon —', iconPng)
    return
  }

  let sharp
  let toIco
  try {
    sharp = (await import('sharp')).default
    toIco = (await import('to-ico')).default
  } catch {
    console.warn('sharp/to-ico nicht installiert — kopiere PNG unverändert (npm i -D sharp to-ico empfohlen)')
    const fallbackTargets = [
      join(root, 'resources', 'icon.png'),
      join(root, 'src', 'renderer', 'public', 'favicon.png'),
      join(root, 'docs', 'assets', 'chronell-icon.png'),
      join(root, 'docs', 'assets', 'favicon.png')
    ]
    for (const dest of fallbackTargets) {
      mkdirSync(dirname(dest), { recursive: true })
      copyFileSync(iconPng, dest)
      console.log('→', dest)
    }
    return
  }

  const src = sharp(iconPng)
  const transparent = { r: 0, g: 0, b: 0, alpha: 0 }
  const resize = (size) =>
    src.clone().resize(size, size, { fit: 'contain', background: transparent }).png().toBuffer()
  const png256 = await resize(256)
  const png128 = await resize(128)
  const png48 = await resize(48)
  const png32 = await resize(32)
  const png16 = await resize(16)

  const rasterTargets = [
    [join(root, 'resources', 'icon.png'), png256],
    [join(root, 'src', 'renderer', 'public', 'favicon.png'), png32],
    [join(root, 'src', 'renderer', 'public', 'favicon-256.png'), png256],
    [join(root, 'docs', 'assets', 'chronell-icon.png'), png256],
    [join(root, 'docs', 'assets', 'favicon.png'), png32]
  ]

  for (const [dest, buf] of rasterTargets) {
    mkdirSync(dirname(dest), { recursive: true })
    writeFileSync(dest, buf)
    console.log('→', dest)
  }

  const icoPath = join(root, 'resources', 'icon.ico')
  writeFileSync(icoPath, await toIco([png16, png32, png48, png128, png256]))
  console.log('→', icoPath)
}

if (existsSync(logoPng)) {
  const logoDest = join(root, 'docs', 'assets', 'chronell-logo.png')
  mkdirSync(dirname(logoDest), { recursive: true })
  copyFileSync(logoPng, logoDest)
  console.log('→', logoDest)
}

await rasterizeIcons()
