import { addMinutes } from 'date-fns'
import type { CalendarCreateRange } from '@/app/tasks/tasks-calendar-create-range'

export type ConnectionsCanvasCreateKind =
  | 'mail'
  | 'calendar_event'
  | 'task'
  | 'note'
  | 'contact'

export interface ConnectionsCanvasCreateAnchor {
  clientX: number
  clientY: number
  graphX: number
  graphY: number
}

/** Standard-Zeitfenster für „Neuer Termin“ auf dem Verbindungen-Canvas. */
export function defaultConnectionsCanvasCalendarRange(): CalendarCreateRange {
  const now = new Date()
  const start = new Date(now)
  start.setSeconds(0, 0)
  start.setMinutes(Math.ceil(start.getMinutes() / 15) * 15, 0, 0)
  const end = addMinutes(start, 30)
  return { start, end, allDay: false }
}
