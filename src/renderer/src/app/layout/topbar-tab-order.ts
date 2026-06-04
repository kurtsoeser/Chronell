import { arrayMove } from '@dnd-kit/sortable'
import type { AppShellMode } from '@/stores/app-mode'
import {
  DEFAULT_TOPBAR_MODULE_ORDER,
  persistTopbarModuleOrder,
  readTopbarModuleOrder,
  reconcileTopbarModuleOrder
} from '@/app/layout/topbar-module-order'
import {
  readCustomViewTopbarOrder,
  writeCustomViewTopbarOrder
} from '@/app/custom-views/custom-views-storage'

export const TOPBAR_TAB_CUSTOM_VIEW_PREFIX = 'customView:'

const UNIFIED_STORAGE_KEY = 'mailclient.topbarTabsOrder.v1'

const MODULE_ALLOWED = new Set<string>(DEFAULT_TOPBAR_MODULE_ORDER)

export type TopbarModuleId = Exclude<AppShellMode, 'customView'>

export type TopbarTabId = string

export function topbarTabCustomViewId(viewId: string): string {
  return `${TOPBAR_TAB_CUSTOM_VIEW_PREFIX}${viewId}`
}

export function parseTopbarTabCustomViewId(tabId: string): string | null {
  if (!tabId.startsWith(TOPBAR_TAB_CUSTOM_VIEW_PREFIX)) return null
  const viewId = tabId.slice(TOPBAR_TAB_CUSTOM_VIEW_PREFIX.length).trim()
  return viewId || null
}

export function isTopbarCustomViewTabId(tabId: string): boolean {
  return parseTopbarTabCustomViewId(tabId) != null
}

export function isTopbarModuleTabId(tabId: string): tabId is TopbarModuleId {
  return MODULE_ALLOWED.has(tabId)
}

export function reconcileTopbarTabOrder(
  candidate: readonly TopbarTabId[],
  canonicalModules: readonly AppShellMode[],
  viewIds: readonly string[]
): TopbarTabId[] {
  const allowedModules = new Set(
    canonicalModules.filter((m) => m !== 'customView')
  )
  const allowedViews = new Set(viewIds)
  const seen = new Set<string>()
  const out: TopbarTabId[] = []

  for (const raw of candidate) {
    const viewId = parseTopbarTabCustomViewId(raw)
    if (viewId) {
      if (!allowedViews.has(viewId) || seen.has(raw)) continue
      seen.add(raw)
      out.push(topbarTabCustomViewId(viewId))
      continue
    }
    if (!isTopbarModuleTabId(raw) || !allowedModules.has(raw) || seen.has(raw)) continue
    seen.add(raw)
    out.push(raw)
  }

  for (const m of canonicalModules) {
    if (m === 'customView' || seen.has(m)) continue
    seen.add(m)
    out.push(m)
  }
  for (const viewId of viewIds) {
    const tab = topbarTabCustomViewId(viewId)
    if (seen.has(tab)) continue
    seen.add(tab)
    out.push(tab)
  }
  return out
}

function migrateTopbarTabOrderFromLegacy(viewIds: readonly string[]): TopbarTabId[] {
  const modules = readTopbarModuleOrder().filter((m) => m !== 'customView')
  const views = reconcileCustomViewIds(viewIds, readCustomViewTopbarOrder())
  return [...modules, ...views.map((id) => topbarTabCustomViewId(id))]
}

function reconcileCustomViewIds(
  allViewIds: readonly string[],
  order: readonly string[]
): string[] {
  const ids = new Set(allViewIds)
  const seen = new Set<string>()
  const out: string[] = []
  for (const id of order) {
    if (!ids.has(id) || seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  for (const id of allViewIds) {
    if (!seen.has(id)) out.push(id)
  }
  return out
}

export function readTopbarTabOrder(viewIds: readonly string[]): TopbarTabId[] {
  try {
    const raw = window.localStorage.getItem(UNIFIED_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as unknown
      if (Array.isArray(parsed)) {
        const ids = parsed.filter((x): x is string => typeof x === 'string')
        return reconcileTopbarTabOrder(ids, DEFAULT_TOPBAR_MODULE_ORDER, viewIds)
      }
    }
  } catch {
    // ignore
  }
  return reconcileTopbarTabOrder(
    migrateTopbarTabOrderFromLegacy(viewIds),
    DEFAULT_TOPBAR_MODULE_ORDER,
    viewIds
  )
}

export function persistTopbarTabOrder(
  order: readonly TopbarTabId[],
  allViewIds: readonly string[]
): void {
  const reconciled = reconcileTopbarTabOrder(
    order,
    DEFAULT_TOPBAR_MODULE_ORDER,
    allViewIds
  )
  try {
    window.localStorage.setItem(UNIFIED_STORAGE_KEY, JSON.stringify(reconciled))
  } catch {
    // ignore
  }
  const modules = reconciled.filter(isTopbarModuleTabId)
  const views = reconciled
    .map((id) => parseTopbarTabCustomViewId(id))
    .filter((id): id is string => id != null)
  persistTopbarModuleOrder(reconcileTopbarModuleOrder(modules, DEFAULT_TOPBAR_MODULE_ORDER))
  writeCustomViewTopbarOrder(reconcileCustomViewIds(views, views))
}

export function readVisibleTopbarTabOrder(
  fullOrder: readonly TopbarTabId[],
  hiddenModules: ReadonlySet<AppShellMode>
): TopbarTabId[] {
  return fullOrder.filter((id) => {
    if (isTopbarCustomViewTabId(id)) return true
    return isTopbarModuleTabId(id) && !hiddenModules.has(id)
  })
}

/** Sichtbare Tabs umsortieren; ausgeblendete Module behalten ihre Position im Gesamtarray. */
export function reorderVisibleTopbarTabs(
  fullOrder: readonly TopbarTabId[],
  hiddenModules: ReadonlySet<AppShellMode>,
  activeId: TopbarTabId,
  overId: TopbarTabId
): TopbarTabId[] {
  const visible = readVisibleTopbarTabOrder(fullOrder, hiddenModules)
  const oldIndex = visible.indexOf(activeId)
  const newIndex = visible.indexOf(overId)
  if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) {
    return [...fullOrder]
  }
  const nextVisible = arrayMove(visible, oldIndex, newIndex)
  let vi = 0
  return fullOrder.map((id) => {
    const isVisible =
      isTopbarCustomViewTabId(id) ||
      (isTopbarModuleTabId(id) && !hiddenModules.has(id))
    if (!isVisible) return id
    return nextVisible[vi++]!
  })
}

/** Modul-Reihenfolge aus Einstellungen: eigene Ansichten bleiben an ihren Positionen. */
export function mergeTopbarTabOrderAfterModulePrefsChange(
  prev: readonly TopbarTabId[],
  newModuleOrder: readonly AppShellMode[],
  viewIds: readonly string[]
): TopbarTabId[] {
  const modules = newModuleOrder.filter((m) => m !== 'customView')
  const moduleQueue = [...modules]
  const out: TopbarTabId[] = []
  let mi = 0

  for (const id of prev) {
    const viewId = parseTopbarTabCustomViewId(id)
    if (viewId) {
      if (viewIds.includes(viewId)) out.push(topbarTabCustomViewId(viewId))
      continue
    }
    if (isTopbarModuleTabId(id) && mi < moduleQueue.length) {
      out.push(moduleQueue[mi++]!)
    }
  }
  while (mi < moduleQueue.length) out.push(moduleQueue[mi++]!)
  for (const viewId of viewIds) {
    const tab = topbarTabCustomViewId(viewId)
    if (!out.includes(tab)) out.push(tab)
  }
  return reconcileTopbarTabOrder(out, newModuleOrder, viewIds)
}
