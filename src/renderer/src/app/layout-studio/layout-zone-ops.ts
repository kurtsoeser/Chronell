import type { LayoutStudioPanelId } from '@/app/layout-studio/layout-studio-storage'
import {
  LAYOUT_ZONE_MAX_LEAVES,
  clampZoneRatio,
  countZoneLeaves,
  createZoneLeaf,
  findZoneLeaf,
  mapZoneTree,
  newZoneId,
  type LayoutZoneLeaf,
  type LayoutZoneNode,
  type LayoutZoneSplit,
  type LayoutZoneSplitDirection
} from '@/app/layout-studio/layout-zone-model'

type ParentRef = { split: LayoutZoneSplit; child: 'first' | 'second' }

function findParentOfLeaf(node: LayoutZoneNode, leafId: string): ParentRef | null {
  if (node.type === 'leaf') return null
  if (node.first.type === 'leaf' && node.first.id === leafId) {
    return { split: node, child: 'first' }
  }
  if (node.second.type === 'leaf' && node.second.id === leafId) {
    return { split: node, child: 'second' }
  }
  return (
    findParentOfLeaf(node.first, leafId) ?? findParentOfLeaf(node.second, leafId)
  )
}

export function setZoneLeafPanel(
  root: LayoutZoneNode,
  leafId: string,
  panel: LayoutStudioPanelId
): LayoutZoneNode {
  return mapZoneTree(root, (n) => {
    if (n.type === 'leaf' && n.id === leafId) return { ...n, panel }
    return n
  })
}

/** Tauscht die Panel-Zuweisung zweier Zonen (Position im Raster bleibt). */
export function swapZoneLeafPanels(
  root: LayoutZoneNode,
  leafIdA: string,
  leafIdB: string
): LayoutZoneNode {
  if (leafIdA === leafIdB) return root
  const leafA = findZoneLeaf(root, leafIdA)
  const leafB = findZoneLeaf(root, leafIdB)
  if (!leafA || !leafB) return root
  const panelA = leafA.panel
  const panelB = leafB.panel
  return mapZoneTree(root, (n) => {
    if (n.type !== 'leaf') return n
    if (n.id === leafIdA) return { ...n, panel: panelB }
    if (n.id === leafIdB) return { ...n, panel: panelA }
    return n
  })
}

export function setZoneSplitRatio(
  root: LayoutZoneNode,
  splitId: string,
  ratio: number
): LayoutZoneNode {
  const r = clampZoneRatio(ratio)
  return mapZoneTree(root, (n) => {
    if (n.type === 'split' && n.id === splitId) return { ...n, ratio: r }
    return n
  })
}

export function adjustZoneSplitRatioByDelta(
  root: LayoutZoneNode,
  splitId: string,
  deltaPx: number,
  containerSizePx: number
): LayoutZoneNode {
  if (containerSizePx <= 0 || deltaPx === 0) return root
  const split = findSplitInTree(root, splitId)
  if (!split) return root
  const deltaRatio = deltaPx / containerSizePx
  const next =
    split.direction === 'vertical'
      ? split.ratio + deltaRatio
      : split.ratio + deltaRatio
  return setZoneSplitRatio(root, splitId, next)
}

function findSplitInTree(node: LayoutZoneNode, splitId: string): LayoutZoneSplit | null {
  if (node.type === 'leaf') return null
  if (node.id === splitId) return node
  return findSplitInTree(node.first, splitId) ?? findSplitInTree(node.second, splitId)
}

export function splitZoneLeaf(
  root: LayoutZoneNode,
  leafId: string,
  direction: LayoutZoneSplitDirection,
  ratio = 0.5
): LayoutZoneNode {
  if (countZoneLeaves(root) >= LAYOUT_ZONE_MAX_LEAVES) return root
  return mapZoneTree(root, (n) => {
    if (n.type !== 'leaf' || n.id !== leafId) return n
    return {
      type: 'split',
      id: newZoneId(),
      direction,
      ratio: clampZoneRatio(ratio),
      first: { ...n },
      second: createZoneLeaf('none')
    }
  })
}

/** Entfernt eine Zone; der Geschwister-Bereich bleibt erhalten. */
export function removeZoneLeaf(root: LayoutZoneNode, leafId: string): LayoutZoneNode {
  if (root.type === 'leaf') {
    return root.id === leafId ? createZoneLeaf('none') : root
  }
  const parent = findParentOfLeaf(root, leafId)
  if (!parent) return root

  const keepSibling = parent.child === 'first' ? parent.split.second : parent.split.first

  return replaceSubtree(root, parent.split.id, keepSibling)
}

function replaceSubtree(
  node: LayoutZoneNode,
  targetId: string,
  replacement: LayoutZoneNode
): LayoutZoneNode {
  if (node.type === 'leaf') return node
  if (node.id === targetId) return replacement
  return {
    ...node,
    first: replaceSubtree(node.first, targetId, replacement),
    second: replaceSubtree(node.second, targetId, replacement)
  }
}

export function listZoneLeaves(root: LayoutZoneNode): LayoutZoneLeaf[] {
  const out: LayoutZoneLeaf[] = []
  mapZoneTree(root, (n) => {
    if (n.type === 'leaf') out.push(n)
    return n
  })
  return out
}
