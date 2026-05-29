import type { ComposeDriveExplorerNavCrumb, ComposeDriveExplorerScope } from '@shared/types'

/** Vergleicht zwei Explorer-Pfade (Scope + Brotkrumen). */
export function driveExplorerCrumbsMatch(
  scopeA: ComposeDriveExplorerScope,
  crumbsA: ComposeDriveExplorerNavCrumb[] | null | undefined,
  scopeB: ComposeDriveExplorerScope,
  crumbsB: ComposeDriveExplorerNavCrumb[]
): boolean {
  if (scopeA !== scopeB) return false
  if (!Array.isArray(crumbsA) || !Array.isArray(crumbsB)) return false
  if (crumbsA.length !== crumbsB.length) return false
  return crumbsA.every((c, i) => {
    const d = crumbsB[i]!
    if (
      c.name !== d.name ||
      (c.driveId ?? null) !== (d.driveId ?? null) ||
      (c.siteId ?? null) !== (d.siteId ?? null)
    ) {
      return false
    }
    if (c.id === d.id) return true
    if (scopeA !== 'sharepoint') return false
    const cd = (c.driveId ?? '').trim()
    const dd = (d.driveId ?? '').trim()
    if (!cd || cd !== dd) return false
    const cLibRoot =
      c.id == null || String(c.id).trim() === '' || String(c.id).trim() === cd
    const dLibRoot =
      d.id == null || String(d.id).trim() === '' || String(d.id).trim() === dd
    return cLibRoot && dLibRoot
  })
}
