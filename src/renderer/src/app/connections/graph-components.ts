import type { EntityGraphEdge, EntityGraphNode } from '@shared/entity-links'
import type { ClusterIslandStyle } from '@/app/connections/cluster-island-style'

/** Stabile Verbindungs-Insel-ID: kleinster Knoten-Key der Komponente (bleibt bei Reload gleich). */
export function componentClusterKeyForNodeKeys(nodeKeys: readonly string[]): string {
  const anchor = [...nodeKeys].sort()[0]
  return `comp:${anchor}`
}

/** @deprecated Nur fuer Migration von `comp:0`-Keys. */
export function computeLegacyConnectedComponentKeys(
  nodes: EntityGraphNode[],
  edges: EntityGraphEdge[]
): Map<string, string> {
  const parent = new Map<string, string>()

  const find = (k: string): string => {
    let p = parent.get(k) ?? k
    if (p !== k) {
      p = find(p)
      parent.set(k, p)
    }
    return p
  }

  const union = (a: string, b: string): void => {
    const ra = find(a)
    const rb = find(b)
    if (ra !== rb) parent.set(rb, ra)
  }

  for (const n of nodes) parent.set(n.key, n.key)
  for (const e of edges) union(e.aKey, e.bKey)

  const rootIndex = new Map<string, number>()
  let next = 0
  const out = new Map<string, string>()

  for (const n of nodes) {
    const root = find(n.key)
    if (!rootIndex.has(root)) rootIndex.set(root, next++)
    out.set(n.key, `comp:${rootIndex.get(root)!}`)
  }

  return out
}

/** Zusammenhaengende Inseln: Knoten-Key → stabile `comp:<anker-knoten-key>`. */
export function computeConnectedComponentKeys(
  nodes: EntityGraphNode[],
  edges: EntityGraphEdge[]
): Map<string, string> {
  const parent = new Map<string, string>()

  const find = (k: string): string => {
    let p = parent.get(k) ?? k
    if (p !== k) {
      p = find(p)
      parent.set(k, p)
    }
    return p
  }

  const union = (a: string, b: string): void => {
    const ra = find(a)
    const rb = find(b)
    if (ra !== rb) parent.set(rb, ra)
  }

  for (const n of nodes) parent.set(n.key, n.key)
  for (const e of edges) union(e.aKey, e.bKey)

  const keysByRoot = new Map<string, string[]>()
  for (const n of nodes) {
    const root = find(n.key)
    const list = keysByRoot.get(root) ?? []
    list.push(n.key)
    keysByRoot.set(root, list)
  }

  const out = new Map<string, string>()
  for (const nodeKeys of keysByRoot.values()) {
    const clusterKey = componentClusterKeyForNodeKeys(nodeKeys)
    for (const k of nodeKeys) {
      out.set(k, clusterKey)
    }
  }

  return out
}

const LEGACY_COMP_KEY = /^comp:\d+$/

export function hasLegacyComponentIslandKeys(keys: Iterable<string>): boolean {
  for (const k of keys) {
    if (LEGACY_COMP_KEY.test(k)) return true
  }
  return false
}

/** Benennt `comp:0`-Eintraege nach stabilem Anker-Key um (Labels, Farben, Offsets). */
export function migrateLegacyComponentIslandMaps(
  nodes: EntityGraphNode[],
  edges: EntityGraphEdge[],
  labels: Readonly<Record<string, string>>,
  styles: Readonly<Record<string, ClusterIslandStyle>>,
  offsets: Readonly<Record<string, { dx: number; dy: number }>>
): {
  componentIslandLabels: Record<string, string>
  clusterIslandStyles: Record<string, ClusterIslandStyle>
  clusterIslandOffsets: Record<string, { dx: number; dy: number }>
  changed: boolean
} {
  const allKeys = [
    ...Object.keys(labels),
    ...Object.keys(styles),
    ...Object.keys(offsets)
  ]
  if (!hasLegacyComponentIslandKeys(allKeys)) {
    return {
      componentIslandLabels: { ...labels },
      clusterIslandStyles: { ...styles },
      clusterIslandOffsets: { ...offsets },
      changed: false
    }
  }

  const legacy = computeLegacyConnectedComponentKeys(nodes, edges)
  const stable = computeConnectedComponentKeys(nodes, edges)
  const legacyToStable = new Map<string, string>()

  for (const n of nodes) {
    const oldKey = legacy.get(n.key)
    const newKey = stable.get(n.key)
    if (oldKey && newKey && oldKey !== newKey && !legacyToStable.has(oldKey)) {
      legacyToStable.set(oldKey, newKey)
    }
  }

  const nextLabels = { ...labels }
  const nextStyles = { ...styles }
  const nextOffsets = { ...offsets }
  let changed = false

  const moveEntry = <T,>(
    from: Record<string, T>,
    oldKey: string,
    newKey: string
  ): void => {
    if (!(oldKey in from)) return
    if (!(newKey in from)) {
      from[newKey] = from[oldKey]
    }
    delete from[oldKey]
    changed = true
  }

  for (const [oldKey, newKey] of legacyToStable) {
    moveEntry(nextLabels, oldKey, newKey)
    moveEntry(nextStyles, oldKey, newKey)
    moveEntry(nextOffsets, oldKey, newKey)
  }

  for (const key of [...Object.keys(nextLabels)]) {
    if (LEGACY_COMP_KEY.test(key) && !legacyToStable.has(key)) {
      delete nextLabels[key]
      changed = true
    }
  }
  for (const key of [...Object.keys(nextStyles)]) {
    if (LEGACY_COMP_KEY.test(key) && !legacyToStable.has(key)) {
      delete nextStyles[key]
      changed = true
    }
  }
  for (const key of [...Object.keys(nextOffsets)]) {
    if (LEGACY_COMP_KEY.test(key) && !legacyToStable.has(key)) {
      delete nextOffsets[key]
      changed = true
    }
  }

  return {
    componentIslandLabels: nextLabels,
    clusterIslandStyles: nextStyles,
    clusterIslandOffsets: nextOffsets,
    changed
  }
}
