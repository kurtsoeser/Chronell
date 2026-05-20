import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
  type RefObject
} from 'react'
import type { GraphViewport } from '@/app/connections/use-graph-viewport'

export function useGraphNodeDrag({
  viewport,
  svgRef,
  enabled,
  onCommit
}: {
  viewport: GraphViewport
  svgRef: RefObject<SVGSVGElement | null>
  enabled: boolean
  onCommit: (nodeKey: string, dx: number, dy: number) => void
}): {
  liveDrag: { nodeKey: string; dx: number; dy: number } | null
  onNodeDragStart: (nodeKey: string, clientX: number, clientY: number) => void
  didDragRef: MutableRefObject<boolean>
} {
  const [liveDrag, setLiveDrag] = useState<{ nodeKey: string; dx: number; dy: number } | null>(null)
  const didDragRef = useRef(false)
  const dragRef = useRef<{
    nodeKey: string
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

  const onNodeDragStart = useCallback(
    (nodeKey: string, clientX: number, clientY: number): void => {
      if (!enabled) return
      const g = clientToGraph(clientX, clientY)
      if (!g) return
      didDragRef.current = false
      dragRef.current = { nodeKey, startGraphX: g.x, startGraphY: g.y }
      setLiveDrag({ nodeKey, dx: 0, dy: 0 })
    },
    [enabled, clientToGraph]
  )

  useEffect(() => {
    if (!liveDrag) return

    const onMove = (e: PointerEvent): void => {
      const d = dragRef.current
      if (!d) return
      const g = clientToGraph(e.clientX, e.clientY)
      if (!g) return
      const dx = g.x - d.startGraphX
      const dy = g.y - d.startGraphY
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) didDragRef.current = true
      setLiveDrag({ nodeKey: d.nodeKey, dx, dy })
    }

    const onUp = (e: PointerEvent): void => {
      const d = dragRef.current
      if (!d) return
      const g = clientToGraph(e.clientX, e.clientY)
      dragRef.current = null
      setLiveDrag(null)
      if (!g) return
      const dx = g.x - d.startGraphX
      const dy = g.y - d.startGraphY
      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
        didDragRef.current = true
        onCommit(d.nodeKey, dx, dy)
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
  }, [liveDrag, clientToGraph, onCommit])

  return { liveDrag, onNodeDragStart, didDragRef }
}
