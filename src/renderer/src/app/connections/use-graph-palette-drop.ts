import { useCallback, useEffect, useState } from 'react'
import type { ChronellEntityRef } from '@shared/entity-ref'
import type { LayoutNode } from '@/app/connections/connections-graph-layout'
import { clientToGraphPoint, hitTestLayoutNode } from '@/app/connections/graph-coords'
import {
  consumeActivePaletteDrag,
  isGraphEntityDrag,
  readGraphEntityDragData,
  setActivePaletteDrag,
  type GraphEntityDragPayload
} from '@/app/connections/graph-entity-drag'

function allowDrop(e: React.DragEvent): void {
  e.preventDefault()
  e.stopPropagation()
  try {
    e.dataTransfer.dropEffect = 'copy'
  } catch {
    /* ignore */
  }
}

export function useGraphPaletteDrop(opts: {
  layout: LayoutNode[]
  svgRef: React.RefObject<SVGSVGElement | null>
  graphGroupRef: React.RefObject<SVGGElement | null>
  enabled: boolean
  onDropOnNode: (dragged: ChronellEntityRef, target: LayoutNode) => void | Promise<void>
  onDropOnCanvas: (payload: GraphEntityDragPayload, x: number, y: number) => void | Promise<void>
}): {
  paletteDragOver: boolean
  paletteDropTargetKey: string | null
  onDragEnter: (e: React.DragEvent) => void
  onDragOver: (e: React.DragEvent) => void
  onDragLeave: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent) => Promise<void>
} {
  const [paletteDragOver, setPaletteDragOver] = useState(false)
  const [paletteDropTargetKey, setPaletteDropTargetKey] = useState<string | null>(null)

  const updateTarget = useCallback(
    (clientX: number, clientY: number): void => {
      const pt = clientToGraphPoint(opts.svgRef.current, opts.graphGroupRef.current, clientX, clientY)
      const hit = hitTestLayoutNode(opts.layout, pt.x, pt.y)
      setPaletteDropTargetKey(hit?.key ?? null)
    },
    [opts.layout, opts.svgRef, opts.graphGroupRef]
  )

  useEffect(() => {
    if (!opts.enabled) return

    const clearDrag = (): void => {
      setActivePaletteDrag(null)
    }

    window.addEventListener('dragend', clearDrag)
    window.addEventListener('drop', clearDrag)
    return (): void => {
      window.removeEventListener('dragend', clearDrag)
      window.removeEventListener('drop', clearDrag)
    }
  }, [opts.enabled])

  const onDragEnter = useCallback((e: React.DragEvent): void => {
    if (!isGraphEntityDrag(e.dataTransfer)) return
    allowDrop(e)
    setPaletteDragOver(true)
  }, [])

  const onDragOver = useCallback(
    (e: React.DragEvent): void => {
      if (!isGraphEntityDrag(e.dataTransfer)) return
      allowDrop(e)
      setPaletteDragOver(true)
      updateTarget(e.clientX, e.clientY)
    },
    [updateTarget]
  )

  const onDragLeave = useCallback((e: React.DragEvent): void => {
    const related = e.relatedTarget as Node | null
    const current = e.currentTarget as Node
    if (related && current.contains(related)) return
    setPaletteDropTargetKey(null)
    setPaletteDragOver(false)
  }, [])

  const onDrop = useCallback(
    async (e: React.DragEvent): Promise<void> => {
      const payload = readGraphEntityDragData(e.dataTransfer) ?? consumeActivePaletteDrag()
      if (!payload) return
      allowDrop(e)
      setPaletteDragOver(false)
      setPaletteDropTargetKey(null)
      setActivePaletteDrag(null)

      const pt = clientToGraphPoint(opts.svgRef.current, opts.graphGroupRef.current, e.clientX, e.clientY)
      const hit = hitTestLayoutNode(opts.layout, pt.x, pt.y)
      if (hit) {
        await opts.onDropOnNode(payload.ref, hit)
      } else {
        await opts.onDropOnCanvas(payload, pt.x, pt.y)
      }
    },
    [opts]
  )

  return { paletteDragOver, paletteDropTargetKey, onDragEnter, onDragOver, onDragLeave, onDrop }
}
