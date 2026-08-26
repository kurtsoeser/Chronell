import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ChevronDown, ChevronRight, FolderPlus, GripVertical } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { NoteSection, UserNoteListItem } from '@shared/types'
import { cn } from '@/lib/utils'
import { showAppConfirm } from '@/stores/app-dialog'
import {
  buildNoteSectionTree,
  isDescendantNoteSection,
  type NoteSectionTreeNode
} from '@/lib/notes-section-tree'
import {
  countNotesInSection,
  isAllNotesNavSelected,
  isCategoryNavSelected,
  isPinnedNavSelected,
  isSectionNavSelected,
  type NotesNavSelection,
  type NotesSectionsNavScope
} from '@/lib/notes-nav-selection'
import { collectDistinctNoteCategories, countPinnedNotes } from '@/lib/note-category-account'
import { outlookCategoryDotClass } from '@/lib/outlook-category-colors'
import { NOTE_DROP_UNGROUPED, noteSectionDragId, noteSectionDropId } from '@/lib/notes-sidebar-dnd'
import { buildNotesSectionContextMenuItems } from '@/lib/notes-section-context-menu'
import { NotesDropZone } from '@/app/notes/notes-dnd-ui'
import { NoteSectionIconColorFooter } from '@/app/notes/NoteSectionIconColorFooter'
import { CalendarEventIconPicker } from '@/components/CalendarEventIconPicker'
import { ContextMenu } from '@/components/ContextMenu'
import { resolveNoteSectionIconColor } from '@/lib/note-section-icons'

type SectionNavRowSharedProps = {
  sections: NoteSection[]
  notes: UserNoteListItem[]
  selection: NotesNavSelection
  draggingSectionId: number | null
  onSelect: (sectionId: number) => void
  collapsed: Partial<Record<string, boolean>>
  setCollapsed: React.Dispatch<React.SetStateAction<Partial<Record<string, boolean>>>>
  onRenameSection: (section: NoteSection, name: string) => void
  onDeleteSection: (section: NoteSection) => void
  onUpdateSectionIcon: (
    section: NoteSection,
    patch: { icon?: string | null; iconColor?: string | null }
  ) => void
  onAddSubsection: (sectionId: number) => void
  addingSubsectionForId: number | null
  newSubsectionName: string
  setNewSubsectionName: (value: string) => void
  onCreateSubsection: (parentId: number) => void
  onCancelSubsection: () => void
  renamingSectionId: number | null
  onClearRename: () => void
  onOpenContextMenu: (section: NoteSection, event: React.MouseEvent) => void
  t: (key: string, options?: Record<string, unknown>) => string
}

function SortableSectionList({
  nodes,
  ...rowProps
}: SectionNavRowSharedProps & { nodes: NoteSectionTreeNode[] }): JSX.Element {
  const items = useMemo(() => nodes.map((node) => noteSectionDragId(node.section.id)), [nodes])
  return (
    <SortableContext items={items} strategy={verticalListSortingStrategy}>
      {nodes.map((node) => (
        <SectionNavRow key={node.section.id} node={node} {...rowProps} />
      ))}
    </SortableContext>
  )
}

function SectionNavRow({
  node,
  sections,
  notes,
  selection,
  draggingSectionId,
  onSelect,
  collapsed,
  setCollapsed,
  onRenameSection,
  onDeleteSection,
  onUpdateSectionIcon,
  onAddSubsection,
  addingSubsectionForId,
  newSubsectionName,
  setNewSubsectionName,
  onCreateSubsection,
  onCancelSubsection,
  renamingSectionId,
  onClearRename,
  onOpenContextMenu,
  t
}: SectionNavRowSharedProps & { node: NoteSectionTreeNode }): JSX.Element {
  const key = String(node.section.id)
  const expanded = collapsed[key] !== true
  const selected = isSectionNavSelected(node.section.id, selection)
  const count = countNotesInSection(node.section.id, notes)
  const isAddingHere = addingSubsectionForId === node.section.id
  const iconColor = resolveNoteSectionIconColor(node.section.iconColor)
  const renaming = renamingSectionId === node.section.id
  const [draftName, setDraftName] = useState(node.section.name)
  const renameInputRef = useRef<HTMLInputElement>(null)

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: noteSectionDragId(node.section.id),
    disabled:
      draggingSectionId != null &&
      isDescendantNoteSection(node.section.id, draggingSectionId, sections)
  })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    ...(isDragging ? { zIndex: 10, position: 'relative' } : {})
  }

  useEffect(() => {
    if (!renaming) setDraftName(node.section.name)
  }, [node.section.name, renaming])

  useEffect(() => {
    if (renaming) renameInputRef.current?.focus()
  }, [renaming])

  const commitRename = (): void => {
    const name = draftName.trim()
    if (name) void onRenameSection(node.section, name)
    onClearRename()
  }

  const rowProps = {
    sections,
    notes,
    selection,
    draggingSectionId,
    onSelect,
    collapsed,
    setCollapsed,
    onRenameSection,
    onDeleteSection,
    onUpdateSectionIcon,
    onAddSubsection,
    addingSubsectionForId,
    newSubsectionName,
    setNewSubsectionName,
    onCreateSubsection,
    onCancelSubsection,
    renamingSectionId,
    onClearRename,
    onOpenContextMenu,
    t
  }

  return (
    <div style={style} className={cn(isDragging && 'z-10 opacity-80 shadow-sm')}>
      <NotesDropZone
        id={noteSectionDropId(node.section.id)}
        disabled={draggingSectionId != null}
      >
        <div
          ref={setNodeRef}
          className={cn(
            'group mb-0.5 flex items-center gap-0.5 rounded-md pr-1',
            selected ? 'bg-primary/15' : 'hover:bg-secondary/40'
          )}
          style={{ paddingLeft: node.depth * 12 }}
          onContextMenu={(e): void => onOpenContextMenu(node.section, e)}
        >
          <button
            type="button"
            className={cn(
              'touch-none flex h-6 w-4 shrink-0 cursor-grab items-center justify-center rounded text-muted-foreground/60',
              'opacity-0 transition-opacity hover:bg-secondary/60 hover:text-foreground active:cursor-grabbing',
              'group-hover:opacity-100 group-focus-within:opacity-100',
              isDragging && 'opacity-100'
            )}
            aria-label={t('notes.sections.sectionDragHandleAria')}
            title={t('notes.sections.sectionDragHandleAria')}
            onClick={(e): void => e.stopPropagation()}
            onDoubleClick={(e): void => e.stopPropagation()}
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={(): void => setCollapsed((c) => ({ ...c, [key]: expanded }))}
            className="rounded p-0.5 hover:bg-secondary"
          >
            {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
          <CalendarEventIconPicker
            layout="compact"
            openOn="doubleClick"
            iconId={node.section.icon}
            iconColorHex={iconColor}
            title={node.section.name}
            compactButtonClassName="h-6 w-6 border-0 bg-transparent shadow-none hover:bg-secondary/60"
            onIconChange={(iconId): void =>
              void onUpdateSectionIcon(node.section, { icon: iconId ?? null })
            }
            footer={
              <NoteSectionIconColorFooter
                iconColor={node.section.iconColor}
                onIconColorChange={(iconColor): void =>
                  void onUpdateSectionIcon(node.section, { iconColor })
                }
              />
            }
          />
          {renaming ? (
            <input
              ref={renameInputRef}
              value={draftName}
              onChange={(e): void => setDraftName(e.target.value)}
              className="min-w-0 flex-1 rounded-md border border-border bg-background px-1.5 py-0.5 text-xs font-medium text-foreground"
              onKeyDown={(e): void => {
                if (e.key === 'Escape') {
                  setDraftName(node.section.name)
                  onClearRename()
                }
                if (e.key === 'Enter') commitRename()
              }}
              onBlur={commitRename}
            />
          ) : (
            <button
              type="button"
              onClick={(): void => onSelect(node.section.id)}
              className={cn(
                'min-w-0 flex-1 truncate rounded-md px-1 py-0.5 text-left text-xs font-medium',
                selected ? 'text-foreground' : 'text-muted-foreground hover:bg-secondary/30'
              )}
              title={node.section.name}
            >
              {node.section.name}
            </button>
          )}
          <span className="shrink-0 pr-0.5 text-2xs tabular-nums text-muted-foreground">{count}</span>
        </div>
      </NotesDropZone>

      {expanded ? (
        <div className={cn(isDragging && 'pointer-events-none')}>
          {isAddingHere ? (
            <div className="mb-1 flex gap-1 px-2" style={{ paddingLeft: node.depth * 12 + 20 }}>
              <input
                value={newSubsectionName}
                onChange={(e): void => setNewSubsectionName(e.target.value)}
                placeholder={t('notes.sections.subsectionNamePlaceholder')}
                className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1 text-xs"
                autoFocus
                onKeyDown={(e): void => {
                  if (e.key === 'Enter') void onCreateSubsection(node.section.id)
                  if (e.key === 'Escape') onCancelSubsection()
                }}
              />
              <button
                type="button"
                onClick={(): void => void onCreateSubsection(node.section.id)}
                className="rounded-md bg-primary px-2 py-1 text-xs text-primary-foreground"
              >
                {t('common.create')}
              </button>
            </div>
          ) : null}
          {node.children.length > 0 ? <SortableSectionList nodes={node.children} {...rowProps} /> : null}
        </div>
      ) : null}
    </div>
  )
}

export function NotesSidebarSections({
  sections,
  notes,
  selection,
  onSelectScope,
  onSectionsChanged,
  draggingSectionId,
  embedded = false
}: {
  sections: NoteSection[]
  notes: UserNoteListItem[]
  selection: NotesNavSelection
  onSelectScope: (scope: NotesSectionsNavScope) => void
  onSectionsChanged: () => void
  draggingSectionId: number | null
  embedded?: boolean
}): JSX.Element {
  const { t } = useTranslation()
  const [collapsed, setCollapsed] = useState<Partial<Record<string, boolean>>>({})
  const [newSectionName, setNewSectionName] = useState('')
  const [addingSection, setAddingSection] = useState(false)
  const [addingSubsectionForId, setAddingSubsectionForId] = useState<number | null>(null)
  const [newSubsectionName, setNewSubsectionName] = useState('')
  const [renamingSectionId, setRenamingSectionId] = useState<number | null>(null)
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    section: NoteSection
  } | null>(null)
  const tree = useMemo(() => buildNoteSectionTree(sections, notes), [sections, notes])
  const ungroupedCount = tree.ungroupedNotes.length
  const pinnedCount = countPinnedNotes(notes)
  const categoryNames = collectDistinctNoteCategories(notes)
  const allNotesSelected = isAllNotesNavSelected(selection)
  const ungroupedSelected = isSectionNavSelected(null, selection)
  const pinnedSelected = isPinnedNavSelected(selection)

  const createSection = useCallback(
    async (parentId: number | null, name: string): Promise<void> => {
      const trimmed = name.trim()
      if (!trimmed) return
      await window.mailClient.notes.sections.create({ name: trimmed, parentId })
      onSectionsChanged()
    },
    [onSectionsChanged]
  )

  const renameSection = useCallback(
    async (section: NoteSection, name: string): Promise<void> => {
      const trimmed = name.trim()
      if (!trimmed || trimmed === section.name) return
      await window.mailClient.notes.sections.update({ id: section.id, name: trimmed })
      onSectionsChanged()
    },
    [onSectionsChanged]
  )

  const updateSectionIcon = useCallback(
    async (
      section: NoteSection,
      patch: { icon?: string | null; iconColor?: string | null }
    ): Promise<void> => {
      await window.mailClient.notes.sections.update({ id: section.id, ...patch })
      onSectionsChanged()
    },
    [onSectionsChanged]
  )

  const deleteSection = useCallback(
    async (section: NoteSection): Promise<void> => {
      const ok = await showAppConfirm(t('notes.sections.deleteConfirm', { name: section.name }), {
        title: t('notes.sections.deleteTitle'),
        confirmLabel: t('common.delete'),
        variant: 'danger'
      })
      if (!ok) return
      await window.mailClient.notes.sections.delete(section.id)
      onSectionsChanged()
    },
    [onSectionsChanged, t]
  )

  const openContextMenu = useCallback((section: NoteSection, event: React.MouseEvent): void => {
    event.preventDefault()
    setContextMenu({ x: event.clientX, y: event.clientY, section })
  }, [])

  const contextMenuItems = useMemo(
    () =>
      contextMenu
        ? buildNotesSectionContextMenuItems({
            t,
            section: contextMenu.section,
            onRename: (section): void => {
              setRenamingSectionId(section.id)
              setContextMenu(null)
            },
            onAddSubsection: (sectionId): void => {
              setAddingSubsectionForId(sectionId)
              setNewSubsectionName('')
              setAddingSection(false)
              setCollapsed((c) => ({ ...c, [String(sectionId)]: false }))
              setContextMenu(null)
            },
            onDelete: (section): void => {
              setContextMenu(null)
              void deleteSection(section)
            }
          })
        : [],
    [contextMenu, deleteSection, t]
  )

  const sectionRowProps: SectionNavRowSharedProps = {
    sections,
    notes,
    selection,
    draggingSectionId,
    onSelect: (sectionId): void => onSelectScope({ sectionId }),
    collapsed,
    setCollapsed,
    onRenameSection: renameSection,
    onDeleteSection: deleteSection,
    onUpdateSectionIcon: updateSectionIcon,
    onAddSubsection: (id): void => {
      setAddingSubsectionForId(id)
      setNewSubsectionName('')
      setAddingSection(false)
      setCollapsed((c) => ({ ...c, [String(id)]: false }))
    },
    addingSubsectionForId,
    newSubsectionName,
    setNewSubsectionName,
    onCreateSubsection: (parentId): void => {
      void createSection(parentId, newSubsectionName).then(() => {
        setNewSubsectionName('')
        setAddingSubsectionForId(null)
      })
    },
    onCancelSubsection: (): void => {
      setAddingSubsectionForId(null)
      setNewSubsectionName('')
    },
    renamingSectionId,
    onClearRename: (): void => setRenamingSectionId(null),
    onOpenContextMenu: openContextMenu,
    t
  }

  return (
    <div
      className={cn(
        'flex min-h-0 flex-1 flex-col overflow-y-auto',
        !embedded && 'border-b border-border'
      )}
    >
      <div className="space-y-2 px-2 py-2">
        <div className="flex items-center justify-between gap-2 px-1">
          {!embedded ? (
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t('notes.sections.title')}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">{t('notes.sections.manage')}</span>
          )}
          <button
            type="button"
            onClick={(): void => {
              setAddingSection((v) => !v)
              setAddingSubsectionForId(null)
            }}
            className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-2xs hover:bg-secondary"
          >
            <FolderPlus className="h-3 w-3" />
            {t('notes.sections.add')}
          </button>
        </div>
        {addingSection ? (
          <div className="flex gap-1 px-1">
            <input
              value={newSectionName}
              onChange={(e): void => setNewSectionName(e.target.value)}
              placeholder={t('notes.sections.namePlaceholder')}
              className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1 text-xs"
              onKeyDown={(e): void => {
                if (e.key === 'Enter') {
                  void createSection(null, newSectionName).then(() => {
                    setNewSectionName('')
                    setAddingSection(false)
                  })
                }
              }}
            />
            <button
              type="button"
              onClick={(): void => {
                void createSection(null, newSectionName).then(() => {
                  setNewSectionName('')
                  setAddingSection(false)
                })
              }}
              className="rounded-md bg-primary px-2 py-1 text-xs text-primary-foreground"
            >
              {t('common.create')}
            </button>
          </div>
        ) : null}
      </div>

      <div className="px-1 pb-2">
        <button
          type="button"
          onClick={(): void => onSelectScope('all')}
          className={cn(
            'mb-1 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs font-medium',
            allNotesSelected ? 'bg-primary/15 text-foreground' : 'text-muted-foreground hover:bg-secondary/40'
          )}
        >
          <span className="flex-1 truncate">{t('notes.sections.allNotes')}</span>
          <span className="shrink-0 text-2xs tabular-nums">{notes.length}</span>
        </button>

        <NotesDropZone id={NOTE_DROP_UNGROUPED} disabled={draggingSectionId != null}>
          <button
            type="button"
            onClick={(): void => onSelectScope('ungrouped')}
            className={cn(
              'mb-1 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs font-medium',
              ungroupedSelected ? 'bg-primary/15 text-foreground' : 'text-muted-foreground hover:bg-secondary/40'
            )}
          >
            <span className="flex-1 truncate">{t('notes.sections.ungrouped')}</span>
            <span className="shrink-0 text-2xs tabular-nums">{ungroupedCount}</span>
          </button>
        </NotesDropZone>

        <button
          type="button"
          onClick={(): void => onSelectScope('pinned')}
          className={cn(
            'mb-1 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs font-medium',
            pinnedSelected ? 'bg-primary/15 text-foreground' : 'text-muted-foreground hover:bg-secondary/40'
          )}
        >
          <span className="flex-1 truncate">{t('notes.sections.pinned')}</span>
          <span className="shrink-0 text-2xs tabular-nums">{pinnedCount}</span>
        </button>

        {tree.roots.length === 0 && sections.length === 0 ? (
          <p className="px-2 py-3 text-xs text-muted-foreground">{t('notes.shell.noSectionsYet')}</p>
        ) : (
          <SortableSectionList nodes={tree.roots} {...sectionRowProps} />
        )}

        {categoryNames.length > 0 ? (
          <div className="mt-3 border-t border-border/60 pt-2">
            <p className="mb-1 px-2 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t('notes.sections.categories')}
            </p>
            {categoryNames.map((name) => {
              const count = notes.filter((n) =>
                (n.categories ?? []).some((c) => c.toLowerCase() === name.toLowerCase())
              ).length
              const selected = isCategoryNavSelected(name, selection)
              return (
                <button
                  key={name}
                  type="button"
                  onClick={(): void => onSelectScope({ category: name })}
                  className={cn(
                    'mb-0.5 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs',
                    selected ? 'bg-primary/15 text-foreground' : 'text-muted-foreground hover:bg-secondary/40'
                  )}
                >
                  <span
                    className={cn('h-2 w-2 shrink-0 rounded-full', outlookCategoryDotClass(undefined))}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1 truncate">{name}</span>
                  <span className="shrink-0 text-2xs tabular-nums">{count}</span>
                </button>
              )
            })}
          </div>
        ) : null}
      </div>

      {contextMenu ? (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenuItems}
          onClose={(): void => setContextMenu(null)}
        />
      ) : null}
    </div>
  )
}
