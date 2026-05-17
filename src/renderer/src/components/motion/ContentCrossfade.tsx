import { useEffect, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { motionContentCrossfade } from '@/lib/motion'
import { usePrefersReducedMotion } from '@/lib/use-prefers-reduced-motion'

interface ContentCrossfadeProps {
  /** Changes trigger a brief opacity crossfade. */
  contentKey: string | number | null | undefined
  className?: string
  children: ReactNode
}

/** Fades content when `contentKey` changes (e.g. selected mail / note). */
export function ContentCrossfade({
  contentKey,
  className,
  children
}: ContentCrossfadeProps): JSX.Element {
  const reducedMotion = usePrefersReducedMotion()
  const [visible, setVisible] = useState(true)
  const [displayKey, setDisplayKey] = useState(contentKey)

  useEffect(() => {
    if (contentKey === displayKey) return
    if (reducedMotion) {
      setDisplayKey(contentKey)
      return
    }
    setVisible(false)
    const id = window.setTimeout(() => {
      setDisplayKey(contentKey)
      setVisible(true)
    }, 100)
    return (): void => window.clearTimeout(id)
  }, [contentKey, displayKey, reducedMotion])

  return (
    <div
      key={String(displayKey ?? 'empty')}
      className={cn(
        motionContentCrossfade,
        !reducedMotion && (visible ? 'opacity-100' : 'opacity-0'),
        className
      )}
    >
      {children}
    </div>
  )
}
