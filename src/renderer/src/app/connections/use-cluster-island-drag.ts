import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import type { GraphViewport } from '@/app/connections/use-graph-viewport'

export function useClusterIslandDrag({
  viewport,
  svgRef,
  enabled,
  onCommit
}: {
  viewport: GraphViewport
  svgRef: RefObject<SVGSVGElement | null>
  enabled: boolean
  onCommit: (clusterKey: string, dx: number, dy: number) => void
}): {
  liveOffset: { clusterKey: string; dx: number; dy: number } | null
  onIslandDragStart: (clusterKey: string, clientX: number, clientY: number) => void
} {
  const [liveOffset, setLiveOffset] = useState<{
    clusterKey: string
    dx: number
    dy: number
  } | null>(null)
  const dragRef = useRef<{
    clusterKey: string
    startGraphX: number
    startGraphY: number
  } | null>(null)

  const clientToGraph = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } | null => {
      const svg = svgRef.current
      if (!svg) return null
      const pt = svg.createSVGPoint()
      pt.x = clientX
      pt.y = clientY
      const ctm = svg.getScreenCTM()
      if (!ctm) return null
      const local = pt.matrixTransform(ctm.inverse())
      return {
        x: (local.x - viewport.x) / viewport.scale,
        y: (local.y - viewport.y) / viewport.scale
      }
    },
    [svgRef, viewport.x, viewport.y, viewport.scale]
  )

  const onIslandDragStart = useCallback(
    (clusterKey: string, clientX: number, clientY: number): void => {
      if (!enabled) return
      const g = clientToGraph(clientX, clientY)
      if (!g) return
      dragRef.current = { clusterKey, startGraphX: g.x, startGraphY: g.y }
      setLiveOffset({ clusterKey, dx: 0, dy: 0 })
    },
    [enabled, clientToGraph]
  )

  useEffect(() => {
    if (!liveOffset) return

    const onMove = (e: PointerEvent): void => {
      const d = dragRef.current
      if (!d) return
      const g = clientToGraph(e.clientX, e.clientY)
      if (!g) return
      setLiveOffset({
        clusterKey: d.clusterKey,
        dx: g.x - d.startGraphX,
        dy: g.y - d.startGraphY
      })
    }

    const onUp = (e: PointerEvent): void => {
      const d = dragRef.current
      if (!d) return
      const g = clientToGraph(e.clientX, e.clientY)
      dragRef.current = null
      setLiveOffset(null)
      if (!g) return
      const dx = g.x - d.startGraphX
      const dy = g.y - d.startGraphY
      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
        onCommit(d.clusterKey, dx, dy)
      }
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [liveOffset, clientToGraph, onCommit])

  return { liveOffset, onIslandDragStart }
}
