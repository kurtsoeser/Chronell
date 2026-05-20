import type { EntityGraphEdge } from '@shared/entity-links'

export interface GraphFocusState {
  focusKey: string
  neighborKeys: Set<string>
  /** Fokus + Nachbarn bis zur gewünschten Tiefe (für Dimming). */
  highlightKeys: Set<string>
  activeEdgeIds: Set<number>
  degree: number
}

/** Obsidian-ähnlicher Fokus: gewählter Knoten + Nachbarn (depth 1–2) + Kanten. */
export function buildGraphFocus(
  focusKey: string | null | undefined,
  edges: EntityGraphEdge[],
  depth = 1
): GraphFocusState | null {
  if (!focusKey || depth < 1) return null
  const highlightKeys = new Set<string>([focusKey])
  const activeEdgeIds = new Set<number>()
  let frontier = new Set<string>([focusKey])

  for (let d = 0; d < depth; d++) {
    const next = new Set<string>()
    for (const e of edges) {
      if (frontier.has(e.aKey)) {
        next.add(e.bKey)
        activeEdgeIds.add(e.linkId)
      }
      if (frontier.has(e.bKey)) {
        next.add(e.aKey)
        activeEdgeIds.add(e.linkId)
      }
    }
    for (const k of next) highlightKeys.add(k)
    frontier = next
  }

  const neighborKeys = new Set(highlightKeys)
  neighborKeys.delete(focusKey)

  return {
    focusKey,
    neighborKeys,
    highlightKeys,
    activeEdgeIds,
    degree: neighborKeys.size
  }
}

export type GraphNodeRole = 'default' | 'focus' | 'neighbor' | 'dim' | 'hover'

export function nodeRoleForFocus(
  key: string,
  focus: GraphFocusState | null,
  hoverKey: string | null,
  edges: EntityGraphEdge[]
): GraphNodeRole {
  if (focus) {
    if (key === focus.focusKey) return 'focus'
    if (focus.highlightKeys.has(key)) return 'neighbor'
    return 'dim'
  }
  if (hoverKey) {
    if (key === hoverKey) return 'hover'
    const hoverNeighbor = edges.some(
      (e) =>
        (e.aKey === hoverKey && e.bKey === key) || (e.bKey === hoverKey && e.aKey === key)
    )
    if (hoverNeighbor) return 'neighbor'
    return 'default'
  }
  return 'default'
}

export function edgeActiveForFocus(
  edge: EntityGraphEdge,
  focus: GraphFocusState | null,
  hoverKey: string | null
): boolean {
  if (focus) return focus.activeEdgeIds.has(edge.linkId)
  if (!hoverKey) return false
  return edge.aKey === hoverKey || edge.bKey === hoverKey
}

export function edgeOpacity(
  active: boolean,
  hasFocus: boolean,
  hasHover: boolean
): number {
  if (hasFocus) return active ? 0.95 : 0.07
  if (hasHover) return active ? 0.8 : 0.35
  return 0.45
}

export interface GraphPathHighlight {
  nodeKeys: Set<string>
  edgeIds: Set<number>
}

export function nodeOnPath(key: string, path: GraphPathHighlight | null | undefined): boolean {
  return Boolean(path?.nodeKeys.has(key))
}

export function edgeOnPath(edgeId: number, path: GraphPathHighlight | null | undefined): boolean {
  return Boolean(path?.edgeIds.has(edgeId))
}
