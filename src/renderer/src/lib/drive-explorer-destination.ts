import type { FilesDriveUploadDestinationPick } from '@shared/files'
import type {
  ComposeDriveExplorerNavCrumb,
  ComposeDriveExplorerScope
} from '@shared/types'

function rootLabelForScope(scope: ComposeDriveExplorerScope): string {
  switch (scope) {
    case 'recent':
      return 'Zuletzt'
    case 'myfiles':
      return 'Meine Dateien'
    case 'sharepoint':
      return 'SharePoint'
    case 'shared':
      return 'Mit mir geteilt'
  }
}

/** Aktueller Explorer-Pfad als Upload-Ziel (Brotkrumen + IDs). */
export function buildFilesDriveUploadDestination(
  accountId: string,
  scope: ComposeDriveExplorerScope,
  crumbs: ComposeDriveExplorerNavCrumb[]
): FilesDriveUploadDestinationPick {
  const root = rootLabelForScope(scope)
  let folderId: string | null = null
  let folderDriveId: string | null = null
  let siteId: string | null = null

  if (scope === 'sharepoint') {
    if (crumbs.length > 0) {
      const siteIdx = crumbs.findIndex((c) => Boolean(c.siteId))
      if (siteIdx >= 0) {
        const siteCrumb = crumbs[siteIdx]!
        const tail = crumbs.slice(siteIdx + 1)
        if (tail.length === 0) {
          siteId = siteCrumb.siteId ?? null
          folderId = null
          folderDriveId = null
        } else {
          const last = tail[tail.length - 1]!
          siteId = siteCrumb.siteId ?? null
          folderDriveId = last.driveId ?? null
          folderId = last.id
        }
      }
    }
  } else if (scope !== 'recent') {
    const last = crumbs[crumbs.length - 1]
    folderId = last?.id ?? null
    folderDriveId = last?.driveId ?? null
  }

  const folderLabel =
    crumbs.length === 0 ? root : `${root} / ${crumbs.map((c) => c.name).join(' / ')}`

  return {
    accountId,
    scope,
    folderId,
    folderDriveId,
    siteId,
    folderLabel
  }
}

/** Ob „Hier speichern“ an der aktuellen Stelle erlaubt ist. */
export function canSaveToCurrentExplorerPath(
  scope: ComposeDriveExplorerScope,
  crumbs: ComposeDriveExplorerNavCrumb[]
): boolean {
  if (scope === 'recent') return false
  if (scope === 'sharepoint') {
    if (crumbs.length === 0) return false
    const siteIdx = crumbs.findIndex((c) => Boolean(c.siteId))
    if (siteIdx === -1) return false
    const tail = crumbs.slice(siteIdx + 1)
    if (tail.length === 0) return false
    const last = tail[tail.length - 1]!
    return Boolean(last.driveId?.trim())
  }
  return true
}
