import { useCallback, useRef, useState } from 'react'
import { MOTION_LIST_EXIT_MS } from '@/lib/motion'
import { usePrefersReducedMotion } from '@/lib/use-prefers-reduced-motion'

/**
 * Marks IDs as "exiting" before removal so list rows can play a fade-out.
 * Returns whether an id is currently exiting and a helper to schedule removal.
 *
 * Important: call `markExiting` only after the user confirmed deletion (and ideally
 * right before the actual remove/API), not when opening a confirm dialog.
 */
export function useExitingIds<T extends string | number>(
  exitDurationMs: number = MOTION_LIST_EXIT_MS
): {
  exitingIds: Set<T>
  isExiting: (id: T) => boolean
  markExiting: (ids: T | T[], onRemove: () => void) => void
} {
  const reducedMotion = usePrefersReducedMotion()
  const [exitingIds, setExitingIds] = useState<Set<T>>(() => new Set())
  const timersRef = useRef<Map<string, number>>(new Map())

  const isExiting = useCallback((id: T): boolean => exitingIds.has(id), [exitingIds])

  const markExiting = useCallback(
    (ids: T | T[], onRemove: () => void): void => {
      const list = Array.isArray(ids) ? ids : [ids]
      if (list.length === 0) {
        onRemove()
        return
      }
      if (reducedMotion) {
        onRemove()
        return
      }
      setExitingIds((prev) => {
        const next = new Set(prev)
        for (const id of list) next.add(id)
        return next
      })
      const key = list.join(',')
      const existing = timersRef.current.get(key)
      if (existing) window.clearTimeout(existing)
      const timer = window.setTimeout(() => {
        timersRef.current.delete(key)
        setExitingIds((prev) => {
          const next = new Set(prev)
          for (const id of list) next.delete(id)
          return next
        })
        onRemove()
      }, exitDurationMs)
      timersRef.current.set(key, timer)
    },
    [reducedMotion, exitDurationMs]
  )

  return { exitingIds, isExiting, markExiting }
}
