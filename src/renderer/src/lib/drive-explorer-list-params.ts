import type { ComposeDriveExplorerNavCrumb, ComposeListDriveExplorerInput } from '@shared/types'
import type { ComposeDriveExplorerScope } from '@shared/types'

/** Graph-Explorer-Abruf-Parameter aus Scope + Brotkrumen (wie OneDriveExplorerDialog). */
export function buildDriveExplorerListParams(
  accountId: string,
  scope: ComposeDriveExplorerScope,
  crumbs: ComposeDriveExplorerNavCrumb[]
): ComposeListDriveExplorerInput {
  let folderId: string | null | undefined
  let folderDriveId: string | null | undefined
  let siteId: string | null | undefined

  if (scope === 'sharepoint') {
    if (crumbs.length === 0) {
      siteId = null
      folderId = undefined
      folderDriveId = undefined
    } else {
      const siteIdx = crumbs.findIndex((c) => Boolean(c.siteId))
      if (siteIdx === -1) {
        siteId = null
        folderId = undefined
        folderDriveId = undefined
      } else {
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
  } else {
    const last = crumbs[crumbs.length - 1]
    folderId = last?.id ?? undefined
    folderDriveId = last?.driveId ?? undefined
  }

  return {
    accountId,
    scope,
    ...(scope === 'recent'
      ? {}
      : {
          folderId: folderId ?? null,
          folderDriveId: folderDriveId ?? null
        }),
    ...(scope === 'sharepoint' ? { siteId: siteId ?? null } : {})
  }
}
