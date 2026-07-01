import type { UserNoteListItem } from '@shared/types'
import type { NotesPagesSortKey } from '@/lib/notes-pages-sort'
import { compareNotesPagesSibling } from '@/lib/notes-pages-sort'
import { sortNotesByOrder } from '@/lib/notes-section-tree'

export interface NotesPageFlatRow {
  note: UserNoteListItem
  depth: number
  hasChildren: boolean
  collapsed: boolean
}

export interface NotesPageTreeNode {
  note: UserNoteListItem
  depth: number
  children: NotesPageTreeNode[]
}

export function buildNotesPageForest(
  notes: UserNoteListItem[],
  compareSiblings: (a: UserNoteListItem, b: UserNoteListItem) => number = (a, b) => {
    const [first] = sortNotesByOrder([a, b])
    return first === a ? -1 : 1
  }
): NotesPageTreeNode[] {
  const byId = new Map(notes.map((n) => [n.id, n]))
  const byParent = new Map<number | null, UserNoteListItem[]>()
  for (const note of notes) {
    const pid = note.parentNoteId ?? null
    const effectiveParent = pid != null && byId.has(pid) ? pid : null
    const list = byParent.get(effectiveParent) ?? []
    list.push(note)
    byParent.set(effectiveParent, list)
  }

  const walk = (parentId: number | null, depth: number): NotesPageTreeNode[] => {
    const siblings = [...(byParent.get(parentId) ?? [])].sort(compareSiblings)
    return siblings.map((note) => ({
      note,
      depth,
      children: walk(note.id, depth + 1)
    }))
  }

  return walk(null, 0)
}

export function flattenNotesPageForest(
  roots: NotesPageTreeNode[],
  collapsedParentIds: ReadonlySet<number> = new Set()
): NotesPageFlatRow[] {
  const out: NotesPageFlatRow[] = []
  const visit = (nodes: NotesPageTreeNode[]): void => {
    for (const node of nodes) {
      const hasChildren = node.children.length > 0
      const collapsed = collapsedParentIds.has(node.note.id)
      out.push({
        note: node.note,
        depth: node.depth,
        hasChildren,
        collapsed
      })
      if (hasChildren && !collapsed) visit(node.children)
    }
  }
  visit(roots)
  return out
}

export function listDirectChildNotes(
  parentNoteId: number,
  notes: UserNoteListItem[],
  compareSiblings: (a: UserNoteListItem, b: UserNoteListItem) => number
): UserNoteListItem[] {
  return notes.filter((n) => n.parentNoteId === parentNoteId).sort(compareSiblings)
}

export function buildNotesPageRows(
  notes: UserNoteListItem[],
  pagesSort: NotesPagesSortKey,
  collapsedParentIds: ReadonlySet<number>,
  untitledLabel: string
): NotesPageFlatRow[] {
  const compareSiblings = (a: UserNoteListItem, b: UserNoteListItem): number =>
    compareNotesPagesSibling(a, b, pagesSort, untitledLabel)
  const forest = buildNotesPageForest(notes, compareSiblings)
  return flattenNotesPageForest(forest, collapsedParentIds)
}

export function flattenNotesForPagesPane(
  notes: UserNoteListItem[],
  useTree: boolean
): NotesPageFlatRow[] {
  if (!useTree) {
    return notes.map((note) => ({
      note,
      depth: 0,
      hasChildren: false,
      collapsed: false
    }))
  }
  return buildNotesPageRows(notes, 'manual', new Set(), 'Untitled')
}

export function buildNoteBreadcrumb(
  noteId: number,
  notesById: Map<number, UserNoteListItem>
): UserNoteListItem[] {
  const chain: UserNoteListItem[] = []
  const seen = new Set<number>()
  let current = notesById.get(noteId)
  while (current) {
    if (seen.has(current.id)) break
    seen.add(current.id)
    chain.unshift(current)
    const parentId = current.parentNoteId
    current = parentId != null ? notesById.get(parentId) : undefined
  }
  return chain
}
