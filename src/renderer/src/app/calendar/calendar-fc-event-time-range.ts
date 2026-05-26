import type { EventContentArg } from '@fullcalendar/core'
import { format } from 'date-fns'

export const DAY_GRID_MONTH_VIEW_ID = 'dayGridMonth'

export function isDayGridMonthFcView(viewType: string): boolean {
  return viewType === DAY_GRID_MONTH_VIEW_ID
}

function formatHhMm(d: Date): string {
  return format(d, 'HH:mm')
}

/** Monatsansicht: Start- und Endzeit als „HH:mm - HH:mm“. */
export function formatFcEventTimeRangeText(arg: EventContentArg): string | null {
  if (arg.event.allDay) return null
  const start = arg.event.start
  if (!start) return arg.timeText?.trim() || null

  const end = arg.event.end
  if (!end) return formatHhMm(start)

  const startDay = format(start, 'yyyy-MM-dd')
  const endDay = format(end, 'yyyy-MM-dd')
  if (startDay === endDay) {
    return `${formatHhMm(start)} - ${formatHhMm(end)}`
  }

  return `${formatHhMm(start)} - ${formatHhMm(end)}`
}
