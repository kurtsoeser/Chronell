import { useCallback, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { NoteSection, UserNoteListItem } from '@shared/types'
import type { NotePageTemplateId } from '@/lib/note-page-templates'
import type { NotesPageFlatRow } from '@/lib/notes-page-tree'
import { sectionLabelForNote } from '@/lib/notes-nav-selection'
import { NotesPageRow } from '@/app/notes/NotesPageRow'
import { NotesPagesSortMenu } from '@/app/notes/NotesPagesSortMenu'
import { NoteEntityLinkPickerDialog } from '@/app/notes/NoteEntityLinkPickerDialog'
import { NotePageCreateMenu } from '@/components/NotePageCreateMenu'
import type { NotesPagesSortKey } from '@/lib/notes-pages-sort'
import { buildNotesPageContextMenuItems } from '@/lib/notes-page-context-menu'
import { cn } from '@/lib/utils'
import { ContextMenu } from '@/components/ContextMenu'
import {
  ModuleColumnHeaderIconButton,
  moduleColumnHeaderShellBarClass,
  moduleColumnHeaderTitleClass
} from '@/components/ModuleColumnHeader'

export function NotesPagesPane({
  title,
  pageRows,
  sections,
  loading,
  activeNoteId,
  selectedNoteIds,
  categoryColorByName,
  onOpenNote,
  onRenameNoteTitle,
  onPatchNoteDisplay,
  onDeleteNote,
  isNoteExiting,
  onCopyNote,
  onMoveNote,
  onTogglePin,
  onCreateSubPage,
  onMoveToParent,
  onTogglePageCollapse,
  onCreateNote,
  creating = false,
  pagesSort,
  onPagesSortChange,
  showSectionLabels = false,
  headerTrailing
}: {
  title: string
  pageRows: NotesPageFlatRow[]
  sections: NoteSection[]
  loading: boolean
  activeNoteId: number | null
  selectedNoteIds: ReadonlySet<number>
  categoryColorByName?: Map<string, string>
  onOpenNote: (note: UserNoteListItem, event: React.MouseEvent) => void
  onRenameNoteTitle: (note: UserNoteListItem, title: string) => void | Promise<void>
  onPatchNoteDisplay: (
    note: UserNoteListItem,
    patch: { iconId?: string | null; iconColor?: string | null }
  ) => void | Promise<void>
  onDeleteNote: (note: UserNoteListItem) => void | Promise<void>
  isNoteExiting: (noteId: number) => boolean
  onCopyNote: (note: UserNoteListItem) => void | Promise<void>
  onMoveNote: (note: UserNoteListItem, sectionId: number | null) => void | Promise<void>
  onTogglePin?: (note: UserNoteListItem) => void | Promise<void>
  onCreateSubPage?: (note: UserNoteListItem) => void | Promise<void>
  onMoveToParent?: (note: UserNoteListItem, parentNoteId: number | null) => void | Promise<void>
  onTogglePageCollapse?: (note: UserNoteListItem) => void
  onCreateNote: (templateId: NotePageTemplateId) => void
  creating?: boolean
  pagesSort: NotesPagesSortKey
  onPagesSortChange: (key: NotesPagesSortKey) => void
  showSectionLabels?: boolean
  headerTrailing?: React.ReactNode
}): JSX.Element {
  const { t } = useTranslation()
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; note: UserNoteListItem } | null>(
    null
  )
  const [linkNoteId, setLinkNoteId] = useState<number | null>(null)

  const openContextMenu = useCallback((note: UserNoteListItem, event: React.MouseEvent): void => {
    setContextMenu({ x: event.clientX, y: event.clientY, note })
  }, [])

  const contextMenuItems =
    contextMenu != null
      ? buildNotesPageContextMenuItems({
          t,
          note: contextMenu.note,
          sections,
          pageRows,
          onDelete: onDeleteNote,
          onCopy: onCopyNote,
          onMove: onMoveNote,
          onTogglePin,
          onCreateSubPage,
          onMoveToParent,
          onLink: (note): void => {
            setContextMenu(null)
            setLinkNoteId(note.id)
            onOpenNote(note, { shiftKey: false, ctrlKey: false, metaKey: false } as React.MouseEvent)
          }
        })
      : []

  return (
    <div className="flex h-full min-h-0 flex-col bg-card">
      <header className={moduleColumnHeaderShellBarClass}>
        <div className={cn(moduleColumnHeaderTitleClass, 'min-w-0 truncate')}>{title}</div>
        {headerTrailing}
        <NotePageCreateMenu
          onCreate={onCreateNote}
          creating={creating}
          disabled={loading}
        />
      </header>
      <NotesPagesSortMenu
        sortKey={pagesSort}
        onSortChange={onPagesSortChange}
        disabled={loading && pageRows.length === 0}
      />
      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {loading && pageRows.length === 0 ? (
          <div className="flex items-center gap-2 p-4 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {t('common.loading')}
          </div>
        ) : pageRows.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-2 py-8">
            <p className="text-center text-xs text-muted-foreground">{t('notes.shell.pagesEmpty')}</p>
            <NotePageCreateMenu
              variant="button"
              onCreate={onCreateNote}
              creating={creating}
              buttonLabel={t('notes.shell.newPage')}
            />
          </div>
        ) : (
          <div className="space-y-0.5">
            {pageRows.map(({ note, depth, hasChildren, collapsed }) => (
              <NotesPageRow
                key={note.id}
                note={note}
                depth={depth}
                hasChildren={hasChildren}
                collapsed={collapsed}
                onToggleCollapse={onTogglePageCollapse}
                active={activeNoteId === note.id}
                selected={selectedNoteIds.has(note.id)}
                categoryColorByName={categoryColorByName}
                onOpen={(n, e): void => onOpenNote(n, e)}
                onRenameTitle={onRenameNoteTitle}
                onPatchDisplay={onPatchNoteDisplay}
                onContextMenu={openContextMenu}
                isExiting={isNoteExiting(note.id)}
                sectionLabel={
                  showSectionLabels ? sectionLabelForNote(note, sections, t) : undefined
                }
              />
            ))}
          </div>
        )}
      </div>

      {contextMenu ? (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenuItems}
          onClose={(): void => setContextMenu(null)}
        />
      ) : null}

      {linkNoteId != null ? (
        <NoteEntityLinkPickerDialog
          noteId={linkNoteId}
          open
          onClose={(): void => setLinkNoteId(null)}
        />
      ) : null}
    </div>
  )
}
