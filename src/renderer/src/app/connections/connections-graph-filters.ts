import type { EntityRefKind } from '@shared/entity-ref'
import type { EntityGraphEdge, EntityGraphNode } from '@shared/entity-links'
import type { ConnectionsGraphViewSettings } from '@/app/connections/connections-graph-view-settings'

function nodeMatchesAccount(node: EntityGraphNode, accountId: string): boolean {
  if (node.clusterKey === `account:${accountId}`) return true
  const ref = node.ref
  if ('accountId' in ref && ref.accountId === accountId) return true
  return false
}

function neighborKeysWithinDepth(
  anchorKey: string,
  edges: EntityGraphEdge[],
  depth: number
): Set<string> {
  const seen = new Set<string>([anchorKey])
  let frontier = new Set<string>([anchorKey])
  for (let d = 0; d < depth; d++) {
    const next = new Set<string>()
    for (const e of edges) {
      if (frontier.has(e.aKey)) next.add(e.bKey)
      if (frontier.has(e.bKey)) next.add(e.aKey)
    }
    for (const k of next) seen.add(k)
    frontier = next
  }
  return seen
}

function degreeByKey(edges: EntityGraphEdge[]): Map<string, number> {
  const deg = new Map<string, number>()
  const bump = (k: string): void => {
    deg.set(k, (deg.get(k) ?? 0) + 1)
  }
  for (const e of edges) {
    bump(e.aKey)
    bump(e.bKey)
  }
  return deg
}

export function applyConnectionsGraphFilters(
  nodes: EntityGraphNode[],
  edges: EntityGraphEdge[],
  settings: ConnectionsGraphViewSettings,
  anchorKey?: string | null,
  alwaysVisibleKeys?: ReadonlySet<string>
): { nodes: EntityGraphNode[]; edges: EntityGraphEdge[] } {
  const keep = (key: string): boolean => alwaysVisibleKeys?.has(key) ?? false
  let filteredEdges = edges

  if (settings.linkKindFilter !== 'all') {
    filteredEdges = filteredEdges.filter((e) => {
      const k = e.linkKind ?? 'related'
      return k === settings.linkKindFilter
    })
  }

  const hidden = settings.hiddenKinds
  let filteredNodes = nodes.filter((n) => !hidden[n.kind as EntityRefKind])

  if (settings.accountFilter) {
    filteredNodes = filteredNodes.filter((n) =>
      nodeMatchesAccount(n, settings.accountFilter!)
    )
  }

  const titleQ = settings.titleFilter.trim().toLowerCase()
  if (titleQ) {
    filteredNodes = filteredNodes.filter(
      (n) =>
        n.title.toLowerCase().includes(titleQ) ||
        (n.subtitle?.toLowerCase().includes(titleQ) ?? false)
    )
  }

  const nodeKeys = new Set(filteredNodes.map((n) => n.key))
  filteredEdges = filteredEdges.filter(
    (e) => nodeKeys.has(e.aKey) && nodeKeys.has(e.bKey)
  )

  if (settings.hideOrphans) {
    const deg = degreeByKey(filteredEdges)
    filteredNodes = filteredNodes.filter((n) => keep(n.key) || (deg.get(n.key) ?? 0) > 0)
    const keys2 = new Set(filteredNodes.map((n) => n.key))
    filteredEdges = filteredEdges.filter(
      (e) => keys2.has(e.aKey) && keys2.has(e.bKey)
    )
  }

  if (anchorKey && settings.focusDepth > 0) {
    const allowed = neighborKeysWithinDepth(anchorKey, filteredEdges, settings.focusDepth)
    filteredNodes = filteredNodes.filter((n) => keep(n.key) || allowed.has(n.key))
    const keys3 = new Set(filteredNodes.map((n) => n.key))
    filteredEdges = filteredEdges.filter(
      (e) => keys3.has(e.aKey) && keys3.has(e.bKey)
    )
  }

  return { nodes: filteredNodes, edges: filteredEdges }
}
