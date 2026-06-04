import type { AppShellMode } from '@/stores/app-mode'
import {
  DEFAULT_TOPBAR_MODULE_ORDER,
  readTopbarModuleOrder,
  reconcileTopbarModuleOrder,
  persistTopbarModuleOrder
} from '@/app/layout/topbar-module-order'

export const TOPBAR_MODULE_PREFS_CHANGED_EVENT = 'mailclient:topbar-module-prefs-changed'

/** Standardmäßig ausgeblendet (z. B. Modul „Alle Arbeit“). */
export const DEFAULT_TOPBAR_HIDDEN_MODULES: readonly AppShellMode[] = ['work', 'layoutStudio']

const HIDDEN_STORAGE_KEY = 'mailclient.topbarModuleHidden.v1'
const ALLOWED = new Set<string>(DEFAULT_TOPBAR_MODULE_ORDER)

function notifyPrefsChanged(): void {
  window.dispatchEvent(new Event(TOPBAR_MODULE_PREFS_CHANGED_EVENT))
}

function normalizeHidden(candidate: string[]): Set<AppShellMode> {
  const out = new Set<AppShellMode>()
  for (const raw of candidate) {
    if (!ALLOWED.has(raw)) continue
    out.add(raw as AppShellMode)
  }
  return out
}

/** Gespeicherte ausgeblendete Module; ohne Eintrag gilt {@link DEFAULT_TOPBAR_HIDDEN_MODULES}. */
export function readTopbarModuleHiddenSet(): Set<AppShellMode> {
  try {
    const raw = window.localStorage.getItem(HIDDEN_STORAGE_KEY)
    if (raw == null) return new Set(DEFAULT_TOPBAR_HIDDEN_MODULES)
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return new Set(DEFAULT_TOPBAR_HIDDEN_MODULES)
    const ids = parsed.filter((x): x is string => typeof x === 'string')
    return normalizeHidden(ids)
  } catch {
    return new Set(DEFAULT_TOPBAR_HIDDEN_MODULES)
  }
}

export function persistTopbarModuleHiddenSet(hidden: ReadonlySet<AppShellMode>): void {
  const ids = DEFAULT_TOPBAR_MODULE_ORDER.filter((id) => hidden.has(id))
  try {
    window.localStorage.setItem(HIDDEN_STORAGE_KEY, JSON.stringify(ids))
  } catch {
    // ignore
  }
  notifyPrefsChanged()
}

export function isTopbarModuleVisible(
  id: AppShellMode,
  hidden: ReadonlySet<AppShellMode> = readTopbarModuleHiddenSet()
): boolean {
  return !hidden.has(id)
}

export function readVisibleTopbarModuleOrder(
  order: readonly AppShellMode[] = readTopbarModuleOrder(),
  hidden: ReadonlySet<AppShellMode> = readTopbarModuleHiddenSet()
): AppShellMode[] {
  return order.filter((id) => !hidden.has(id))
}

/** Erstes sichtbares Modul in der Topbar-Reihenfolge (Fallback: Start). */
export function firstVisibleTopbarModule(
  order: readonly AppShellMode[] = readTopbarModuleOrder(),
  hidden: ReadonlySet<AppShellMode> = readTopbarModuleHiddenSet()
): AppShellMode {
  const visible = readVisibleTopbarModuleOrder(order, hidden)
  return visible[0] ?? 'home'
}

/** Bevorzugtes Modul, falls ausgeblendet nacheinander Alternativen, sonst erstes Sichtbares. */
export function resolveVisibleAppShellMode(
  preferred: AppShellMode,
  alternates: readonly AppShellMode[] = [],
  order: readonly AppShellMode[] = readTopbarModuleOrder(),
  hidden: ReadonlySet<AppShellMode> = readTopbarModuleHiddenSet()
): AppShellMode {
  if (!hidden.has(preferred)) return preferred
  for (const alt of alternates) {
    if (!hidden.has(alt)) return alt
  }
  return firstVisibleTopbarModule(order, hidden)
}

/** Reihenfolge nur der sichtbaren Tabs anpassen; ausgeblendete behalten ihre relative Position. */
export function reorderVisibleTopbarModules(
  fullOrder: readonly AppShellMode[],
  hidden: ReadonlySet<AppShellMode>,
  activeId: AppShellMode,
  overId: AppShellMode
): AppShellMode[] {
  const visible = fullOrder.filter((id) => !hidden.has(id))
  const oldIndex = visible.indexOf(activeId)
  const newIndex = visible.indexOf(overId)
  if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) {
    return [...fullOrder]
  }
  const nextVisible = [...visible]
  const [moved] = nextVisible.splice(oldIndex, 1)
  nextVisible.splice(newIndex, 0, moved!)
  let vi = 0
  return fullOrder.map((id) => (hidden.has(id) ? id : nextVisible[vi++]!))
}

export function setTopbarModuleVisible(id: AppShellMode, visible: boolean): void {
  const hidden = readTopbarModuleHiddenSet()
  const next = new Set(hidden)
  if (visible) {
    next.delete(id)
  } else {
    const order = readTopbarModuleOrder()
    const wouldRemain = order.filter((m) => m !== id && !next.has(m))
    if (wouldRemain.length === 0) return
    next.add(id)
  }
  persistTopbarModuleHiddenSet(next)
}

export function applyTopbarModulePrefsFromSettings(
  order: readonly AppShellMode[],
  hidden: ReadonlySet<AppShellMode>
): void {
  const reconciled = reconcileTopbarModuleOrder(order, DEFAULT_TOPBAR_MODULE_ORDER)
  persistTopbarModuleOrder(reconciled)
  persistTopbarModuleHiddenSet(hidden)
}
