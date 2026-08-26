import { useCallback, useMemo, useState } from 'react'
import {
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragCancelEvent,
  type DragEndEvent,
  type DragStartEvent
} from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import type { NoteSection, UserNoteListItem } from '@shared/types'
import {
  noteSectionParentId,
  orderedNoteSectionSiblingIds
} from '@/lib/notes-section-tree'
import {
  createNoteSectionSiblingCollisionDetection,
  parseNoteDragId,
  parseNoteNavDropId,
  parseNoteSectionDragId,
  resolveNoteSectionReorderOverId
} from '@/lib/notes-sidebar-dnd'
import type { NotesNavSelection } from '@/lib/notes-nav-selection'
import type { NotesSidebarListMode } from '@/lib/notes-sidebar-storage'

export function useNotesShellDnd({
  sections,
  notes,
  listMode,
  setNavSelection,
  onSectionsChanged,
  load
}: {
  sections: NoteSection[]
  notes: UserNoteListItem[]
  listMode: NotesSidebarListMode
  setNavSelection: (selection: NotesNavSelection) => void
  onSectionsChanged: () => void
  load: () => Promise<void>
}): {
  sensors: ReturnType<typeof useSensors>
  collisionDetection: CollisionDetection
  draggingSectionId: number | null
  onDragStart: (ev: DragStartEvent) => void
  onDragEnd: (ev: DragEndEvent) => void
  onDragCancel: (ev: DragCancelEvent) => void
} {
  const [draggingSectionId, setDraggingSectionId] = useState<number | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const sectionCollisionDetection = useMemo(
    () => createNoteSectionSiblingCollisionDetection(sections),
    [sections]
  )

  const collisionDetection = useCallback<CollisionDetection>(
    (args) => {
      if (parseNoteSectionDragId(String(args.active.id)) != null) {
        return sectionCollisionDetection(args)
      }
      return closestCorners(args)
    },
    [sectionCollisionDetection]
  )

  const onDragStart = useCallback((ev: DragStartEvent): void => {
    const activeId = parseNoteSectionDragId(String(ev.active.id))
    if (activeId != null) setDraggingSectionId(activeId)
  }, [])

  const onDragCancel = useCallback((): void => {
    setDraggingSectionId(null)
  }, [])

  const onDragEnd = useCallback(
    (ev: DragEndEvent): void => {
      const activeSectionId = parseNoteSectionDragId(String(ev.active.id))
      if (activeSectionId != null) {
        setDraggingSectionId(null)
        if (!ev.over) return

        const overId = resolveNoteSectionReorderOverId(String(ev.over.id))
        if (overId == null || activeSectionId === overId) return

        const parentId = noteSectionParentId(activeSectionId, sections)
        const overParentId = noteSectionParentId(overId, sections)
        if (parentId !== overParentId) return

        const ids = orderedNoteSectionSiblingIds(parentId, sections)
        const oldIndex = ids.indexOf(activeSectionId)
        const newIndex = ids.indexOf(overId)
        if (oldIndex < 0 || newIndex < 0) return

        void window.mailClient.notes.sections
          .reorder({ parentId, orderedIds: arrayMove(ids, oldIndex, newIndex) })
          .then(onSectionsChanged)
        return
      }

      if (listMode !== 'sections') return
      const noteId = parseNoteDragId(String(ev.active.id))
      if (noteId == null || !ev.over) return
      const drop = parseNoteNavDropId(String(ev.over.id))
      if (!drop || !('sectionId' in drop)) return
      const note = notes.find((n) => n.id === noteId)
      if (!note) return
      const targetSectionId = drop.sectionId
      if ((note.sectionId ?? null) === targetSectionId) return
      void window.mailClient.notes
        .moveToSection({ noteId, sectionId: targetSectionId })
        .then(() => {
          setNavSelection({
            kind: 'sections',
            scope: targetSectionId == null ? 'ungrouped' : { sectionId: targetSectionId }
          })
          return load()
        })
    },
    [sections, onSectionsChanged, listMode, notes, setNavSelection, load]
  )

  return {
    sensors,
    collisionDetection,
    draggingSectionId,
    onDragStart,
    onDragEnd,
    onDragCancel
  }
}
