import type { CalendarShellColumnId } from '@/app/calendar/calendar-shell-column-order'

export type CalendarDockColumnWidthSetter = (updater: (w: number) => number) => void

export function resizeCalendarDockBetweenColumns(
  left: CalendarShellColumnId,
  right: CalendarShellColumnId,
  delta: number,
  setters: {
    zeitliste: CalendarDockColumnWidthSetter
    preview: CalendarDockColumnWidthSetter
    context: CalendarDockColumnWidthSetter
  }
): void {
  const setterFor = (id: CalendarShellColumnId): CalendarDockColumnWidthSetter | null => {
    if (id === 'zeitliste') return setters.zeitliste
    if (id === 'preview') return setters.preview
    if (id === 'context') return setters.context
    return null
  }

  if (right !== 'calendar') {
    const setRight = setterFor(right)
    if (setRight) setRight((w) => w - delta)
    return
  }
  if (left !== 'calendar') {
    const setLeft = setterFor(left)
    if (setLeft) setLeft((w) => w + delta)
  }
}
