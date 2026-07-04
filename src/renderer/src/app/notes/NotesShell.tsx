import { useCallback, useMemo, useRef, useState } from 'react'
import { DndContext, PointerSensor, closestCorners, useSensor, useSensors } from '@dnd-kit/core'
import { useTranslation } from 'react-i18next'
import type { NoteEntityLinkedItem } from '@shared/note-entity-links'
import type { NotePageTemplateEditorState } from '@/components/NotePageTemplateEditDialog'
import { modulePaneStackClass, moduleShellClass } from '@/components/module-shell-layout'
import { VerticalSplitter } from '@/components/ResizableSplitter'
import { NotesShellNoteEditorColumn } from '@/app/notes/NotesShellNoteEditorColumn'
import { NotesLinkedPreviewPane } from '@/app/notes/NotesLinkedPreviewPane'
import { NotesPagesPane } from '@/app/notes/NotesPagesPane'
import { NotesShellSearch } from '@/app/notes/NotesShellSearch'
import { NotesShellViewToggle } from '@/app/notes/NotesShellViewToggle'
import { NotesCalendarPane } from '@/app/notes/NotesCalendarPane'
import { NotesCalendarToolbar } from '@/app/notes/NotesCalendarToolbar'
import { linkedItemToPreviewEntry } from '@/app/notes/notes-link-preview-items'
import { NotesShellNavColumn } from '@/app/notes/shell/NotesShellNavColumn'
import { NotesShellOverlays } from '@/app/notes/shell/NotesShellOverlays'
import { useNotesEditorSession } from '@/app/notes/shell/use-notes-editor-session'
import { useNotesEditorColumnProps } from '@/app/notes/shell/use-notes-editor-column-props'
import { useNotesLinkedPreview } from '@/app/notes/shell/use-notes-linked-preview'
import { useNotesListData } from '@/app/notes/shell/use-notes-list-data'
import { useNotesPageActions } from '@/app/notes/shell/use-notes-page-actions'
import { useNotesShellLayout } from '@/app/notes/shell/use-notes-shell-layout'
import {
  moduleColumnHeaderShellBarClass,
  moduleColumnHeaderTitleClass
} from '@/components/ModuleColumnHeader'
import { useDateFnsLocale } from '@/lib/date-fns-locale'
import { useCustomNotePageTemplates } from '@/hooks/use-custom-note-page-templates'
import { useExitingIds } from '@/lib/use-exiting-ids'
import { useBulkListKeyboardShortcuts } from '@/lib/use-bulk-list-keyboard-shortcuts'
import { useAccountsStore } from '@/stores/accounts'
import { useMailStore } from '@/stores/mail'
import { useUndoStore } from '@/stores/undo'
import { cn } from '@/lib/utils'

export function NotesShell(): JSX.Element {
  const { t } = useTranslation()
  const dfLocale = useDateFnsLocale()
  const accounts = useAccountsStore((s) => s.accounts)
  const selectMessageWithThreadPreview = useMailStore((s) => s.selectMessageWithThreadPreview)
  const clearSelectedMessage = useMailStore((s) => s.clearSelectedMessage)
  const pushToast = useUndoStore((s) => s.pushToast)
  const { customTemplates } = useCustomNotePageTemplates()
  const { isExiting: isNoteExiting, markExiting: markNoteExiting } = useExitingIds<number>()

  const editingNoteIdRef = useRef<number | null | undefined>(null)
  const reloadLinksBundleRef = useRef<(noteId: number) => Promise<void>>(async () => {})

  const list = useNotesListData(accounts, editingNoteIdRef)
  const layout = useNotesShellLayout(list.notesSettings)

  const editor = useNotesEditorSession({
    notes: list.notes,
    sections: list.sections,
    applyNotePatch: list.applyNotePatch,
    load: list.load,
    loadSections: list.loadSections,
    notesSettings: list.notesSettings,
    accounts,
    customTemplates,
    listMode: list.listMode,
    navSelection: list.navSelection,
    clearSelectedMessage,
    selectMessageWithThreadPreview,
    pushToast,
    t,
    dfLocale,
    onShellViewChange: layout.onShellViewChange,
    reloadLinksBundle: (noteId) => reloadLinksBundleRef.current(noteId),
    expandParentPage: list.expandParentPage,
    notesLoading: list.loading
  })

  editingNoteIdRef.current = editor.editing?.id

  const preview = useNotesLinkedPreview(editor.editing, list.notesSettings, editor.linksBodyHtml)
  reloadLinksBundleRef.current = preview.reloadLinksBundle

  const pageActions = useNotesPageActions({
    t: list.t,
    accounts,
    notes: list.notes,
    listMode: list.listMode,
    navSelection: list.navSelection,
    setNavSelection: list.setNavSelection,
    load: list.load,
    loadSections: list.loadSections,
    applyNotePatch: list.applyNotePatch,
    pagesSelection: list.pagesSelection,
    editingId: editor.editing?.id,
    setEditing: editor.setEditing,
    setSaving: editor.setSaving,
    setError: editor.setError,
    clearSelectedMessage,
    openEdit: editor.openEdit,
    expandParentPage: list.expandParentPage,
    markNoteExiting,
    pushToast
  })

  useBulkListKeyboardShortcuts(list.pagesSelection.selectedCount, {
    onDelete: (): void => {
      void pageActions.deleteCheckedNotes()
    },
    onClear: list.pagesSelection.clear,
    onSelectAll: list.pagesSelection.selectAllVisible
  })

  const [categoryPopover, setCategoryPopover] = useState<{ x: number; y: number } | null>(null)
  const [sectionPopover, setSectionPopover] = useState<{ x: number; y: number } | null>(null)
  const [templateFromNoteOpen, setTemplateFromNoteOpen] =
    useState<NotePageTemplateEditorState | null>(null)

  const onSelectLinkForPreview = useCallback(
    (item: NoteEntityLinkedItem, direction: 'outgoing' | 'incoming'): void => {
      preview.setLinkedPreviewKey(linkedItemToPreviewEntry(item, direction, t).key)
      preview.openLinkedPreview()
    },
    [preview, t]
  )

  const onCreateSubPage = useCallback((): void => {
    if (editor.editing) void pageActions.createSubPage(editor.editing as import('@shared/types').UserNoteListItem)
  }, [editor.editing, pageActions])

  const onDeleteNote = useCallback((): void => {
    if (editor.editing) void pageActions.deleteNote(editor.editing as import('@shared/types').UserNoteListItem)
  }, [editor.editing, pageActions])

  const editorColumnBaseProps = useNotesEditorColumnProps({
    editor,
    list,
    preview,
    onSelectLinkForPreview,
    onCreateSubPage,
    onDeleteNote,
    onSaveTemplateFromNote: (): void =>
      setTemplateFromNoteOpen({
        mode: 'create',
        name: editor.editTitleRef.current.trim() || t('notes.shell.untitled'),
        description: '',
        bodyHtml: editor.editBodyRef.current
      })
  })

  const editorColumnProps = useMemo(
    () => ({
      ...editorColumnBaseProps,
      onOpenCategories: setCategoryPopover,
      onOpenSection: setSectionPopover,
      onEntityMentionLinkError: (message: string): void => {
        pushToast({ label: message, variant: 'error' })
      }
    }),
    [editorColumnBaseProps, pushToast]
  )

  const refreshEditingNote = useCallback((): void => {
    if (!editor.editing) return
    void list.load().then(() => {
      void window.mailClient.notes.getById(editor.editing!.id).then((fresh) => {
        if (fresh) editor.setEditing(fresh)
      })
    })
  }, [editor, list])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const linkedPreviewPane =
    editor.editing != null ? (
      <NotesLinkedPreviewPane
        open={preview.linkedPreviewOpen}
        placement={preview.linkedPreviewPlacement}
        onPlacementChange={preview.setLinkedPreviewPlacementPersisted}
        onClose={preview.closeLinkedPreview}
        entries={preview.previewEntries}
        selectedKey={preview.linkedPreviewKey}
        onSelectKey={preview.setLinkedPreviewKey}
        editing={editor.editing}
        accounts={accounts}
        dockWidthPx={preview.previewDockWidth}
        onDockWidthDrag={(delta): void => preview.setPreviewDockWidth((w) => w - delta)}
        floatDefaultWidth={list.notesSettings.defaultFloatPreviewWidth}
        floatDefaultHeight={list.notesSettings.defaultFloatPreviewHeight}
      />
    ) : null

  return (
    <section className={moduleShellClass}>
      <NotesShellNavColumn list={list} layout={layout} accounts={accounts} />

      <VerticalSplitter
        variant="moduleNav"
        ariaLabel={t('common.moduleNavSplitter')}
        onDrag={(delta): void => layout.setNavWidth((w) => w + delta)}
      />

      {layout.shellView === 'calendar' ? (
        <div className={cn(modulePaneStackClass, 'flex-row')}>
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <header className={cn(moduleColumnHeaderShellBarClass, 'shrink-0 border-b border-border')}>
              <div className={moduleColumnHeaderTitleClass}>{t('notes.shell.selectNote')}</div>
              <div className="flex min-w-0 shrink-0 items-center gap-1.5">
                <NotesShellSearch
                  sections={list.sections}
                  accounts={accounts}
                  onOpenNote={editor.openEdit}
                />
                <NotesShellViewToggle value={layout.shellView} onChange={layout.onShellViewChange} />
              </div>
            </header>
            <NotesCalendarToolbar
              calendarRef={layout.notesCalendarRef}
              calendarTitle={layout.calendarTitle}
              activeFcView={layout.calendarFcView}
              onActiveFcViewChange={layout.onCalendarFcViewChange}
              dateMode={layout.calendarDateMode}
              onDateModeChange={layout.setCalendarDateMode}
            />
            <NotesCalendarPane
              onPreviewNote={editor.openEdit}
              onOpenNoteInList={editor.openNoteInListFromCalendar}
              fcView={layout.calendarFcView}
              fullCalendarRef={layout.notesCalendarRef}
              onViewMeta={(meta): void => layout.setCalendarTitle(meta.title)}
              previewNoteId={editor.editing?.id ?? null}
              dateMode={layout.calendarDateMode}
              navSelection={list.navSelection}
              miniCalendarRange={list.selectedRange}
              className="min-h-0 min-w-0 flex-1"
            />
          </div>
          {editor.editing ? (
            <>
              <VerticalSplitter
                ariaLabel={t('notes.shell.splitterPreviewAria')}
                onDrag={(delta): void => layout.setCalendarEditorWidth((w) => w - delta)}
              />
              <NotesShellNoteEditorColumn
                layout="calendar"
                widthPx={layout.calendarEditorWidth}
                {...editorColumnProps}
              />
            </>
          ) : null}
          {linkedPreviewPane}
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragEnd={pageActions.handleNoteDragEnd}
        >
          <div className={cn(modulePaneStackClass, 'flex-row')}>
            <aside
              className="flex min-h-0 shrink-0 flex-col border-r border-border"
              style={{ width: layout.detailColumnWidth }}
            >
              <NotesPagesPane
                title={list.pagesColumnTitle}
                pageRows={list.pageRows}
                sections={list.sections}
                categoryColorByName={list.categoryColorByName}
                showSectionLabels={list.showSectionLabelsInPages}
                loading={list.loading}
                activeNoteId={editor.editing?.id ?? null}
                selectedNoteIds={list.pagesSelection.selectedIds}
                onOpenNote={(note, e): void => {
                  list.pagesSelection.handlePointerDown(note.id, {
                    shiftKey: e.shiftKey,
                    ctrlKey: e.ctrlKey,
                    metaKey: e.metaKey
                  })
                  editor.openEdit(note)
                }}
                onRenameNoteTitle={editor.renameNoteTitleInList}
                onPatchNoteDisplay={editor.patchNoteDisplayInList}
                onDeleteNote={pageActions.deleteNote}
                isNoteExiting={isNoteExiting}
                onCopyNote={pageActions.copyNote}
                onMoveNote={pageActions.moveNote}
                onTogglePin={pageActions.togglePinNote}
                onCreateSubPage={pageActions.createSubPage}
                onMoveToParent={pageActions.moveNoteToParent}
                onTogglePageCollapse={list.togglePageCollapse}
                onCreateNote={(templateId, override): void => void editor.createStandalone(templateId, override)}
                creating={editor.saving}
                pagesSort={list.pagesSort}
                onPagesSortChange={list.setPagesSort}
              />
            </aside>

            <VerticalSplitter
              ariaLabel={t('notes.shell.splitterPagesAria')}
              onDrag={(delta): void => layout.setDetailColumnWidth((w) => w + delta)}
            />

            <NotesShellNoteEditorColumn
              layout="list"
              {...editorColumnProps}
              headerExtras={
                <>
                  <NotesShellSearch
                    sections={list.sections}
                    accounts={accounts}
                    onOpenNote={editor.openEdit}
                  />
                  <NotesShellViewToggle value={layout.shellView} onChange={layout.onShellViewChange} />
                </>
              }
            />

            {linkedPreviewPane}
          </div>
        </DndContext>
      )}

      <NotesShellOverlays
        editing={editor.editing}
        accounts={accounts}
        sections={list.sections}
        categoryPopover={categoryPopover}
        sectionPopover={sectionPopover}
        onCloseCategoryPopover={(): void => setCategoryPopover(null)}
        onCloseSectionPopover={(): void => setSectionPopover(null)}
        onRefreshEditingNote={refreshEditingNote}
        templateFromNoteOpen={templateFromNoteOpen}
        onCloseTemplateFromNote={(): void => setTemplateFromNoteOpen(null)}
        onTemplateSaved={(): void => setTemplateFromNoteOpen(null)}
        meetingInsertOpen={editor.meetingInsertOpen}
        onCloseMeetingInsert={(): void => editor.setMeetingInsertOpen(false)}
        onMeetingInsert={editor.handleMeetingInsert}
        embedInsertOpen={editor.embedInsertOpen}
        onCloseEmbedInsert={(): void => editor.setEmbedInsertOpen(false)}
        editorRef={editor.editorRef}
        insertEmbedRef={editor.editorInsertEmbedRef}
        onEditBodyChange={editor.handleEditBodyChangeWithAutosave}
        onEmbedInserted={(): void => {
          pushToast({ label: t('notes.embedInsert.insertedToast'), variant: 'success' })
        }}
        onEmbedError={(message): void => {
          pushToast({ label: message, variant: 'error' })
        }}
        inkDialog={editor.noteInk.inkDialog}
        cloudTaskDialog={editor.noteCloudTask.cloudTaskDialog}
        calendarEventDialog={editor.noteCalendarEvent.calendarEventDialog}
        pushToast={pushToast}
        t={t}
      />
    </section>
  )
}
