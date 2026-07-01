import { Copy, FilePlus2, FolderInput, Link2, Pin, PinOff, Trash2 } from 'lucide-react'
import type { TFunction } from 'i18next'
import type { NoteSection, UserNoteListItem } from '@shared/types'
import type { ContextMenuItem } from '@/components/ContextMenu'
import { buildNoteSectionTree, type NoteSectionTreeNode } from '@/lib/notes-section-tree'
import type { NotesPageFlatRow } from '@/lib/notes-page-tree'
import { noteTitle } from '@/app/notes/notes-display-helpers'

export interface NotesPageContextHandlers {
  t: TFunction
  note: UserNoteListItem
  sections: NoteSection[]
  pageRows: NotesPageFlatRow[]
  onDelete: (note: UserNoteListItem) => void | Promise<void>
  onCopy: (note: UserNoteListItem) => void | Promise<void>
  onMove: (note: UserNoteListItem, sectionId: number | null) => void | Promise<void>
  onLink: (note: UserNoteListItem) => void
  onTogglePin?: (note: UserNoteListItem) => void | Promise<void>
  onCreateSubPage?: (note: UserNoteListItem) => void | Promise<void>
  onMoveToParent?: (note: UserNoteListItem, parentNoteId: number | null) => void | Promise<void>
}

function flattenSectionNodes(nodes: NoteSectionTreeNode[]): Array<{ id: number; label: string }> {
  const out: Array<{ id: number; label: string }> = []
  const walk = (list: NoteSectionTreeNode[]): void => {
    for (const node of list) {
      const prefix = node.depth > 0 ? `${'  '.repeat(node.depth)}` : ''
      out.push({ id: node.section.id, label: `${prefix}${node.section.name}` })
      walk(node.children)
    }
  }
  walk(nodes)
  return out
}

function descendantIds(noteId: number, pageRows: NotesPageFlatRow[]): Set<number> {
  const blocked = new Set<number>([noteId])
  let changed = true
  while (changed) {
    changed = false
    for (const row of pageRows) {
      const parentId = row.note.parentNoteId
      if (parentId != null && blocked.has(parentId) && !blocked.has(row.note.id)) {
        blocked.add(row.note.id)
        changed = true
      }
    }
  }
  return blocked
}

export function buildNotesPageContextMenuItems(handlers: NotesPageContextHandlers): ContextMenuItem[] {
  const {
    t,
    note,
    sections,
    pageRows,
    onDelete,
    onCopy,
    onMove,
    onLink,
    onTogglePin,
    onCreateSubPage,
    onMoveToParent
  } = handlers
  const tree = buildNoteSectionTree(sections, [])
  const sectionEntries = flattenSectionNodes(tree.roots)
  const untitled = t('notes.shell.untitled')

  const moveSubmenu: ContextMenuItem[] = [
    {
      id: 'move-ungrouped',
      label: t('notes.sections.ungrouped'),
      selected: note.sectionId == null,
      onSelect: (): void => {
        if (note.sectionId == null) return
        void onMove(note, null)
      }
    },
    ...sectionEntries.map((entry) => ({
      id: `move-section-${entry.id}`,
      label: entry.label,
      selected: note.sectionId === entry.id,
      onSelect: (): void => {
        if (note.sectionId === entry.id) return
        void onMove(note, entry.id)
      }
    }))
  ]

  const blocked = descendantIds(note.id, pageRows)
  const parentCandidates = pageRows
    .map((r) => r.note)
    .filter((n) => !blocked.has(n.id) && n.id !== note.id)

  const parentSubmenu: ContextMenuItem[] = [
    {
      id: 'parent-root',
      label: t('notes.pagesContextMenu.parentRoot'),
      selected: note.parentNoteId == null,
      onSelect: (): void => {
        if (note.parentNoteId == null) return
        onMoveToParent?.(note, null)
      }
    },
    ...parentCandidates.map((candidate) => ({
      id: `parent-${candidate.id}`,
      label: noteTitle(candidate, untitled),
      selected: note.parentNoteId === candidate.id,
      onSelect: (): void => {
        if (note.parentNoteId === candidate.id) return
        onMoveToParent?.(note, candidate.id)
      }
    }))
  ]

  const items: ContextMenuItem[] = []

  if (onTogglePin) {
    items.push({
      id: 'notes-page-pin',
      label: note.isPinned ? t('notes.pagesContextMenu.unpin') : t('notes.pagesContextMenu.pin'),
      icon: note.isPinned ? PinOff : Pin,
      onSelect: (): void => void onTogglePin(note)
    })
  }

  if (onCreateSubPage) {
    items.push({
      id: 'notes-page-subpage',
      label: t('notes.pagesContextMenu.createSubPage'),
      icon: FilePlus2,
      onSelect: (): void => void onCreateSubPage(note)
    })
  }

  items.push(
    {
      id: 'notes-page-delete',
      label: t('common.delete'),
      icon: Trash2,
      destructive: true,
      onSelect: (): void => void onDelete(note)
    },
    {
      id: 'notes-page-copy',
      label: t('notes.pagesContextMenu.copy'),
      icon: Copy,
      onSelect: (): void => void onCopy(note)
    },
    { id: 'sep-notes-page-1', label: '', separator: true },
    {
      id: 'notes-page-move',
      label: t('notes.pagesContextMenu.move'),
      icon: FolderInput,
      submenu: moveSubmenu
    }
  )

  if (onMoveToParent && parentSubmenu.length > 1) {
    items.push({
      id: 'notes-page-parent',
      label: t('notes.pagesContextMenu.setParent'),
      icon: FolderInput,
      submenu: parentSubmenu
    })
  }

  items.push({
    id: 'notes-page-link',
    label: t('notes.pagesContextMenu.link'),
    icon: Link2,
    onSelect: (): void => onLink(note)
  })

  return items
}
