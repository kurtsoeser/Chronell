'use strict'

const path = require('node:path')
const fs = require('node:fs')

/** Nur UI-Sprachen der App (de/en) + Electron-Basis — spart viele MB im Installer. */
const ELECTRON_LOCALE_PAK_KEEP = new Set(['en-US.pak', 'de.pak', 'en-GB.pak'])

/**
 * Entfernt unnoetigen Ballast aus dem gepackten Electron-Ordner (vor NSIS).
 * @param {string} appOutDir
 * @returns {number} freigegebene Bytes
 */
function prunePackagedAppBloat(appOutDir) {
  let freed = 0

  const localesDir = path.join(appOutDir, 'locales')
  if (fs.existsSync(localesDir)) {
    for (const name of fs.readdirSync(localesDir)) {
      if (!name.endsWith('.pak') || ELECTRON_LOCALE_PAK_KEEP.has(name)) continue
      const filePath = path.join(localesDir, name)
      try {
        const stat = fs.statSync(filePath)
        fs.unlinkSync(filePath)
        freed += stat.size
      } catch {
        // ignore
      }
    }
  }

  for (const heavy of ['LICENSES.chromium.html']) {
    const filePath = path.join(appOutDir, heavy)
    if (!fs.existsSync(filePath)) continue
    try {
      const stat = fs.statSync(filePath)
      fs.unlinkSync(filePath)
      freed += stat.size
    } catch {
      // ignore
    }
  }

  return freed
}

/**
 * Bettet Chronell-Icon in die Windows-EXE ein — ohne winCodeSign (kein Symlink-Problem).
 * @param {import('app-builder-lib').AfterPackContext} context
 */
exports.default = async function afterPackEmbedIcon(context) {
  if (context.electronPlatformName !== 'win32') return

  const { packager, appOutDir } = context
  const projectDir = packager.info.projectDir

  const freed = prunePackagedAppBloat(appOutDir)
  if (freed > 0) {
    console.log(`[afterPack] Ballast entfernt: ${(freed / 1024 / 1024).toFixed(1)} MB`)
  }

  const exeName = `${packager.appInfo.productFilename}.exe`
  const exePath = path.join(appOutDir, exeName)
  const iconPath = path.join(projectDir, 'resources', 'icon.ico')

  if (!fs.existsSync(exePath)) {
    throw new Error(`[afterPack] EXE fehlt: ${exePath}`)
  }
  if (!fs.existsSync(iconPath)) {
    throw new Error(`[afterPack] icon.ico fehlt — zuerst: npm run sync-branding`)
  }

  const rcedit = require('rcedit')
  const appInfo = packager.appInfo

  const productName = appInfo.productName || 'Chronell'
  const companyName = packager.platformSpecificBuildOptions?.publisherName || 'Kurt Soeser'
  await rcedit(exePath, {
    icon: iconPath,
    'version-string': {
      FileDescription: productName,
      ProductName: productName,
      InternalName: productName,
      CompanyName: companyName,
      OriginalFilename: `${packager.appInfo.productFilename}.exe`,
      LegalCopyright: appInfo.copyright || ''
    },
    'file-version': appInfo.shortVersion || appInfo.version,
    'product-version': appInfo.shortVersionWindows || appInfo.version
  })

  console.log('[afterPack] Icon + Metadaten eingebettet:', exePath)
}
