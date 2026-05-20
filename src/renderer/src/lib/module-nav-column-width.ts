import { useResizableWidth } from '@/components/ResizableSplitter'

/** Einheitliche Breite der ersten Spalte (Navigation) in allen Modulen. */
export const MODULE_NAV_COLUMN_WIDTH_KEY = 'mailclient.moduleNavColumnWidth.v1'

export const MODULE_NAV_COLUMN_WIDTH_DEFAULT = 256
export const MODULE_NAV_COLUMN_WIDTH_MIN = 180
export const MODULE_NAV_COLUMN_WIDTH_MAX = 480

/** Frühere modulspezifische Keys — einmalige Migration beim ersten Lesen. */
export const MODULE_NAV_COLUMN_LEGACY_KEYS = [
  'mailclient.sidebarWidth',
  'mailclient.tasksSidebarWidth',
  'mailclient.notesShell.navWidth',
  'mailclient.peopleShell.navWidth',
  'mailclient.bookingsShell.navWidth',
  'mailclient.connections.paletteWidth'
] as const

export function readModuleNavColumnWidth(
  min = MODULE_NAV_COLUMN_WIDTH_MIN,
  max = MODULE_NAV_COLUMN_WIDTH_MAX
): number {
  const clamp = (n: number): number => Math.min(max, Math.max(min, n))
  try {
    const stored = window.localStorage.getItem(MODULE_NAV_COLUMN_WIDTH_KEY)
    if (stored) {
      const parsed = Number(stored)
      if (Number.isFinite(parsed)) return clamp(parsed)
    }
    for (const legacyKey of MODULE_NAV_COLUMN_LEGACY_KEYS) {
      const legacy = window.localStorage.getItem(legacyKey)
      if (!legacy) continue
      const parsed = Number(legacy)
      if (!Number.isFinite(parsed)) continue
      const value = clamp(parsed)
      window.localStorage.setItem(MODULE_NAV_COLUMN_WIDTH_KEY, String(value))
      return value
    }
  } catch {
    // ignore
  }
  return MODULE_NAV_COLUMN_WIDTH_DEFAULT
}

export function useModuleNavColumnWidth(): [
  number,
  (next: number | ((prev: number) => number)) => void
] {
  return useResizableWidth({
    storageKey: MODULE_NAV_COLUMN_WIDTH_KEY,
    defaultWidth: readModuleNavColumnWidth(),
    minWidth: MODULE_NAV_COLUMN_WIDTH_MIN,
    maxWidth: MODULE_NAV_COLUMN_WIDTH_MAX,
    legacyStorageKeys: MODULE_NAV_COLUMN_LEGACY_KEYS
  })
}
