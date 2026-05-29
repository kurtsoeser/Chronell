import { useLayoutEffect, useRef, type RefObject } from 'react'
import {
  stepTimeGridSlotMinutes,
  type TimeGridSlotMinutes
} from '@/app/calendar/calendar-shell-storage'

const WHEEL_COOLDOWN_MS = 180

function eventTargetsHost(host: HTMLElement, e: Event): boolean {
  const target = e.target
  if (!(target instanceof Node)) return false
  return host.contains(target)
}

function isEditableTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable
}

export interface UseTimeGridSlotZoomOptions {
  enabled?: boolean
  slotMinutes: TimeGridSlotMinutes
  onSlotMinutesChange: (min: TimeGridSlotMinutes) => void
}

/** Strg+Mausrad und Strg+Umschalt+. / , zoomen das Zeitraster (feiner/gröber). */
export function useTimeGridSlotZoom(
  wheelHostRef: RefObject<HTMLElement | null>,
  keyboardHostRef: RefObject<HTMLElement | null>,
  opts: UseTimeGridSlotZoomOptions
): void {
  const { enabled = true, slotMinutes, onSlotMinutesChange } = opts
  const slotMinutesRef = useRef(slotMinutes)
  slotMinutesRef.current = slotMinutes
  const onChangeRef = useRef(onSlotMinutesChange)
  onChangeRef.current = onSlotMinutesChange

  useLayoutEffect(() => {
    if (!enabled) return

    let lastWheelStepAt = 0

    const applyStep = (direction: 'finer' | 'coarser'): void => {
      const next = stepTimeGridSlotMinutes(slotMinutesRef.current, direction)
      if (next === slotMinutesRef.current) return
      onChangeRef.current(next)
    }

    const onWheel = (e: WheelEvent): void => {
      if (!e.ctrlKey && !e.metaKey) return
      const host = wheelHostRef.current
      if (!host || !eventTargetsHost(host, e)) return
      e.preventDefault()
      e.stopPropagation()
      const now = Date.now()
      if (now - lastWheelStepAt < WHEEL_COOLDOWN_MS) return
      lastWheelStepAt = now
      applyStep(e.deltaY < 0 ? 'finer' : 'coarser')
    }

    const onKey = (e: KeyboardEvent): void => {
      if (!(e.ctrlKey || e.metaKey) || !e.shiftKey) return
      if (e.repeat) return
      const host = keyboardHostRef.current
      if (!host || !eventTargetsHost(host, e)) return
      if (isEditableTarget(e.target)) return
      if (e.code === 'Period') {
        e.preventDefault()
        applyStep('finer')
        return
      }
      if (e.code === 'Comma') {
        e.preventDefault()
        applyStep('coarser')
      }
    }

    window.addEventListener('wheel', onWheel, { passive: false, capture: true })
    window.addEventListener('keydown', onKey, true)
    return (): void => {
      window.removeEventListener('wheel', onWheel, true)
      window.removeEventListener('keydown', onKey, true)
    }
  }, [enabled, wheelHostRef, keyboardHostRef])
}
