import type { CalendarEventView, CalendarGraphCalendarRow } from '@shared/types'
import { resolveCalendarDisplayHex } from '@shared/graph-calendar-colors'
import { SIDEBAR_DEFAULT_CAL_ID } from '@/app/calendar/calendar-shell-storage'

export function buildCalendarDisplayHexByKey(
  accountIds: readonly string[],
  calendarsByAccount: Record<string, CalendarGraphCalendarRow[] | undefined>
): Record<string, Record<string, string | null>> {
  const m: Record<string, Record<string, string | null>> = {}
  for (const accountId of accountIds) {
    const inner: Record<string, string | null> = {}
    for (const row of calendarsByAccount[accountId] ?? []) {
      inner[row.id] = resolveCalendarDisplayHex(row)
    }
    m[accountId] = inner
  }
  return m
}

export function buildDefaultGraphCalendarIdByAccount(
  accountIds: readonly string[],
  calendarsByAccount: Record<string, CalendarGraphCalendarRow[] | undefined>
): Record<string, string | null> {
  const m: Record<string, string | null> = {}
  for (const accountId of accountIds) {
    const rows = calendarsByAccount[accountId]
    if (!rows?.length) {
      m[accountId] = null
      continue
    }
    m[accountId] = rows.find((r) => r.isDefaultCalendar)?.id ?? rows[0]?.id ?? null
  }
  return m
}

/** Wie in CalendarShell: Sidebar-Kalenderliste (inkl. Overrides) vor Termin-Hex. */
export function resolveGraphEventDisplayHex(
  ev: CalendarEventView,
  defaultGraphCalendarIdByAccount: Record<string, string | null>,
  calendarDisplayHexByKey: Record<string, Record<string, string | null>>
): string | null {
  const defId = defaultGraphCalendarIdByAccount[ev.accountId]
  const calIdRaw = (ev.graphCalendarId?.trim() || defId || SIDEBAR_DEFAULT_CAL_ID).trim()
  const lookupId =
    calIdRaw === SIDEBAR_DEFAULT_CAL_ID && defId
      ? defId
      : calIdRaw !== SIDEBAR_DEFAULT_CAL_ID
        ? calIdRaw
        : null
  const fromCalList =
    lookupId && ev.source === 'microsoft'
      ? (calendarDisplayHexByKey[ev.accountId]?.[lookupId] ?? null)
      : null
  return fromCalList ?? ev.displayColorHex ?? null
}
