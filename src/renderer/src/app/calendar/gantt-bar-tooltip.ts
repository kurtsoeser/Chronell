import { format } from 'date-fns'
import { de as deFns, enUS as enUSFns } from 'date-fns/locale'
import type { WorkItem } from '@shared/work-item'
import type { GanttBarInterval } from '@/app/calendar/calendar-gantt-layout'

export function formatGanttBarTooltip(
  item: WorkItem,
  interval: GanttBarInterval,
  localeCode: string
): string {
  const locale = localeCode.startsWith('de') ? deFns : enUSFns
  const title = item.title?.trim() || '—'
  if (interval.allDay) {
    const start = new Date(interval.startMs)
    const endInclusive = new Date(interval.endMs - 1)
    const sameDay =
      start.getFullYear() === endInclusive.getFullYear() &&
      start.getMonth() === endInclusive.getMonth() &&
      start.getDate() === endInclusive.getDate()
    if (sameDay) {
      return `${title}\n${format(start, 'd. MMMM yyyy', { locale })}`
    }
    return `${title}\n${format(start, 'd. MMM yyyy', { locale })} – ${format(endInclusive, 'd. MMM yyyy', { locale })}`
  }
  const start = new Date(interval.startMs)
  const end = new Date(interval.endMs)
  const sameDay =
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth() &&
    start.getDate() === end.getDate()
  if (sameDay) {
    return `${title}\n${format(start, 'd. MMM yyyy', { locale })}, ${format(start, 'HH:mm', { locale })} – ${format(end, 'HH:mm', { locale })}`
  }
  return `${title}\n${format(start, 'd. MMM yyyy, HH:mm', { locale })} – ${format(end, 'd. MMM yyyy, HH:mm', { locale })}`
}
