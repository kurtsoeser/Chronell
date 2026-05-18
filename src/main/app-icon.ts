import { app, nativeImage, type NativeImage } from 'electron'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const mainDir = fileURLToPath(new URL('.', import.meta.url))

/** Kandidaten-Basisverzeichnisse für App-Icons (Dev + Packaged). */
function iconResourceRoots(): string[] {
  if (app.isPackaged) {
    return [
      process.resourcesPath,
      join(process.resourcesPath, 'app.asar.unpacked', 'resources'),
      join(app.getAppPath(), 'resources')
    ]
  }
  return [join(app.getAppPath(), 'resources'), join(mainDir, '../../resources')]
}

function normalizeIconSize(image: NativeImage): NativeImage {
  const { width, height } = image.getSize()
  if (width <= 0 || height <= 0) return image
  if (width <= 256 && height <= 256) return image
  return image.resize({ width: 256, height: 256, quality: 'best' })
}

const ICON_FILE_NAMES_WIN = ['icon.png', 'icon.ico', 'branding/chronell-icon.png'] as const
const ICON_FILE_NAMES_DEFAULT = ['icon.png', 'icon.ico', 'branding/chronell-icon.png'] as const

/** Lädt das Fenster-/Taskbar-Icon (Windows: bevorzugt ICO, max. 256 px). */
export function resolveAppWindowIcon(): NativeImage | undefined {
  const files = process.platform === 'win32' ? ICON_FILE_NAMES_WIN : ICON_FILE_NAMES_DEFAULT

  for (const root of iconResourceRoots()) {
    for (const file of files) {
      const path = join(root, file)
      if (!existsSync(path)) continue
      const image = nativeImage.createFromPath(path)
      if (image.isEmpty()) continue
      return normalizeIconSize(image)
    }
  }
  return undefined
}
