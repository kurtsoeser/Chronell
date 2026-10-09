/** Angedockte Hauptspalten in der Kalender-Shell (ohne linke Nav). */
export type CalendarShellColumnId = 'calendar' | 'zeitliste' | 'preview' | 'context'

export const CALENDAR_SHELL_COLUMN_IDS: readonly CalendarShellColumnId[] = [
  'calendar',
  'zeitliste',
  'preview',
  'context'
]

export const DEFAULT_CALENDAR_SHELL_COLUMN_ORDER: readonly CalendarShellColumnId[] = [
  'calendar',
  'zeitliste',
  'preview',
  'context'
]

const STORAGE_KEY = 'mailclient.calendar.shellColumnOrder.v1'

function isColumnId(raw: unknown): raw is CalendarShellColumnId {
  return (
    raw === 'calendar' ||
    raw === 'zeitliste' ||
    raw === 'preview' ||
    raw === 'context'
  )
}

export function normalizeCalendarShellColumnOrder(raw: unknown): CalendarShellColumnId[] {
  if (!Array.isArray(raw)) return [...DEFAULT_CALENDAR_SHELL_COLUMN_ORDER]
  const ids = raw.filter(isColumnId)
  if (ids.length !== CALENDAR_SHELL_COLUMN_IDS.length) {
    return [...DEFAULT_CALENDAR_SHELL_COLUMN_ORDER]
  }
  if (new Set(ids).size !== ids.length) return [...DEFAULT_CALENDAR_SHELL_COLUMN_ORDER]
  return ids
}

export function readCalendarShellColumnOrder(): CalendarShellColumnId[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return [...DEFAULT_CALENDAR_SHELL_COLUMN_ORDER]
    return normalizeCalendarShellColumnOrder(JSON.parse(raw))
  } catch {
    return [...DEFAULT_CALENDAR_SHELL_COLUMN_ORDER]
  }
}

export function persistCalendarShellColumnOrder(order: readonly CalendarShellColumnId[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(order))
  } catch {
    // ignore
  }
}

export function moveCalendarShellColumn(
  order: readonly CalendarShellColumnId[],
  id: CalendarShellColumnId,
  delta: -1 | 1
): CalendarShellColumnId[] {
  const i = order.indexOf(id)
  if (i < 0) return [...order]
  const j = i + delta
  if (j < 0 || j >= order.length) return [...order]
  const next = [...order]
  const tmp = next[i]!
  next[i] = next[j]!
  next[j] = tmp
  return next
}
