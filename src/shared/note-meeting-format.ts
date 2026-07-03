import type { Locale } from 'date-fns'
import { addDays, format, parseISO } from 'date-fns'
import type { CalendarEventView } from './types'

export function formatNoteMeetingEventRangeLabel(
  ev: Pick<CalendarEventView, 'startIso' | 'endIso' | 'isAllDay'>,
  locale: Locale,
  allDaySuffix: string
): string {
  const start = parseISO(ev.startIso)
  const end = parseISO(ev.endIso)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return `${ev.startIso} – ${ev.endIso}`
  }
  if (ev.isAllDay) {
    const a = format(start, 'PPP', { locale })
    const b = format(addDays(end, -1), 'PPP', { locale })
    if (a === b) return `${a} ${allDaySuffix}`
    return `${a} – ${b} ${allDaySuffix}`
  }
  if (format(start, 'yyyy-MM-dd') === format(end, 'yyyy-MM-dd')) {
    return `${format(start, 'EEE, d. MMM yyyy', { locale })} · ${format(start, 'HH:mm')} – ${format(end, 'HH:mm')}`
  }
  return `${format(start, 'Pp', { locale })} – ${format(end, 'Pp', { locale })}`
}
