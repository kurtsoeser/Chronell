import {
  MULTI_MONTH_QUARTER_VIEW_ID,
  MULTI_MONTH_YEAR_VIEW_ID
} from '@/app/calendar/calendar-fc-multimonth'
import { GANTT_TIMELINE_VIEW_ID } from '@/app/calendar/calendar-gantt-scale'

/** Reihenfolge wie im Kalender-Ansichtsmenü (fein → grob). */
export const MAIN_CALENDAR_VIEW_ZOOM_LADDER = [
  'timeGridDay',
  'timeGridWeek',
  'dayGridMonth',
  MULTI_MONTH_YEAR_VIEW_ID,
  MULTI_MONTH_QUARTER_VIEW_ID,
  'listWeek',
  GANTT_TIMELINE_VIEW_ID
] as const

/** Aufgaben-Kalender (ohne Jahr / Zeitleiste). */
export const TASKS_CALENDAR_VIEW_ZOOM_LADDER = [
  'timeGridDay',
  'timeGridWeek',
  'dayGridMonth',
  'listWeek'
] as const

export type CalendarViewZoomDirection = 'in' | 'out'

function ladderIndex(viewId: string, ladder: readonly string[]): number {
  const direct = ladder.indexOf(viewId)
  if (direct >= 0) return direct
  if (viewId === 'timeGridDay') return 0
  const multiDay = /^timeGrid(\d+)Day$/.exec(viewId)
  if (multiDay) {
    const n = Number(multiDay[1])
    if (n <= 1) return 0
    const weekIdx = ladder.indexOf('timeGridWeek')
    return weekIdx >= 0 ? weekIdx : 0
  }
  const weekIdx = ladder.indexOf('timeGridWeek')
  return weekIdx >= 0 ? weekIdx : 0
}

/** Nächste Ansicht beim Zoomen (in = feiner, out = gröber). */
export function stepCalendarViewInZoomLadder(
  activeViewId: string,
  direction: CalendarViewZoomDirection,
  ladder: readonly string[] = MAIN_CALENDAR_VIEW_ZOOM_LADDER
): string | null {
  const idx = ladderIndex(activeViewId, ladder)
  const nextIdx = direction === 'in' ? idx - 1 : idx + 1
  if (nextIdx < 0 || nextIdx >= ladder.length) return null
  return ladder[nextIdx] ?? null
}
