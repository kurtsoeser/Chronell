import { useEffect, useRef, type RefObject } from 'react'
import type { ContextMenuItem } from '@/components/ContextMenu'
import {
  buildTimeGridSlotMinutesContextMenuItems,
  isFcTimeGridAxisContextTarget
} from '@/app/calendar/calendar-time-grid-slot-context-menu'
import type { TimeGridSlotMinutes } from '@/app/calendar/calendar-shell-storage'

export interface UseTimeGridSlotScaleContextMenuOptions {
  enabled?: boolean
  slotMinutes: TimeGridSlotMinutes
  onSlotMinutesChange: (min: TimeGridSlotMinutes) => void
  labelForMinutes: (minutes: TimeGridSlotMinutes) => string
  onOpen: (x: number, y: number, items: ContextMenuItem[]) => void
}

/** Rechtsklick auf die Zeitskala (Uhrzeiten) → Rasterweite wählen (wie Outlook). */
export function useTimeGridSlotScaleContextMenu(
  hostRef: RefObject<HTMLElement | null>,
  opts: UseTimeGridSlotScaleContextMenuOptions
): void {
  const { enabled = true, slotMinutes, onSlotMinutesChange, labelForMinutes, onOpen } = opts
  const slotMinutesRef = useRef(slotMinutes)
  slotMinutesRef.current = slotMinutes
  const onChangeRef = useRef(onSlotMinutesChange)
  onChangeRef.current = onSlotMinutesChange
  const labelRef = useRef(labelForMinutes)
  labelRef.current = labelForMinutes
  const onOpenRef = useRef(onOpen)
  onOpenRef.current = onOpen

  useEffect(() => {
    if (!enabled) return
    const host = hostRef.current
    if (!host) return

    const onCtx = (e: MouseEvent): void => {
      if (!isFcTimeGridAxisContextTarget(e.target)) return
      e.preventDefault()
      e.stopPropagation()
      const items = buildTimeGridSlotMinutesContextMenuItems({
        current: slotMinutesRef.current,
        labelForMinutes: (m) => labelRef.current(m),
        onSelect: (m) => onChangeRef.current(m)
      })
      onOpenRef.current(e.clientX, e.clientY, items)
    }

    host.addEventListener('contextmenu', onCtx)
    return (): void => host.removeEventListener('contextmenu', onCtx)
  }, [enabled, hostRef])
}
