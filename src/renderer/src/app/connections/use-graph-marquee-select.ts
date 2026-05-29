import { useCallback, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { clientToGraphPoint, layoutNodesInRect } from '@/app/connections/graph-coords'
import type { LayoutNode } from '@/app/connections/connections-graph-layout'

const DRAG_THRESHOLD_PX = 5

export interface GraphMarqueeRect {
  x1: number
  y1: number
  x2: number
  y2: number
}

export function useGraphMarqueeSelect({
  enabled,
  layout,
  svgRef,
  graphGroupRef,
  onCanvasContextMenu,
  onMarqueeComplete
}: {
  enabled: boolean
  layout: LayoutNode[]
  svgRef: React.RefObject<SVGSVGElement | null>
  graphGroupRef: React.RefObject<SVGGElement | null>
  onCanvasContextMenu?: (clientX: number, clientY: number, graphX: number, graphY: number) => void
  onMarqueeComplete?: (nodeKeys: string[]) => void
}): {
  marquee: GraphMarqueeRect | null
  onContainerPointerDown: (e: ReactPointerEvent) => void
  onContainerPointerMove: (e: ReactPointerEvent) => void
  onContainerPointerUp: (e: ReactPointerEvent) => void
  onContainerContextMenu: (e: React.MouseEvent) => void
} {
  const [marquee, setMarquee] = useState<GraphMarqueeRect | null>(null)
  const sessionRef = useRef<{
    pointerId: number
    sx: number
    sy: number
    gx0: number
    gy0: number
    dragging: boolean
  } | null>(null)
  const suppressContextMenuRef = useRef(false)

  const isEmptyCanvasTarget = useCallback((target: Element): boolean => {
    if (target.closest('[data-graph-node]') || target.closest('[data-island-label]')) {
      return false
    }
    return true
  }, [])

  const onContainerPointerDown = useCallback(
    (e: ReactPointerEvent): void => {
      if (!enabled || e.button !== 2) return
      const target = e.target as Element
      if (!isEmptyCanvasTarget(target)) return
      const pt = clientToGraphPoint(svgRef.current, graphGroupRef.current, e.clientX, e.clientY)
      e.preventDefault()
      suppressContextMenuRef.current = false
      sessionRef.current = {
        pointerId: e.pointerId,
        sx: e.clientX,
        sy: e.clientY,
        gx0: pt.x,
        gy0: pt.y,
        dragging: false
      }
      setMarquee({ x1: pt.x, y1: pt.y, x2: pt.x, y2: pt.y })
      ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
    },
    [enabled, isEmptyCanvasTarget, layout, svgRef, graphGroupRef]
  )

  const onContainerPointerMove = useCallback(
    (e: ReactPointerEvent): void => {
      const s = sessionRef.current
      if (!s || s.pointerId !== e.pointerId) return
      const pt = clientToGraphPoint(svgRef.current, graphGroupRef.current, e.clientX, e.clientY)
      const dist = Math.hypot(e.clientX - s.sx, e.clientY - s.sy)
      if (!s.dragging && dist >= DRAG_THRESHOLD_PX) {
        s.dragging = true
        suppressContextMenuRef.current = true
      }
      if (s.dragging) {
        setMarquee({ x1: s.gx0, y1: s.gy0, x2: pt.x, y2: pt.y })
      }
    },
    [svgRef, graphGroupRef]
  )

  const finishSession = useCallback(
    (e: ReactPointerEvent): void => {
      const s = sessionRef.current
      if (!s || s.pointerId !== e.pointerId) return
      sessionRef.current = null
      setMarquee(null)
      try {
        ;(e.currentTarget as Element).releasePointerCapture(e.pointerId)
      } catch {
        /* */
      }
      if (s.dragging) {
        const pt = clientToGraphPoint(svgRef.current, graphGroupRef.current, e.clientX, e.clientY)
        const hits = layoutNodesInRect(layout, s.gx0, s.gy0, pt.x, pt.y)
        onMarqueeComplete?.(hits.map((n) => n.key))
      } else {
        onCanvasContextMenu?.(e.clientX, e.clientY, s.gx0, s.gy0)
      }
    },
    [layout, onCanvasContextMenu, onMarqueeComplete, svgRef, graphGroupRef]
  )

  const onContainerPointerUp = useCallback(
    (e: ReactPointerEvent): void => {
      if (e.button !== 2) return
      finishSession(e)
    },
    [finishSession]
  )

  const onContainerContextMenu = useCallback((e: ReactMouseEvent): void => {
    if (suppressContextMenuRef.current) {
      e.preventDefault()
      e.stopPropagation()
    }
  }, [])

  return {
    marquee,
    onContainerPointerDown,
    onContainerPointerMove,
    onContainerPointerUp,
    onContainerContextMenu
  }
}
