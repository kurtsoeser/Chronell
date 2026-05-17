import { useEffect, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import {
  MOTION_TOAST_EXIT_MS,
  motionToastIn,
  motionToastOut
} from '@/lib/motion'
import { usePrefersReducedMotion } from '@/lib/use-prefers-reduced-motion'

interface AnimatedToastProps {
  toastId: number
  dismissing: boolean
  onExitComplete: (id: number) => void
  className?: string
  children: ReactNode
}

export function AnimatedToast({
  toastId,
  dismissing,
  onExitComplete,
  className,
  children
}: AnimatedToastProps): JSX.Element | null {
  const reducedMotion = usePrefersReducedMotion()
  const [mounted, setMounted] = useState(true)
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    if (!dismissing) {
      setMounted(true)
      setExiting(false)
      return
    }
    if (reducedMotion) {
      setMounted(false)
      onExitComplete(toastId)
      return
    }
    setExiting(true)
    const id = window.setTimeout(() => {
      setMounted(false)
      onExitComplete(toastId)
    }, MOTION_TOAST_EXIT_MS)
    return (): void => window.clearTimeout(id)
  }, [dismissing, reducedMotion, onExitComplete, toastId])

  if (!mounted) return null

  return (
    <div
      className={cn(
        className,
        !reducedMotion && (exiting ? motionToastOut : motionToastIn)
      )}
    >
      {children}
    </div>
  )
}
