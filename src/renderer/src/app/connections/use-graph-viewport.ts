import { useCallback, useLayoutEffect, useRef, useState, type RefObject } from 'react'

export interface GraphViewport {
  x: number
  y: number
  scale: number
}

export interface GraphContentBounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

const MIN_SCALE = 0.12
const MAX_SCALE = 3.5

export function useGraphViewport(
  viewSize: { w: number; h: number },
  contentBounds: GraphContentBounds | null,
  /** Canvas-Container (nicht nur SVG – Wheel kommt oft von foreignObject-Knoten). */
  wheelHostRef: RefObject<HTMLElement | null>
): {
  viewport: GraphViewport
  fitToContent: () => void
  fitToBounds: (bounds: GraphContentBounds) => void
  resetView: () => void
  zoomBy: (factor: number) => void
  onPointerDown: (e: React.PointerEvent) => void
  onPointerMove: (e: React.PointerEvent) => void
  onPointerUp: (e: React.PointerEvent) => void
} {
  const [viewport, setViewport] = useState<GraphViewport>({ x: 0, y: 0, scale: 1 })
  const panRef = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null)

  const fitToBounds = useCallback(
    (bounds: GraphContentBounds): void => {
      if (viewSize.w < 1 || viewSize.h < 1) return
      const pad = viewSize.w < 400 || viewSize.h < 320 ? 28 : 56
      const cw = bounds.maxX - bounds.minX + pad * 2
      const ch = bounds.maxY - bounds.minY + pad * 2
      if (cw < 1 || ch < 1) return
      const scale = Math.min(viewSize.w / cw, viewSize.h / ch, 1.25)
      const cx = (bounds.minX + bounds.maxX) / 2
      const cy = (bounds.minY + bounds.maxY) / 2
      setViewport({
        scale,
        x: viewSize.w / 2 - cx * scale,
        y: viewSize.h / 2 - cy * scale
      })
    },
    [viewSize.w, viewSize.h]
  )

  const fitToContent = useCallback((): void => {
    if (!contentBounds) return
    fitToBounds(contentBounds)
  }, [contentBounds, fitToBounds])

  const resetView = useCallback((): void => {
    setViewport({ x: 0, y: 0, scale: 1 })
  }, [])

  const zoomBy = useCallback(
    (factor: number): void => {
      setViewport((vp) => {
        const nextScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, vp.scale * factor))
        const cx = viewSize.w / 2
        const cy = viewSize.h / 2
        const wx = (cx - vp.x) / vp.scale
        const wy = (cy - vp.y) / vp.scale
        return {
          scale: nextScale,
          x: cx - wx * nextScale,
          y: cy - wy * nextScale
        }
      })
    },
    [viewSize.w, viewSize.h]
  )

  useLayoutEffect(() => {
    const el = wheelHostRef.current
    if (!el) return

    const handleWheel = (e: WheelEvent): void => {
      e.preventDefault()
      e.stopPropagation()
      const rect = el.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      const delta = -e.deltaY * 0.0012
      setViewport((vp) => {
        const nextScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, vp.scale * (1 + delta)))
        const wx = (mx - vp.x) / vp.scale
        const wy = (my - vp.y) / vp.scale
        return {
          scale: nextScale,
          x: mx - wx * nextScale,
          y: my - wy * nextScale
        }
      })
    }

    el.addEventListener('wheel', handleWheel, { passive: false })
    return (): void => el.removeEventListener('wheel', handleWheel)
  }, [wheelHostRef, viewSize.w, viewSize.h])

  const onPointerDown = useCallback((e: React.PointerEvent): void => {
    if (e.button !== 0) return
    const target = e.target as Element
    if (target.closest('[data-graph-node]')) return
    panRef.current = {
      sx: e.clientX,
      sy: e.clientY,
      ox: viewport.x,
      oy: viewport.y
    }
    ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
  }, [viewport.x, viewport.y])

  const onPointerMove = useCallback((e: React.PointerEvent): void => {
    const p = panRef.current
    if (!p) return
    setViewport((vp) => ({
      ...vp,
      x: p.ox + (e.clientX - p.sx),
      y: p.oy + (e.clientY - p.sy)
    }))
  }, [])

  const onPointerUp = useCallback((e: React.PointerEvent): void => {
    panRef.current = null
    try {
      ;(e.currentTarget as Element).releasePointerCapture(e.pointerId)
    } catch {
      /* */
    }
  }, [])

  return {
    viewport,
    fitToContent,
    fitToBounds,
    resetView,
    zoomBy,
    onPointerDown,
    onPointerMove,
    onPointerUp
  }
}
