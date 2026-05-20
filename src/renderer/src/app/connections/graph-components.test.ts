import { describe, expect, it } from 'vitest'
import type { EntityGraphEdge, EntityGraphNode } from '@shared/entity-links'
import {
  computeConnectedComponentKeys,
  computeLegacyConnectedComponentKeys,
  migrateLegacyComponentIslandMaps
} from '@/app/connections/graph-components'

function node(key: string): EntityGraphNode {
  return {
    key,
    ref: { kind: 'mail', messageId: Number(key.split(':')[1] ?? 1) },
    kind: 'mail',
    title: key,
    clusterKey: 'scope:mail',
    layoutScope: 'scope:mail'
  }
}

function edge(a: string, b: string): EntityGraphEdge {
  return { linkId: 1, aKey: a, bKey: b, linkKind: 'related' }
}

describe('computeConnectedComponentKeys', () => {
  it('uses stable anchor keys independent of node order', () => {
    const nodesA = [node('mail:2'), node('mail:1'), node('mail:3')]
    const nodesB = [node('mail:3'), node('mail:1'), node('mail:2')]
    const edges = [edge('mail:1', 'mail:2'), edge('mail:2', 'mail:3')]

    const mapA = computeConnectedComponentKeys(nodesA, edges)
    const mapB = computeConnectedComponentKeys(nodesB, edges)

    expect(mapA.get('mail:1')).toBe('comp:mail:1')
    expect(mapB.get('mail:3')).toBe('comp:mail:1')
    expect([...new Set(mapA.values())]).toEqual(['comp:mail:1'])
  })

  it('assigns different keys to disconnected components', () => {
    const nodes = [node('mail:1'), node('mail:2'), node('note:5')]
    const edges = [edge('mail:1', 'mail:2')]
    const map = computeConnectedComponentKeys(nodes, edges)
    expect(map.get('mail:1')).toBe('comp:mail:1')
    expect(map.get('note:5')).toBe('comp:note:5')
  })
})

describe('migrateLegacyComponentIslandMaps', () => {
  it('moves custom labels from comp:0 to stable anchor key', () => {
    const nodes = [node('mail:10'), node('mail:20')]
    const edges = [edge('mail:10', 'mail:20')]
    const legacy = computeLegacyConnectedComponentKeys(nodes, edges)
    expect(legacy.get('mail:10')).toBe('comp:0')

    const stable = computeConnectedComponentKeys(nodes, edges)
    expect(stable.get('mail:10')).toBe('comp:mail:10')

    const result = migrateLegacyComponentIslandMaps(
      nodes,
      edges,
      { 'comp:0': 'Roller LML' },
      {},
      {}
    )
    expect(result.changed).toBe(true)
    expect(result.componentIslandLabels['comp:mail:10']).toBe('Roller LML')
    expect(result.componentIslandLabels['comp:0']).toBeUndefined()
  })
})
