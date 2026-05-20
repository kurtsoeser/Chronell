import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'

export interface GanttBarHoverTooltipProps {
  text: string
  anchorX: number
  anchorY: number
  visible: boolean
}

export function GanttBarHoverTooltip({
  text,
  anchorX,
  anchorY,
  visible
}: GanttBarHoverTooltipProps): JSX.Element | null {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted || !visible || !text.trim()) return null

  const pad = 12
  const maxW = 360
  let left = anchorX + pad
  let top = anchorY + pad
  if (typeof window !== 'undefined') {
    const estW = Math.min(maxW, 280)
    const estH = 48
    if (left + estW > window.innerWidth - 8) left = Math.max(8, anchorX - estW - pad)
    if (top + estH > window.innerHeight - 8) top = Math.max(8, anchorY - estH - pad)
  }

  return createPortal(
    <div
      role="tooltip"
      className={cn(
        'pointer-events-none fixed z-[250] max-w-[min(360px,calc(100vw-16px))]',
        'chronell-acrylic-tooltip whitespace-pre-line',
        'text-[12px] font-medium leading-snug text-popover-foreground shadow-lg'
      )}
      style={{ left, top }}
    >
      {text}
    </div>,
    document.body
  )
}
