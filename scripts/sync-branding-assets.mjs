#!/usr/bin/env node
/**
 * Master-Icon: docs/assets/chronell-icon.svg → PNG/ICO für Windows-Build, Favicon, Renderer.
 * Nach Logo-Tausch: npm run sync-branding
 */
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const iconSvgCandidates = [
  join(root, 'docs', 'assets', 'chronell-icon.svg'),
  join(root, 'resources', 'branding', 'chronell-icon.svg'),
  join(root, 'resources', 'branding', 'Chromell-icon.svg')
]

const iconSvg = iconSvgCandidates.find((p) => existsSync(p))
if (!iconSvg) {
  console.error('Chronell-Icon-SVG fehlt. Erwartet z. B.: docs/assets/chronell-icon.svg')
  process.exit(1)
}

const brandingDir = join(root, 'resources', 'branding')
mkdirSync(brandingDir, { recursive: true })
const brandingSvg = join(brandingDir, 'chronell-icon.svg')
if (iconSvg !== brandingSvg) {
  copyFileSync(iconSvg, brandingSvg)
  console.log('→', brandingSvg)
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

const logoPng = join(root, 'resources', 'branding', 'chronell-logo.png')

async function rasterizeIcons() {
  let sharp
  let toIco
  try {
    sharp = (await import('sharp')).default
    toIco = (await import('to-ico')).default
  } catch {
    console.warn('sharp/to-ico nicht installiert — npm i -D sharp to-ico')
    const fallbackPng = join(root, 'resources', 'branding', 'chronell-icon.png')
    if (!existsSync(fallbackPng)) {
      console.error('Kein Raster-Fallback:', fallbackPng)
      process.exit(1)
    }
    const fallbackTargets = [
      join(root, 'resources', 'icon.png'),
      join(root, 'src', 'renderer', 'public', 'favicon.png'),
      join(root, 'docs', 'assets', 'chronell-icon.png'),
      join(root, 'docs', 'assets', 'favicon.png')
    ]
    for (const dest of fallbackTargets) {
      mkdirSync(dirname(dest), { recursive: true })
      copyFileSync(fallbackPng, dest)
      console.log('→', dest)
    }
    return
  }

  const transparent = { r: 0, g: 0, b: 0, alpha: 0 }
  const src = sharp(iconSvg, { density: 300 })
  const resize = (size) =>
    src.clone().resize(size, size, { fit: 'contain', background: transparent }).png().toBuffer()

  const png256 = await resize(256)
  const png128 = await resize(128)
  const png48 = await resize(48)
  const png32 = await resize(32)
  const png16 = await resize(16)

  const rasterTargets = [
    [join(root, 'resources', 'icon.png'), png256],
    [join(brandingDir, 'chronell-icon.png'), png256],
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
