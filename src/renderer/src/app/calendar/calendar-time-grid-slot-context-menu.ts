import type { ContextMenuItem } from '@/components/ContextMenu'
import {
  TIME_GRID_SLOT_MINUTES_MENU_ORDER,
  type TimeGridSlotMinutes
} from '@/app/calendar/calendar-shell-storage'

const TIME_GRID_AXIS_SELECTOR = [
  '.fc-timegrid-slot-label',
  '.fc-timegrid-axis',
  '.fc-timegrid-axis-cushion',
  '.fc-timegrid-slot-label-cushion',
  '.fc-timegrid-axis-frame'
].join(', ')

/** True wenn Rechtsklick auf die Uhrzeiten-Spalte (Zeitskala) zielt. */
export function isFcTimeGridAxisContextTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  return Boolean(target.closest(TIME_GRID_AXIS_SELECTOR))
}

export function buildTimeGridSlotMinutesContextMenuItems(opts: {
  current: TimeGridSlotMinutes
  labelForMinutes: (minutes: TimeGridSlotMinutes) => string
  onSelect: (minutes: TimeGridSlotMinutes) => void
}): ContextMenuItem[] {
  return TIME_GRID_SLOT_MINUTES_MENU_ORDER.map((minutes) => ({
    id: `time-grid-slot-${minutes}`,
    label: opts.labelForMinutes(minutes),
    selected: minutes === opts.current,
    onSelect: (): void => {
      if (minutes === opts.current) return
      opts.onSelect(minutes)
    }
  }))
}
