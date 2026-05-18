'use strict'

const path = require('node:path')
const fs = require('node:fs')

/**
 * Bettet Chronell-Icon in die Windows-EXE ein — ohne winCodeSign (kein Symlink-Problem).
 * @param {import('app-builder-lib').AfterPackContext} context
 */
exports.default = async function afterPackEmbedIcon(context) {
  if (context.electronPlatformName !== 'win32') return

  const { packager, appOutDir } = context
  const projectDir = packager.info.projectDir
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
