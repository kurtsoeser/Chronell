import type { LayoutNode } from '@/app/connections/connections-graph-layout'
import type { EntityGraphEdge } from '@shared/entity-links'

export function clientToGraphPoint(
  svg: SVGSVGElement | null,
  graphGroup: SVGGElement | null,
  clientX: number,
  clientY: number
): { x: number; y: number } {
  if (!svg || !graphGroup) return { x: 0, y: 0 }
  const pt = svg.createSVGPoint()
  pt.x = clientX
  pt.y = clientY
  const groupCtm = graphGroup.getScreenCTM()
  if (!groupCtm) return { x: 0, y: 0 }
  const local = pt.matrixTransform(groupCtm.inverse())
  return { x: local.x, y: local.y }
}

/** Knoten, der das Rechteck (graph-Koordinaten) schneidet. */
export function boundsForLayoutKeys(
  layout: LayoutNode[],
  keys: Iterable<string>
): { minX: number; minY: number; maxX: number; maxY: number } | null {
  const keySet = new Set(keys)
  const hits = layout.filter((n) => keySet.has(n.key))
  if (hits.length === 0) return null
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const n of hits) {
    const l = n.x - n.w / 2
    const r = n.x + n.w / 2
    const t = n.y - n.h / 2
    const b = n.y + n.h / 2
    minX = Math.min(minX, l)
    minY = Math.min(minY, t)
    maxX = Math.max(maxX, r)
    maxY = Math.max(maxY, b)
  }
  return { minX, minY, maxX, maxY }
}

export function layoutNodesInRect(
  layout: LayoutNode[],
  x1: number,
  y1: number,
  x2: number,
  y2: number
): LayoutNode[] {
  const left = Math.min(x1, x2)
  const right = Math.max(x1, x2)
  const top = Math.min(y1, y2)
  const bottom = Math.max(y1, y2)
  if (right - left < 2 || bottom - top < 2) return []
  return layout.filter((n) => {
    const nl = n.x - n.w / 2
    const nr = n.x + n.w / 2
    const nt = n.y - n.h / 2
    const nb = n.y + n.h / 2
    return nr >= left && nl <= right && nb >= top && nt <= bottom
  })
}

export function hitTestLayoutNode(
  layout: LayoutNode[],
  gx: number,
  gy: number,
  padding = 4
): LayoutNode | null {
  for (let i = layout.length - 1; i >= 0; i--) {
    const n = layout[i]!
    const left = n.x - n.w / 2 - padding
    const right = n.x + n.w / 2 + padding
    const top = n.y - n.h / 2 - padding
    const bottom = n.y + n.h / 2 + padding
    if (gx >= left && gx <= right && gy >= top && gy <= bottom) return n
  }
  return null
}

export function buildUndirectedEdgePairSet(edges: EntityGraphEdge[]): Set<string> {
  const out = new Set<string>()
  for (const e of edges) {
    const pair = e.aKey < e.bKey ? `${e.aKey}\0${e.bKey}` : `${e.bKey}\0${e.aKey}`
    out.add(pair)
  }
  return out
}

export function edgePairExists(set: Set<string>, aKey: string, bKey: string): boolean {
  const pair = aKey < bKey ? `${aKey}\0${bKey}` : `${bKey}\0${aKey}`
  return set.has(pair)
}

/** Schnittpunkt vom Rechteckzentrum zur Kante in Richtung eines anderen Punkts. */
export function layoutNodeBorderToward(
  node: LayoutNode,
  towardX: number,
  towardY: number,
  inset = 2
): { x: number; y: number } {
  const hw = Math.max(4, node.w / 2 - inset)
  const hh = Math.max(4, node.h / 2 - inset)
  const dx = towardX - node.x
  const dy = towardY - node.y
  if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) {
    return { x: node.x + hw, y: node.y }
  }
  const scaleX = dx !== 0 ? hw / Math.abs(dx) : Number.POSITIVE_INFINITY
  const scaleY = dy !== 0 ? hh / Math.abs(dy) : Number.POSITIVE_INFINITY
  const t = Math.min(scaleX, scaleY)
  return { x: node.x + dx * t, y: node.y + dy * t }
}

/** Linienende an Kachelrändern (nicht durch die Mitte). */
export function edgeLineBetweenNodes(
  a: LayoutNode,
  b: LayoutNode
): { x1: number; y1: number; x2: number; y2: number } {
  const p1 = layoutNodeBorderToward(a, b.x, b.y)
  const p2 = layoutNodeBorderToward(b, a.x, a.y)
  return { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y }
}
