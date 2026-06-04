import { isLayoutStudioPanelId, type LayoutStudioPanelId } from '@/app/layout-studio/layout-studio-panel-ids'

/** Vertikal = Nachbarn links/rechts; horizontal = oben/unten. */
export type LayoutZoneSplitDirection = 'vertical' | 'horizontal'

export type LayoutZoneLeaf = {
  type: 'leaf'
  id: string
  panel: LayoutStudioPanelId
}

export type LayoutZoneSplit = {
  type: 'split'
  id: string
  direction: LayoutZoneSplitDirection
  /** Anteil des ersten Kindes (0.15–0.85). */
  ratio: number
  first: LayoutZoneNode
  second: LayoutZoneNode
}

export type LayoutZoneNode = LayoutZoneLeaf | LayoutZoneSplit

export const LAYOUT_ZONE_RATIO_MIN = 0.15
export const LAYOUT_ZONE_RATIO_MAX = 0.85
export const LAYOUT_ZONE_MAX_LEAVES = 12

export function newZoneId(): string {
  return `z-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function createZoneLeaf(panel: LayoutStudioPanelId = 'none'): LayoutZoneLeaf {
  return { type: 'leaf', id: newZoneId(), panel }
}

export function clampZoneRatio(ratio: number): number {
  if (!Number.isFinite(ratio)) return 0.5
  return Math.min(LAYOUT_ZONE_RATIO_MAX, Math.max(LAYOUT_ZONE_RATIO_MIN, ratio))
}

export function countZoneLeaves(node: LayoutZoneNode): number {
  if (node.type === 'leaf') return 1
  return countZoneLeaves(node.first) + countZoneLeaves(node.second)
}

export function walkZoneLeaves(
  node: LayoutZoneNode,
  visit: (leaf: LayoutZoneLeaf, path: number[]) => void,
  path: number[] = []
): void {
  if (node.type === 'leaf') {
    visit(node, path)
    return
  }
  walkZoneLeaves(node.first, visit, [...path, 0])
  walkZoneLeaves(node.second, visit, [...path, 1])
}

export function findZoneLeaf(node: LayoutZoneNode, leafId: string): LayoutZoneLeaf | null {
  if (node.type === 'leaf') return node.id === leafId ? node : null
  return findZoneLeaf(node.first, leafId) ?? findZoneLeaf(node.second, leafId)
}

export function findZoneSplit(node: LayoutZoneNode, splitId: string): LayoutZoneSplit | null {
  if (node.type === 'leaf') return null
  if (node.id === splitId) return node
  return findZoneSplit(node.first, splitId) ?? findZoneSplit(node.second, splitId)
}

export function mapZoneTree(
  node: LayoutZoneNode,
  fn: (n: LayoutZoneNode) => LayoutZoneNode
): LayoutZoneNode {
  const mapped = fn(node)
  if (mapped.type === 'leaf') return mapped
  if (node.type === 'leaf') {
    return mapped
  }
  return {
    ...mapped,
    first: mapZoneTree(node.first, fn),
    second: mapZoneTree(node.second, fn)
  }
}

function isPanelId(v: unknown): v is LayoutStudioPanelId {
  return isLayoutStudioPanelId(v)
}

function normalizeNode(raw: unknown): LayoutZoneNode | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (o.type === 'leaf') {
    const id = typeof o.id === 'string' && o.id.trim() ? o.id.trim() : newZoneId()
    const panel = isPanelId(o.panel) ? o.panel : 'none'
    return { type: 'leaf', id, panel }
  }
  if (o.type === 'split') {
    const id = typeof o.id === 'string' && o.id.trim() ? o.id.trim() : newZoneId()
    const direction = o.direction === 'horizontal' ? 'horizontal' : 'vertical'
    const ratio = clampZoneRatio(Number(o.ratio))
    const first = normalizeNode(o.first)
    const second = normalizeNode(o.second)
    if (!first || !second) return null
    return { type: 'split', id, direction, ratio, first, second }
  }
  return null
}

export function normalizeZoneRoot(raw: unknown): LayoutZoneNode {
  const node = normalizeNode(raw)
  if (!node) return createZoneLeaf('none')
  if (countZoneLeaves(node) > LAYOUT_ZONE_MAX_LEAVES) return createZoneLeaf('none')
  return node
}
