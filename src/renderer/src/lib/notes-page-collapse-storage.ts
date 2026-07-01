const STORAGE_KEY = 'mailclient.notes.pageTreeCollapsed.v1'

export function readNotesPageTreeCollapsed(): Set<number> {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed.filter((id): id is number => typeof id === 'number' && id > 0))
  } catch {
    return new Set()
  }
}

export function persistNotesPageTreeCollapsed(collapsed: ReadonlySet<number>): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...collapsed]))
  } catch {
    // ignore
  }
}

export function toggleNotesPageTreeCollapsed(noteId: number): Set<number> {
  const next = readNotesPageTreeCollapsed()
  if (next.has(noteId)) next.delete(noteId)
  else next.add(noteId)
  persistNotesPageTreeCollapsed(next)
  return next
}
