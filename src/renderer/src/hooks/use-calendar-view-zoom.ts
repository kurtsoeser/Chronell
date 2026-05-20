import { useLayoutEffect, useRef, type RefObject } from 'react'
import {
  stepCalendarViewInZoomLadder,
  type CalendarViewZoomDirection
} from '@/app/calendar/calendar-view-zoom-ladder'

const WHEEL_COOLDOWN_MS = 180
const PINCH_STEP_RATIO = 1.14

function touchDistance(touches: TouchList): number {
  if (touches.length < 2) return 0
  const a = touches[0]
  const b = touches[1]
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
}

function eventTargetsHost(host: HTMLElement, e: Event): boolean {
  const target = e.target
  if (!(target instanceof Node)) return false
  return host.contains(target)
}

function wheelDirection(deltaY: number): CalendarViewZoomDirection | null {
  if (deltaY < 0) return 'in'
  if (deltaY > 0) return 'out'
  return null
}

export interface UseCalendarViewZoomOptions {
  enabled?: boolean
  activeViewId: string
  onViewChange: (viewId: string) => void
  ladder: readonly string[]
}

/** Strg+Mausrad und Pinch-to-Zoom wechseln die Kalender-Ansicht entlang der Zoom-Leiter. */
export function useCalendarViewZoom(
  hostRef: RefObject<HTMLElement | null>,
  opts: UseCalendarViewZoomOptions
): void {
  const { enabled = true, activeViewId, onViewChange, ladder } = opts
  const activeViewIdRef = useRef(activeViewId)
  activeViewIdRef.current = activeViewId
  const onViewChangeRef = useRef(onViewChange)
  onViewChangeRef.current = onViewChange

  useLayoutEffect(() => {
    if (!enabled) return
    const host = hostRef.current
    if (!host) return

    let lastWheelStepAt = 0
    let pinchBaseline: { startDistance: number } | null = null

    const applyStep = (direction: CalendarViewZoomDirection): void => {
      const next = stepCalendarViewInZoomLadder(activeViewIdRef.current, direction, ladder)
      if (!next || next === activeViewIdRef.current) return
      onViewChangeRef.current(next)
    }

    const onWheel = (e: WheelEvent): void => {
      if (!e.ctrlKey && !e.metaKey) return
      if (!eventTargetsHost(host, e)) return
      const direction = wheelDirection(e.deltaY)
      if (!direction) return
      e.preventDefault()
      e.stopPropagation()
      const now = Date.now()
      if (now - lastWheelStepAt < WHEEL_COOLDOWN_MS) return
      lastWheelStepAt = now
      applyStep(direction)
    }

    const onTouchStart = (e: TouchEvent): void => {
      if (!eventTargetsHost(host, e)) return
      if (e.touches.length !== 2) {
        pinchBaseline = null
        return
      }
      pinchBaseline = { startDistance: touchDistance(e.touches) }
    }

    const onTouchMove = (e: TouchEvent): void => {
      if (!pinchBaseline || e.touches.length !== 2 || pinchBaseline.startDistance <= 0) return
      if (!eventTargetsHost(host, e)) return
      e.preventDefault()
      const dist = touchDistance(e.touches)
      const ratio = dist / pinchBaseline.startDistance
      if (ratio >= PINCH_STEP_RATIO) {
        applyStep('out')
        pinchBaseline = { startDistance: dist }
        return
      }
      if (ratio <= 1 / PINCH_STEP_RATIO) {
        applyStep('in')
        pinchBaseline = { startDistance: dist }
      }
    }

    const onTouchEnd = (e: TouchEvent): void => {
      if (e.touches.length < 2) pinchBaseline = null
    }

    host.addEventListener('wheel', onWheel, { passive: false })
    host.addEventListener('touchstart', onTouchStart, { passive: true })
    host.addEventListener('touchmove', onTouchMove, { passive: false })
    host.addEventListener('touchend', onTouchEnd, { passive: true })
    host.addEventListener('touchcancel', onTouchEnd, { passive: true })

    return (): void => {
      host.removeEventListener('wheel', onWheel)
      host.removeEventListener('touchstart', onTouchStart)
      host.removeEventListener('touchmove', onTouchMove)
      host.removeEventListener('touchend', onTouchEnd)
      host.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [enabled, hostRef, ladder, activeViewId])
}
