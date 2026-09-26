import { useLayoutEffect, useRef, useState, type MutableRefObject } from 'react'
import type { EventSourceInput } from '@fullcalendar/core'

/**
 * Hält die an FullCalendar übergebene `eventSources`-Referenz stabil während
 * Drag/Resize und Schedule-Persist. Sonst triggert jedes `setEvents` nach Drop
 * `resetOptions` und baut alle Termine neu — sichtbar als Ruckler.
 */
export function usePinnedFcEventSources(
  liveSources: EventSourceInput[],
  opts: {
    persistInFlightRef: MutableRefObject<number>
    pointerManipulatingRef: MutableRefObject<boolean>
    /** Erhöhen, wenn Persist endet, damit der Pin auch bei unverändertem liveSources gelöst wird. */
    releaseEpoch: number
  }
): EventSourceInput[] {
  const { persistInFlightRef, pointerManipulatingRef, releaseEpoch } = opts
  const pinnedRef = useRef(liveSources)
  const [pinned, setPinned] = useState(liveSources)

  useLayoutEffect(() => {
    if (persistInFlightRef.current > 0) return
    if (pointerManipulatingRef.current) return
    if (pinnedRef.current === liveSources) return
    pinnedRef.current = liveSources
    setPinned(liveSources)
  }, [liveSources, releaseEpoch, persistInFlightRef, pointerManipulatingRef])

  return pinned
}
