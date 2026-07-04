import { useCallback } from 'react'
import type { DragEndEvent } from '@dnd-kit/core'
import type { ConnectedAccount, UserNote, UserNoteListItem } from '@shared/types'
import { noteTitle } from '@/app/notes/notes-display-helpers'
import { clearLastOpenedNoteIdIfMatches } from '@/app/notes/notes-last-opened-note-storage'
import { resolveNoteCategoryAccountId } from '@/lib/note-category-account'
import { safeMoveNoteToParent, safeSetNoteCategories, safeSetNotePinned } from '@/lib/notes-ipc-client'
import { parseNoteDragId, parseNoteNavDropId } from '@/lib/notes-sidebar-dnd'
import type { NotesNavSelection } from '@/lib/notes-nav-selection'
import type { NotesSidebarListMode } from '@/lib/notes-sidebar-storage'
import { showAppConfirm } from '@/stores/app-dialog'
import type { IdBulkSelection } from '@/lib/id-bulk-selection'

export interface UseNotesPageActionsOptions {
  t: (key: string, options?: Record<string, unknown>) => string
  accounts: ConnectedAccount[]
  notes: UserNoteListItem[]
  listMode: NotesSidebarListMode
  navSelection: NotesNavSelection
  setNavSelection: (selection: NotesNavSelection) => void
  load: () => Promise<void>
  loadSections: () => Promise<void>
  applyNotePatch: (note: UserNote | UserNoteListItem) => void
  pagesSelection: IdBulkSelection<number>
  editingId: number | null | undefined
  setEditing: (note: null) => void
  setSaving: (saving: boolean) => void
  setError: (error: string | null) => void
  clearSelectedMessage: () => void
  openEdit: (note: UserNote | UserNoteListItem) => void
  expandParentPage: (parentId: number) => void
  markNoteExiting: (id: number, onHidden: () => void) => void
  pushToast: (input: { label: string; variant: 'success' | 'error' | 'info' }) => void
}

export function useNotesPageActions({
  t,
  accounts,
  notes,
  listMode,
  setNavSelection,
  load,
  loadSections,
  applyNotePatch,
  pagesSelection,
  editingId,
  setEditing,
  setSaving,
  setError,
  clearSelectedMessage,
  openEdit,
  expandParentPage,
  markNoteExiting,
  pushToast
}: UseNotesPageActionsOptions) {
  const deleteNote = useCallback(
    async (note: UserNoteListItem): Promise<void> => {
      const title = noteTitle(note, t('notes.shell.untitled'))
      const ok = await showAppConfirm(t('notes.shell.deleteConfirm', { title }), {
        title: t('notes.shell.deleteTitle'),
        confirmLabel: t('common.delete'),
        cancelLabel: t('common.cancel'),
        variant: 'danger'
      })
      if (!ok) return

      markNoteExiting(note.id, () => {
        void (async (): Promise<void> => {
          setSaving(true)
          try {
            await window.mailClient.notes.delete(note.id)
            clearLastOpenedNoteIdIfMatches(note.id)
            if (editingId === note.id) {
              setEditing(null)
              clearSelectedMessage()
            }
            pushToast({ label: t('notes.shell.deleted'), variant: 'success' })
            await load()
            await loadSections()
          } catch (e) {
            setError(e instanceof Error ? e.message : String(e))
          } finally {
            setSaving(false)
          }
        })()
      })
    },
    [
      t,
      markNoteExiting,
      setSaving,
      editingId,
      setEditing,
      clearSelectedMessage,
      pushToast,
      load,
      loadSections,
      setError
    ]
  )

  const deleteCheckedNotes = useCallback(async (): Promise<void> => {
    const ids = [...pagesSelection.selectedIds]
    if (ids.length === 0) return
    const ok = await showAppConfirm(t('notes.shell.deleteBulkConfirm', { count: ids.length }), {
      title: t('notes.shell.deleteTitle'),
      confirmLabel: t('common.delete'),
      cancelLabel: t('common.cancel'),
      variant: 'danger'
    })
    if (!ok) return

    setSaving(true)
    try {
      for (const id of ids) {
        await window.mailClient.notes.delete(id)
        clearLastOpenedNoteIdIfMatches(id)
        if (editingId === id) {
          setEditing(null)
          clearSelectedMessage()
        }
      }
      pagesSelection.clear()
      pushToast({
        label: t('notes.shell.deletedBulk', { count: ids.length }),
        variant: 'success'
      })
      await load()
      await loadSections()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }, [
    pagesSelection,
    t,
    editingId,
    setEditing,
    clearSelectedMessage,
    pushToast,
    load,
    loadSections,
    setSaving,
    setError
  ])

  const copyNote = useCallback(
    async (note: UserNoteListItem): Promise<void> => {
      setSaving(true)
      setError(null)
      try {
        const full = (await window.mailClient.notes.getById(note.id)) ?? note
        const baseTitle = noteTitle(full, t('notes.shell.untitled')).trim()
        const title = baseTitle
          ? `${baseTitle}${t('calendar.context.duplicateSuffix')}`
          : t('notes.shell.newStandaloneTitle')
        let created = await window.mailClient.notes.createStandalone({
          title,
          body: full.body,
          sectionId: full.sectionId ?? note.sectionId ?? null,
          scheduledStartIso: full.scheduledStartIso ?? undefined,
          scheduledEndIso: full.scheduledEndIso ?? undefined,
          scheduledAllDay: full.scheduledAllDay
        })
        if (full.iconId || full.iconColor) {
          created = await window.mailClient.notes.patchDisplay({
            noteId: created.id,
            iconId: full.iconId,
            iconColor: full.iconColor
          })
        }
        const catAccount = resolveNoteCategoryAccountId(full, accounts)
        const cats = full.categories ?? []
        if (catAccount && cats.length > 0) {
          await safeSetNoteCategories({
            noteId: created.id,
            accountId: catAccount,
            categories: cats
          })
        }
        clearSelectedMessage()
        openEdit(created)
        pushToast({ label: t('notes.pagesContextMenu.copied'), variant: 'success' })
        await load()
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        setSaving(false)
      }
    },
    [t, clearSelectedMessage, openEdit, pushToast, load, accounts, setSaving, setError]
  )

  const togglePinNote = useCallback(
    async (note: UserNoteListItem): Promise<void> => {
      setError(null)
      try {
        await safeSetNotePinned({ noteId: note.id, isPinned: !note.isPinned })
        await load()
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      }
    },
    [load, setError]
  )

  const createSubPage = useCallback(
    async (parent: UserNoteListItem): Promise<void> => {
      setSaving(true)
      setError(null)
      try {
        const note = await window.mailClient.notes.createStandalone({
          title: t('notes.shell.newSubPageTitle'),
          sectionId: parent.sectionId ?? null,
          parentNoteId: parent.id
        })
        expandParentPage(parent.id)
        clearSelectedMessage()
        openEdit(note)
        await load()
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        setSaving(false)
      }
    },
    [t, expandParentPage, clearSelectedMessage, openEdit, load, setSaving, setError]
  )

  const moveNoteToParent = useCallback(
    async (note: UserNoteListItem, parentNoteId: number | null): Promise<void> => {
      setError(null)
      try {
        await safeMoveNoteToParent({ noteId: note.id, parentNoteId })
        await load()
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      }
    },
    [load, setError]
  )

  const moveNote = useCallback(
    async (note: UserNoteListItem, sectionId: number | null): Promise<void> => {
      setError(null)
      try {
        await window.mailClient.notes.moveToSection({ noteId: note.id, sectionId })
        if (listMode === 'sections') {
          setNavSelection({
            kind: 'sections',
            scope: sectionId == null ? 'ungrouped' : { sectionId }
          })
        }
        await load()
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      }
    },
    [listMode, load, setNavSelection, setError]
  )

  const handleNoteDragEnd = useCallback(
    (ev: DragEndEvent): void => {
      if (listMode !== 'sections') return
      const noteId = parseNoteDragId(String(ev.active.id))
      if (noteId == null || !ev.over) return
      const drop = parseNoteNavDropId(String(ev.over.id))
      if (!drop || !('sectionId' in drop)) return
      const note = notes.find((n) => n.id === noteId)
      if (!note) return
      const targetSectionId = drop.sectionId
      if ((note.sectionId ?? null) === targetSectionId) return
      void window.mailClient.notes.moveToSection({ noteId, sectionId: targetSectionId }).then(() => {
        setNavSelection({
          kind: 'sections',
          scope: targetSectionId == null ? 'ungrouped' : { sectionId: targetSectionId }
        })
      })
    },
    [listMode, notes, setNavSelection]
  )

  return {
    deleteNote,
    deleteCheckedNotes,
    copyNote,
    togglePinNote,
    createSubPage,
    moveNoteToParent,
    moveNote,
    handleNoteDragEnd
  }
}
