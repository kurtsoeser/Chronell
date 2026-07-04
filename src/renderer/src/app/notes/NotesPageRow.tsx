import { memo, useEffect, useRef, useState, type MouseEvent } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { ChevronDown, ChevronRight, GripVertical, Pin } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { UserNoteListItem } from '@shared/types'
import { cn } from '@/lib/utils'
import { motionListItemExit } from '@/lib/motion'
import { noteDragId } from '@/lib/notes-sidebar-dnd'
import { NoteDisplayIcon } from '@/components/NoteDisplayIcon'
import { CalendarEventIconPicker } from '@/components/CalendarEventIconPicker'
import { IconColorPickerFooter } from '@/components/IconColorPickerFooter'
import { resolveEntityIconColor } from '@shared/entity-icon-color'
import { noteTitle } from '@/app/notes/notes-display-helpers'
import { NotesCategoryBadges } from '@/components/NotesCategoryBadges'

function NoteDragHandle({ noteId }: { noteId: number }): JSX.Element {
  const { t } = useTranslation()
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: noteDragId(noteId)
  })
  const label = t('notes.sections.dragHandleAria')
  return (
    <button
      type="button"
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        'flex h-7 w-5 shrink-0 cursor-grab items-center justify-center rounded text-muted-foreground/60',
        'hover:bg-secondary/60 hover:text-foreground active:cursor-grabbing',
        isDragging && 'opacity-50'
      )}
      aria-label={label}
      title={label}
      onClick={(e): void => e.stopPropagation()}
      onDoubleClick={(e): void => e.stopPropagation()}
    >
      <GripVertical className="h-3.5 w-3.5" />
    </button>
  )
}

export const NotesPageRow = memo(function NotesPageRow({
  note,
  depth = 0,
  hasChildren = false,
  collapsed = false,
  onToggleCollapse,
  active,
  selected,
  onOpen,
  onRenameTitle,
  onPatchDisplay,
  onContextMenu,
  sectionLabel,
  categoryColorByName,
  isExiting = false
}: {
  note: UserNoteListItem
  depth?: number
  hasChildren?: boolean
  collapsed?: boolean
  onToggleCollapse?: (note: UserNoteListItem) => void
  active: boolean
  selected: boolean
  onOpen: (note: UserNoteListItem, event: MouseEvent) => void
  onRenameTitle: (note: UserNoteListItem, title: string) => void | Promise<void>
  onPatchDisplay: (
    note: UserNoteListItem,
    patch: { iconId?: string | null; iconColor?: string | null }
  ) => void | Promise<void>
  onContextMenu?: (note: UserNoteListItem, event: MouseEvent) => void
  sectionLabel?: string
  categoryColorByName?: Map<string, string>
  isExiting?: boolean
}): JSX.Element {
  const { t } = useTranslation()
  const untitled = t('notes.shell.untitled')
  const displayTitle = noteTitle(note, untitled)

  const [renaming, setRenaming] = useState(false)
  const [draftTitle, setDraftTitle] = useState(displayTitle)
  const renameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!renaming) setDraftTitle(displayTitle)
  }, [displayTitle, renaming])

  useEffect(() => {
    if (renaming) renameInputRef.current?.focus()
  }, [renaming])

  const commitRename = (): void => {
    const title = draftTitle.trim()
    setRenaming(false)
    if (!title || title === displayTitle) return
    void onRenameTitle(note, title)
  }

  return (
    <div
      className={cn(
        'flex min-w-0 items-center gap-0.5 rounded-md transition-colors',
        selected ? 'bg-primary/10 ring-1 ring-primary/20 ring-inset' : active ? 'bg-secondary font-medium text-foreground' : 'hover:bg-secondary/60',
        isExiting && motionListItemExit
      )}
      style={depth > 0 ? { paddingLeft: `${depth * 0.85}rem` } : undefined}
      onContextMenu={
        onContextMenu
          ? (e): void => {
              e.preventDefault()
              onContextMenu(note, e)
            }
          : undefined
      }
    >
      {hasChildren ? (
        <button
          type="button"
          onClick={(e): void => {
            e.stopPropagation()
            onToggleCollapse?.(note)
          }}
          className="flex h-7 w-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
          aria-label={collapsed ? t('notes.subPages.expand') : t('notes.subPages.collapse')}
          title={collapsed ? t('notes.subPages.expand') : t('notes.subPages.collapse')}
        >
          {collapsed ? (
            <ChevronRight className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
        </button>
      ) : (
        <span className="w-5 shrink-0" aria-hidden />
      )}
      <NoteDragHandle noteId={note.id} />
      {note.isPinned ? (
        <Pin className="h-3 w-3 shrink-0 text-primary/80" aria-label={t('notes.pagesContextMenu.pin')} />
      ) : null}
      <CalendarEventIconPicker
        layout="compact"
        openOn="doubleClick"
        iconId={note.iconId}
        iconColorHex={resolveEntityIconColor(note.iconColor)}
        title={displayTitle}
        compactButtonClassName="h-7 w-7 shrink-0 border-0 bg-transparent shadow-none hover:bg-secondary/60"
        triggerIcon={<NoteDisplayIcon note={note} />}
        onIconChange={(iconId): void => void onPatchDisplay(note, { iconId: iconId ?? null })}
        footer={
          <IconColorPickerFooter
            iconColor={note.iconColor}
            onIconColorChange={(iconColor): void => void onPatchDisplay(note, { iconColor })}
          />
        }
      />
      {renaming ? (
        <input
          ref={renameInputRef}
          value={draftTitle}
          onChange={(e): void => setDraftTitle(e.target.value)}
          className="min-w-0 flex-1 rounded-md border border-border bg-background py-1.5 pr-2 text-xs text-foreground"
          onKeyDown={(e): void => {
            if (e.key === 'Escape') {
              setDraftTitle(displayTitle)
              setRenaming(false)
            }
            if (e.key === 'Enter') commitRename()
          }}
          onBlur={commitRename}
          onClick={(e): void => e.stopPropagation()}
        />
      ) : (
        <button
          type="button"
          onClick={(e): void => onOpen(note, e)}
          onDoubleClick={(e): void => {
            e.preventDefault()
            e.stopPropagation()
            setDraftTitle(note.title?.trim() ?? displayTitle)
            setRenaming(true)
          }}
          className="min-w-0 flex-1 truncate py-1.5 pr-2 text-left text-xs"
          title={t('notes.sections.renameDoubleClick')}
        >
          <span className="block truncate">{displayTitle}</span>
          {(note.categories?.length ?? 0) > 0 && categoryColorByName ? (
            <NotesCategoryBadges
              names={note.categories ?? []}
              colorByName={categoryColorByName}
              className="mt-0.5"
              maxVisible={2}
            />
          ) : null}
          {sectionLabel ? (
            <span className="block truncate text-2xs font-normal text-muted-foreground">
              {sectionLabel}
            </span>
          ) : null}
        </button>
      )}
    </div>
  )
})
