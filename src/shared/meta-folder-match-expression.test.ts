import { describe, expect, it } from 'vitest'
import type { MetaFolderCriteria } from './types'
import {
  addChildToMatchGroup,
  createEmptyMatchRoot,
  createMatchGroup,
  createMatchLeaf,
  legacyCriteriaToMatchExpression,
  matchExpressionHasActiveFilter,
  matchExpressionSummaryDe,
  matchLeafHasActiveFilter,
  normalizeMatchGroup,
  parseMatchExpressionNode,
  removeMatchNode,
  updateMatchGroup,
  validateMatchExpression
} from './meta-folder-match-expression'

describe('matchLeafHasActiveFilter', () => {
  it('trivial flags sind immer aktiv', () => {
    expect(matchLeafHasActiveFilter(createMatchLeaf('unread'))).toBe(true)
    expect(matchLeafHasActiveFilter(createMatchLeaf('flagged'))).toBe(true)
  })

  it('Volltext braucht mindestens zwei Zeichen', () => {
    const short = createMatchLeaf('fulltext')
    short.lines = ['a']
    expect(matchLeafHasActiveFilter(short)).toBe(false)
    short.lines = ['ab']
    expect(matchLeafHasActiveFilter(short)).toBe(true)
  })
})

describe('legacyCriteriaToMatchExpression', () => {
  it('mappt Legacy-Kriterien auf AND-Gruppe', () => {
    const c: MetaFolderCriteria = {
      unreadOnly: true,
      flaggedOnly: false,
      hasAttachmentsOnly: true,
      textQuery: 'Rechnung',
      fromContains: 'billing@',
      categoriesAny: ['Finance'],
      matchOp: 'and'
    }
    const root = legacyCriteriaToMatchExpression(c)
    expect(root.op).toBe('and')
    expect(root.children.length).toBe(5)
    const types = root.children.map((ch) => (ch.kind === 'leaf' ? ch.type : 'group'))
    expect(types).toContain('unread')
    expect(types).toContain('attachments')
    expect(types).toContain('fulltext')
    expect(types).toContain('from')
    expect(types).toContain('categories')
  })

  it('nutzt vorhandenen matchExpression wenn gesetzt', () => {
    const expr = createEmptyMatchRoot('or')
    const leaf = createMatchLeaf('flagged')
    expr.children = [leaf]
    const root = legacyCriteriaToMatchExpression({ matchExpression: expr, matchOp: 'and' })
    expect(root.op).toBe('or')
    expect(root.children).toHaveLength(1)
  })
})

describe('parseMatchExpressionNode', () => {
  it('parst Leaf und Group', () => {
    const leaf = parseMatchExpressionNode({
      kind: 'leaf',
      id: 'l1',
      type: 'from',
      lines: ['foo@bar.com']
    })
    expect(leaf?.kind).toBe('leaf')
    if (leaf?.kind === 'leaf') expect(leaf.lines).toEqual(['foo@bar.com'])

    const group = parseMatchExpressionNode({
      kind: 'group',
      id: 'g1',
      op: 'or',
      children: []
    })
    expect(group?.kind).toBe('group')
  })

  it('lehnt unbekannte Typen ab', () => {
    expect(parseMatchExpressionNode({ kind: 'leaf', type: 'unknown' })).toBeNull()
    expect(parseMatchExpressionNode(null)).toBeNull()
  })
})

describe('validateMatchExpression', () => {
  it('meldet zu kurze Volltext-Zeilen', () => {
    const root = createEmptyMatchRoot()
    const leaf = createMatchLeaf('fulltext')
    leaf.lines = ['x']
    root.children = [leaf]
    expect(validateMatchExpression(root)).toMatch(/mindestens zwei Zeichen/)
  })

  it('akzeptiert gueltige Bedingungen', () => {
    const root = createEmptyMatchRoot()
    const leaf = createMatchLeaf('fulltext')
    leaf.lines = ['ok']
    root.children = [leaf]
    expect(validateMatchExpression(root)).toBeNull()
  })
})

describe('matchExpressionSummaryDe', () => {
  it('fuegt aktive Bedingungen mit UND zusammen', () => {
    const root = createEmptyMatchRoot('and')
    root.children = [createMatchLeaf('unread'), createMatchLeaf('attachments')]
    expect(matchExpressionSummaryDe(root)).toBe('ungelesen und mit Anhang')
  })
})

describe('tree mutations', () => {
  it('addChildToMatchGroup und removeMatchNode', () => {
    const root = createEmptyMatchRoot()
    const inner = createMatchGroup('or')
    const withInner = addChildToMatchGroup(root, root.id, inner)
    const leaf = createMatchLeaf('flagged')
    const withLeaf = addChildToMatchGroup(withInner, inner.id, leaf)
    expect(withLeaf.children[0]?.kind).toBe('group')
    const pruned = removeMatchNode(withLeaf, leaf.id)
    const group = pruned.children[0]
    expect(group?.kind === 'group' && group.children).toHaveLength(0)
  })

  it('updateMatchGroup aendert Operator', () => {
    const root = createEmptyMatchRoot('and')
    const updated = updateMatchGroup(root, root.id, (g) => ({ ...g, op: 'or' }))
    expect(updated.op).toBe('or')
  })

  it('normalizeMatchGroup erzwingt gueltige op', () => {
    const bad = { kind: 'group' as const, id: '', op: 'xor' as 'and', children: [] }
    expect(normalizeMatchGroup(bad).op).toBe('and')
  })
})
