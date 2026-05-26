import type { MetaFolderCriteria } from './types'

export type MetaFolderMatchOp = 'and' | 'or'

export type MetaFolderConditionType =
  | 'unread'
  | 'flagged'
  | 'attachments'
  | 'fulltext'
  | 'from'
  | 'categories'

export interface MetaFolderConditionLeaf {
  kind: 'leaf'
  id: string
  type: MetaFolderConditionType
  /** Volltext / Absender: Zeilen intern per ODER. */
  lines?: string[]
  categoryNames?: string[]
}

export interface MetaFolderConditionGroup {
  kind: 'group'
  id: string
  op: MetaFolderMatchOp
  children: MetaFolderConditionNode[]
}

export type MetaFolderConditionNode = MetaFolderConditionLeaf | MetaFolderConditionGroup

export function isMetaFolderConditionGroup(
  n: MetaFolderConditionNode
): n is MetaFolderConditionGroup {
  return n.kind === 'group'
}

export function newMatchNodeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function createEmptyMatchRoot(op: MetaFolderMatchOp = 'and'): MetaFolderConditionGroup {
  return { kind: 'group', id: newMatchNodeId(), op, children: [] }
}

export function createMatchLeaf(type: MetaFolderConditionType): MetaFolderConditionLeaf {
  const leaf: MetaFolderConditionLeaf = { kind: 'leaf', id: newMatchNodeId(), type }
  if (type === 'fulltext' || type === 'from') leaf.lines = ['']
  if (type === 'categories') leaf.categoryNames = []
  return leaf
}

export function createMatchGroup(op: MetaFolderMatchOp = 'and'): MetaFolderConditionGroup {
  return { kind: 'group', id: newMatchNodeId(), op, children: [] }
}

function compactLines(lines: string[] | undefined): string[] {
  return (lines ?? []).map((l) => l.trim()).filter((l) => l.length > 0)
}

export function matchLeafHasActiveFilter(leaf: MetaFolderConditionLeaf): boolean {
  switch (leaf.type) {
    case 'unread':
    case 'flagged':
    case 'attachments':
      return true
    case 'fulltext':
    case 'from':
      return compactLines(leaf.lines).some((l) => l.length >= 2)
    case 'categories':
      return (leaf.categoryNames ?? []).some((c) => c.trim().length > 0)
    default:
      return false
  }
}

export function matchExpressionHasActiveFilter(root: MetaFolderConditionGroup | undefined): boolean {
  if (!root) return false
  for (const child of root.children) {
    if (child.kind === 'leaf') {
      if (matchLeafHasActiveFilter(child)) return true
    } else if (matchExpressionHasActiveFilter(child)) {
      return true
    }
  }
  return false
}

export function legacyCriteriaToMatchExpression(c: MetaFolderCriteria): MetaFolderConditionGroup {
  if (c.matchExpression && c.matchExpression.kind === 'group') {
    return normalizeMatchGroup(c.matchExpression)
  }

  const children: MetaFolderConditionNode[] = []
  if (c.unreadOnly) children.push(createMatchLeaf('unread'))
  if (c.flaggedOnly) children.push(createMatchLeaf('flagged'))
  if (c.hasAttachmentsOnly) children.push(createMatchLeaf('attachments'))

  const fts: string[] = []
  const t0 = c.textQuery?.trim()
  if (t0) fts.push(t0)
  for (const x of c.textQueryOrAlternatives ?? []) {
    if (typeof x === 'string' && x.trim()) fts.push(x.trim())
  }
  if (fts.length > 0) {
    const leaf = createMatchLeaf('fulltext')
    leaf.lines = fts
    children.push(leaf)
  }

  const fromLines: string[] = []
  const f0 = c.fromContains?.trim()
  if (f0) fromLines.push(f0)
  for (const x of c.fromContainsOrAlternatives ?? []) {
    if (typeof x === 'string' && x.trim()) fromLines.push(x.trim())
  }
  if (fromLines.length > 0) {
    const leaf = createMatchLeaf('from')
    leaf.lines = fromLines
    children.push(leaf)
  }

  const cats = (c.categoriesAny ?? []).map((x) => x.trim()).filter((x) => x.length > 0)
  if (cats.length > 0) {
    const leaf = createMatchLeaf('categories')
    leaf.categoryNames = cats
    children.push(leaf)
  }

  return {
    kind: 'group',
    id: newMatchNodeId(),
    op: c.matchOp === 'or' ? 'or' : 'and',
    children
  }
}

function parseLeafRaw(o: Record<string, unknown>): MetaFolderConditionLeaf | null {
  const type = o.type
  if (
    type !== 'unread' &&
    type !== 'flagged' &&
    type !== 'attachments' &&
    type !== 'fulltext' &&
    type !== 'from' &&
    type !== 'categories'
  ) {
    return null
  }
  const id = typeof o.id === 'string' && o.id ? o.id : newMatchNodeId()
  const leaf: MetaFolderConditionLeaf = { kind: 'leaf', id, type }
  if (type === 'fulltext' || type === 'from') {
    const linesRaw = o.lines
    const lines = Array.isArray(linesRaw)
      ? linesRaw.filter((x): x is string => typeof x === 'string')
      : []
    leaf.lines = lines.length > 0 ? lines : ['']
  }
  if (type === 'categories') {
    const catsRaw = o.categoryNames
    leaf.categoryNames = Array.isArray(catsRaw)
      ? catsRaw
          .filter((x): x is string => typeof x === 'string')
          .map((x) => x.trim())
          .filter((x) => x.length > 0)
      : []
  }
  return leaf
}

function parseGroupRaw(o: Record<string, unknown>): MetaFolderConditionGroup | null {
  const op = o.op === 'or' ? 'or' : o.op === 'and' ? 'and' : null
  if (!op) return null
  const id = typeof o.id === 'string' && o.id ? o.id : newMatchNodeId()
  const chRaw = o.children
  const children: MetaFolderConditionNode[] = []
  if (Array.isArray(chRaw)) {
    for (const item of chRaw) {
      const node = parseMatchExpressionNode(item)
      if (node) children.push(node)
    }
  }
  return { kind: 'group', id, op, children }
}

export function parseMatchExpressionNode(raw: unknown): MetaFolderConditionNode | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (o.kind === 'group') return parseGroupRaw(o)
  if (o.kind === 'leaf') return parseLeafRaw(o)
  return null
}

export function normalizeMatchGroup(g: MetaFolderConditionGroup): MetaFolderConditionGroup {
  return {
    kind: 'group',
    id: g.id || newMatchNodeId(),
    op: g.op === 'or' ? 'or' : 'and',
    children: g.children
      .map((c) =>
        c.kind === 'group'
          ? normalizeMatchGroup(c)
          : { ...c, id: c.id || newMatchNodeId() }
      )
      .filter((c): c is MetaFolderConditionNode => c != null)
  }
}

export function matchExpressionSummaryDe(
  root: MetaFolderConditionGroup | undefined,
  depth = 0
): string {
  if (!root || root.children.length === 0) return ''
  const parts: string[] = []
  const join = root.op === 'or' ? ' oder ' : ' und '
  for (const child of root.children) {
    if (child.kind === 'leaf') {
      if (!matchLeafHasActiveFilter(child)) continue
      switch (child.type) {
        case 'unread':
          parts.push('ungelesen')
          break
        case 'flagged':
          parts.push('markiert')
          break
        case 'attachments':
          parts.push('mit Anhang')
          break
        case 'fulltext': {
          const lines = compactLines(child.lines).filter((l) => l.length >= 2)
          if (lines.length === 1) parts.push(`Volltext „${lines[0]}“`)
          else if (lines.length > 1)
            parts.push(`Volltext (${lines.map((x) => `„${x}“`).join(' oder ')})`)
          break
        }
        case 'from': {
          const lines = compactLines(child.lines).filter((l) => l.length >= 2)
          if (lines.length === 1) parts.push(`Absender „${lines[0]}“`)
          else if (lines.length > 1)
            parts.push(`Absender (${lines.map((x) => `„${x}“`).join(' oder ')})`)
          break
        }
        case 'categories': {
          const cats = (child.categoryNames ?? []).filter((c) => c.trim().length > 0)
          if (cats.length === 1) parts.push(`Kategorie „${cats[0]}“`)
          else if (cats.length > 1)
            parts.push(`Kategorien (${cats.map((x) => `„${x}“`).join(' oder ')})`)
          break
        }
      }
    } else {
      const sub = matchExpressionSummaryDe(child, depth + 1)
      if (sub) parts.push(`(${sub})`)
    }
  }
  if (parts.length === 0) return ''
  return parts.join(join)
}

export function validateMatchExpression(root: MetaFolderConditionGroup): string | null {
  function walk(node: MetaFolderConditionNode, isRootGroup: boolean): string | null {
    if (node.kind === 'group') {
      if (!isRootGroup && node.children.length === 0) {
        return 'Leere Klammergruppe: Bedingung hinzufuegen oder Gruppe entfernen.'
      }
      for (const ch of node.children) {
        const err = walk(ch, false)
        if (err) return err
      }
      return null
    }
    const lines = compactLines(node.lines)
    for (const line of lines) {
      if (line.length === 1) {
        return node.type === 'fulltext'
          ? 'Volltext: pro Zeile mindestens zwei Zeichen (oder Zeile leeren).'
          : 'Absender: pro Zeile mindestens zwei Zeichen (oder Zeile leeren).'
      }
    }
    const hasPartial =
      (node.type === 'fulltext' || node.type === 'from') &&
      lines.some((l) => l.length === 1)
    if (hasPartial) {
      return node.type === 'fulltext'
        ? 'Volltext: pro Zeile mindestens zwei Zeichen (oder Zeile leeren).'
        : 'Absender: pro Zeile mindestens zwei Zeichen (oder Zeile leeren).'
    }
    return null
  }
  for (const ch of root.children) {
    const err = walk(ch, false)
    if (err) return err
  }
  return null
}

/** Tiefe Kopie fuer immutable Updates. */
export function cloneMatchGroup(g: MetaFolderConditionGroup): MetaFolderConditionGroup {
  return JSON.parse(JSON.stringify(g)) as MetaFolderConditionGroup
}

export function updateMatchGroup(
  root: MetaFolderConditionGroup,
  groupId: string,
  updater: (g: MetaFolderConditionGroup) => MetaFolderConditionGroup
): MetaFolderConditionGroup {
  if (root.id === groupId) return updater(cloneMatchGroup(root))
  return {
    ...root,
    children: root.children.map((ch) => {
      if (ch.kind === 'group') return updateMatchGroup(ch, groupId, updater)
      return ch
    })
  }
}

export function updateMatchNode(
  root: MetaFolderConditionGroup,
  nodeId: string,
  updater: (n: MetaFolderConditionNode) => MetaFolderConditionNode
): MetaFolderConditionGroup {
  if (root.id === nodeId) {
    const updated = updater(root)
    return updated.kind === 'group' ? updated : root
  }
  return {
    ...root,
    children: root.children.map((ch) => patchMatchNode(ch, nodeId, updater))
  }
}

function patchMatchNode(
  node: MetaFolderConditionNode,
  nodeId: string,
  updater: (n: MetaFolderConditionNode) => MetaFolderConditionNode
): MetaFolderConditionNode {
  if (node.id === nodeId) return updater(node)
  if (node.kind === 'group') {
    return {
      ...node,
      children: node.children.map((ch) => patchMatchNode(ch, nodeId, updater))
    }
  }
  return node
}

export function removeMatchNode(
  root: MetaFolderConditionGroup,
  nodeId: string
): MetaFolderConditionGroup {
  if (root.id === nodeId) return root
  return updateMatchGroup(root, root.id, (g) => ({
    ...g,
    children: g.children
      .filter((ch) => ch.id !== nodeId)
      .map((ch) => (ch.kind === 'group' ? removeMatchNode(ch, nodeId) : ch))
  }))
}

export function addChildToMatchGroup(
  root: MetaFolderConditionGroup,
  groupId: string,
  child: MetaFolderConditionNode
): MetaFolderConditionGroup {
  return updateMatchGroup(root, groupId, (g) => ({
    ...g,
    children: [...g.children, child]
  }))
}

export function serializeMatchExpression(g: MetaFolderConditionGroup): MetaFolderConditionGroup {
  return normalizeMatchGroup(g)
}
