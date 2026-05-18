#!/usr/bin/env node
/**
 * Kopiert Master-Branding aus resources/branding/ in Renderer-public, Electron-Icon und docs/assets.
 * Nach Logo-Tausch: npm run sync-branding
 */
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
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

if (existsSync(iconPng)) {
  const rasterTargets = [
    join(root, 'resources', 'icon.png'),
    join(root, 'src', 'renderer', 'public', 'favicon.png'),
    join(root, 'docs', 'assets', 'chronell-icon.png'),
    join(root, 'docs', 'assets', 'favicon.png')
  ]
  for (const dest of rasterTargets) {
    mkdirSync(dirname(dest), { recursive: true })
    copyFileSync(iconPng, dest)
    console.log('→', dest)
  }
} else {
  console.warn('Hinweis: Kein Raster-Icon —', iconPng, '(Fenster/Taskbar brauchen PNG auf Windows)')
}

if (existsSync(logoPng)) {
  const logoDest = join(root, 'docs', 'assets', 'chronell-logo.png')
  mkdirSync(dirname(logoDest), { recursive: true })
  copyFileSync(logoPng, logoDest)
  console.log('→', logoDest)
}
