export const DASHBOARD_PINNED_SHORTCUTS_STORAGE_KEY = 'mailclient.dashboardPinnedShortcuts.v1'
export const DASHBOARD_PINNED_SHORTCUTS_CHANGED_EVENT = 'mailclient:dashboard-pinned-shortcuts-changed'

export type DashboardPinnedShortcut =
  | { kind: 'custom_view'; viewId: string }
  | { kind: 'connection_island'; clusterKey: string }

export type DashboardPinnedShortcutEntry = DashboardPinnedShortcut & { id: string }

function newShortcutId(): string {
  return `dps-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function normalizeEntry(raw: unknown): DashboardPinnedShortcutEntry | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const id = typeof o.id === 'string' && o.id.trim() ? o.id.trim() : newShortcutId()
  const kind = o.kind
  if (kind === 'custom_view') {
    const viewId = typeof o.viewId === 'string' ? o.viewId.trim() : ''
    if (!viewId) return null
    return { id, kind: 'custom_view', viewId }
  }
  if (kind === 'connection_island') {
    const clusterKey = typeof o.clusterKey === 'string' ? o.clusterKey.trim() : ''
    if (!clusterKey) return null
    return { id, kind: 'connection_island', clusterKey }
  }
  return null
}

export function shortcutRefKey(entry: DashboardPinnedShortcut): string {
  return entry.kind === 'custom_view'
    ? `custom_view:${entry.viewId}`
    : `connection_island:${entry.clusterKey}`
}

function notifyChanged(): void {
  window.dispatchEvent(new Event(DASHBOARD_PINNED_SHORTCUTS_CHANGED_EVENT))
}

export function readDashboardPinnedShortcuts(): DashboardPinnedShortcutEntry[] {
  try {
    const raw = window.localStorage.getItem(DASHBOARD_PINNED_SHORTCUTS_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    const seen = new Set<string>()
    const out: DashboardPinnedShortcutEntry[] = []
    for (const item of parsed) {
      const entry = normalizeEntry(item)
      if (!entry) continue
      const ref = shortcutRefKey(entry)
      if (seen.has(ref)) continue
      seen.add(ref)
      out.push(entry)
    }
    return out
  } catch {
    return []
  }
}

export function writeDashboardPinnedShortcuts(entries: DashboardPinnedShortcutEntry[]): void {
  try {
    window.localStorage.setItem(DASHBOARD_PINNED_SHORTCUTS_STORAGE_KEY, JSON.stringify(entries))
    notifyChanged()
  } catch {
    // ignore
  }
}

export function isShortcutPinned(
  entries: readonly DashboardPinnedShortcutEntry[],
  shortcut: DashboardPinnedShortcut
): boolean {
  const ref = shortcutRefKey(shortcut)
  return entries.some((e) => shortcutRefKey(e) === ref)
}

export function addDashboardPinnedShortcut(
  entries: readonly DashboardPinnedShortcutEntry[],
  shortcut: DashboardPinnedShortcut
): DashboardPinnedShortcutEntry[] {
  if (isShortcutPinned(entries, shortcut)) return [...entries]
  return [...entries, { ...shortcut, id: newShortcutId() }]
}

export function removeDashboardPinnedShortcut(
  entries: readonly DashboardPinnedShortcutEntry[],
  id: string
): DashboardPinnedShortcutEntry[] {
  return entries.filter((e) => e.id !== id)
}

export function reorderDashboardPinnedShortcuts(
  entries: readonly DashboardPinnedShortcutEntry[],
  orderedIds: readonly string[]
): DashboardPinnedShortcutEntry[] {
  const byId = new Map(entries.map((e) => [e.id, e] as const))
  const next: DashboardPinnedShortcutEntry[] = []
  for (const id of orderedIds) {
    const e = byId.get(id)
    if (e) next.push(e)
  }
  for (const e of entries) {
    if (!next.includes(e)) next.push(e)
  }
  return next
}
