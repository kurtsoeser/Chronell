import { useEffect, useState } from 'react'
import { MOTION_EXIT_MS } from '@/lib/motion'
import { usePrefersReducedMotion } from '@/lib/use-prefers-reduced-motion'

export interface AnimatedPresenceState {
  /** DOM should remain mounted (enter or exit animation in progress). */
  mounted: boolean
  /** Exit animation is playing. */
  exiting: boolean
}

/**
 * Keeps content mounted briefly after `open` becomes false so CSS exit classes can run.
 */
export function useAnimatedPresence(
  open: boolean,
  exitDurationMs: number = MOTION_EXIT_MS
): AnimatedPresenceState {
  const reducedMotion = usePrefersReducedMotion()
  const [mounted, setMounted] = useState(open)
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    if (open) {
      setMounted(true)
      setExiting(false)
      return
    }
    if (!mounted) return
    if (reducedMotion) {
      setMounted(false)
      setExiting(false)
      return
    }
    setExiting(true)
    const id = window.setTimeout(() => {
      setMounted(false)
      setExiting(false)
    }, exitDurationMs)
    return (): void => window.clearTimeout(id)
  }, [open, mounted, reducedMotion, exitDurationMs])

  return { mounted, exiting }
}
