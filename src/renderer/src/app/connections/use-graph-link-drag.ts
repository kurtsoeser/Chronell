import { useCallback, useEffect, useRef, useState } from 'react'
import type { LayoutNode } from '@/app/connections/connections-graph-layout'
import type { ChronellEntityRef } from '@shared/entity-ref'
import type { EntityGraphEdge, EntityGraphNode } from '@shared/entity-links'
import {
  clientToGraphPoint,
  edgePairExists,
  hitTestLayoutNode,
  layoutNodeBorderToward
} from '@/app/connections/graph-coords'

export interface LinkDragState {
  fromKey: string
  from: ChronellEntityRef
  fromX: number
  fromY: number
  toX: number
  toY: number
}

export function useGraphLinkDrag(opts: {
  layout: LayoutNode[]
  edgePairs: Set<string>
  svgRef: React.RefObject<SVGSVGElement | null>
  graphGroupRef: React.RefObject<SVGGElement | null>
  onLinked?: (target: EntityGraphNode) => void
}): {
  linkDrag: LinkDragState | null
  dropTargetKey: string | null
  linkBusy: boolean
  startLinkDrag: (node: LayoutNode, clientX: number, clientY: number) => void
} {
  const [linkDrag, setLinkDrag] = useState<LinkDragState | null>(null)
  const [dropTargetKey, setDropTargetKey] = useState<string | null>(null)
  const [linkBusy, setLinkBusy] = useState(false)
  const dragRef = useRef<LinkDragState | null>(null)

  const startLinkDrag = useCallback(
    (node: LayoutNode, clientX: number, clientY: number): void => {
      const pt = clientToGraphPoint(opts.svgRef.current, opts.graphGroupRef.current, clientX, clientY)
      const from = layoutNodeBorderToward(node, pt.x, pt.y)
      const state: LinkDragState = {
        fromKey: node.key,
        from: node.node.ref,
        fromX: from.x,
        fromY: from.y,
        toX: pt.x,
        toY: pt.y
      }
      dragRef.current = state
      setLinkDrag(state)
      setDropTargetKey(null)
    },
    [opts.svgRef, opts.graphGroupRef]
  )

  useEffect(() => {
    if (!linkDrag) return

    const onMove = (e: PointerEvent): void => {
      const cur = dragRef.current
      if (!cur) return
      const pt = clientToGraphPoint(
        opts.svgRef.current,
        opts.graphGroupRef.current,
        e.clientX,
        e.clientY
      )
      const fromNode = opts.layout.find((n) => n.key === cur.fromKey)
      const from =
        fromNode != null
          ? layoutNodeBorderToward(fromNode, pt.x, pt.y)
          : { x: cur.fromX, y: cur.fromY }
      const next = { ...cur, fromX: from.x, fromY: from.y, toX: pt.x, toY: pt.y }
      dragRef.current = next
      setLinkDrag(next)
      const hit = hitTestLayoutNode(opts.layout, pt.x, pt.y)
      if (hit && hit.key !== cur.fromKey && !edgePairExists(opts.edgePairs, cur.fromKey, hit.key)) {
        setDropTargetKey(hit.key)
      } else {
        setDropTargetKey(null)
      }
    }

    const onUp = async (e: PointerEvent): Promise<void> => {
      const cur = dragRef.current
      dragRef.current = null
      setLinkDrag(null)
      if (!cur) return

      const pt = clientToGraphPoint(
        opts.svgRef.current,
        opts.graphGroupRef.current,
        e.clientX,
        e.clientY
      )
      const hit = hitTestLayoutNode(opts.layout, pt.x, pt.y)
      setDropTargetKey(null)

      if (
        !hit ||
        hit.key === cur.fromKey ||
        edgePairExists(opts.edgePairs, cur.fromKey, hit.key)
      ) {
        return
      }

      setLinkBusy(true)
      try {
        await window.mailClient.entityLinks.add({ a: cur.from, b: hit.node.ref })
        opts.onLinked?.(hit.node)
      } catch {
        /* Fehler via IPC */
      } finally {
        setLinkBusy(false)
      }
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return (): void => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [linkDrag, opts])

  return { linkDrag, dropTargetKey, linkBusy, startLinkDrag }
}
