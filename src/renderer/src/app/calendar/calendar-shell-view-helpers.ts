import type { TFunction } from 'i18next'
import { addDays, format } from 'date-fns'
import type { CalendarEventView } from '@shared/types'
import { GANTT_TIMELINE_VIEW_ID } from '@/app/calendar/calendar-gantt-scale'

export { GANTT_TIMELINE_VIEW_ID }

/** Maximale Tage in einer `timeGridNDay`-Ansicht (Mini-Kalender-Ziehen + Menü). */
export const MAX_TIME_GRID_SPAN_DAYS = 21

export function viewIdToLabel(viewId: string, tr: TFunction): string {
  if (viewId === GANTT_TIMELINE_VIEW_ID) return tr('calendar.views.ganttTimeline')
  if (viewId === 'timeGridDay') return tr('calendar.views.day')
  if (viewId === 'timeGridWeek') return tr('calendar.views.week')
  if (viewId === 'dayGridMonth') return tr('calendar.views.month')
  if (viewId === 'multiMonthYear') return tr('calendar.views.year')
  if (viewId === 'multiMonthQuarter') return tr('calendar.views.quarterYear')
  if (viewId === 'listWeek') return tr('calendar.views.list')
  const m = /^timeGrid(\d+)Day$/.exec(viewId)
  if (m) return tr('calendar.views.nDays', { count: Number(m[1]) })
  return tr('calendar.views.week')
}

/**
 * Graph-Kalender-ID fuer PATCH/Drag: explizit am Termin, sonst Standardkalender des Kontos.
 * Microsoft: `null` ist gueltig (`/me/events/{id}`).
 */
export function resolveCalendarEventGraphCalendarId(
  ev: CalendarEventView,
  defaultByAccount: Record<string, string | null>
): string | null {
  const explicit = ev.graphCalendarId?.trim()
  if (explicit) return explicit
  const fallback = defaultByAccount[ev.accountId]?.trim()
  if (ev.source === 'google') return fallback || 'primary'
  return fallback || null
}

/** FullCalendar → Graph PATCH (Ganztaegig: `end` = exklusives Datum wie bei Graph/FC). */
export function fullCalendarEventToPatchSchedule(ev: {
  start: Date | null
  end: Date | null
  allDay: boolean
}): { startIso: string; endIso: string; isAllDay: boolean } | null {
  if (!ev.start) return null
  if (ev.allDay) {
    const startIso = format(ev.start, 'yyyy-MM-dd')
    const endIso = ev.end ? format(ev.end, 'yyyy-MM-dd') : format(addDays(ev.start, 1), 'yyyy-MM-dd')
    return { startIso, endIso, isAllDay: true }
  }
  if (!ev.end) return null
  return { startIso: ev.start.toISOString(), endIso: ev.end.toISOString(), isAllDay: false }
}
