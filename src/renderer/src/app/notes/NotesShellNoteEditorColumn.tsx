import { memo, useEffect, type ReactNode } from 'react'
import { FileDown, Loader2, PanelRightOpen, Printer, Trash2, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { NoteEntityLinkedItem, NoteLinksBundle } from '@shared/note-entity-links'
import type { Editor } from '@tiptap/react'
import type { NoteCloudTaskRef } from '@shared/note-cloud-task'
import type { NoteEmbedInsertTarget } from '@shared/note-embed-insert'
import type { NoteEditorSaveStatus } from '@/lib/note-editor-save-status'
import type { UserNote, UserNoteListItem } from '@shared/types'
import { NotesOneNotePageHeader } from '@/app/notes/NotesOneNotePageHeader'
import { NotesShellEditorPane } from '@/app/notes/NotesShellEditorPane'
import { noteTitle } from '@/app/notes/notes-display-helpers'
import { EntityContextBlock } from '@/components/connections/EntityContextBlock'
import {
  ModuleColumnHeaderIconButton,
  moduleColumnHeaderIconGlyphClass,
  moduleColumnHeaderOutlineSmClass,
  moduleColumnHeaderShellBarClass,
  moduleColumnHeaderTitleClass
} from '@/components/ModuleColumnHeader'
import { ContentCrossfade } from '@/components/motion/ContentCrossfade'
import { HorizontalSplitter, useResizableHeight } from '@/components/ResizableSplitter'
import { cn } from '@/lib/utils'
import {
  NOTES_CALENDAR_EDITOR_HEIGHT_DEFAULT,
  NOTES_CALENDAR_EDITOR_HEIGHT_KEY,
  NOTES_CALENDAR_EDITOR_HEIGHT_MIN,
  notesCalendarEditorHeightMax
} from '@/app/notes/shell/notes-shell-types'
type ScheduleDraft = {
  scheduledStartIso: string | null
  scheduledEndIso: string | null
  scheduledAllDay: boolean
  clearSchedule?: boolean
}

export type NotesShellNoteEditorColumnProps = {
  layout: 'list' | 'calendar'
  widthPx?: number
  editing: UserNote | null
  error: string | null
  saving: boolean
  openingNote?: boolean
  saveStatus?: NoteEditorSaveStatus
  lastSavedAt?: string | null
  editorSeedHtml: string
  linksBodyHtml?: string
  scheduleDraft: ScheduleDraft | null
  categoryColorByName: Map<string, string>
  editingSectionName: string | null
  editingBreadcrumb: UserNoteListItem[]
  notesById: Map<number, UserNoteListItem>
  notesSettings: {
    defaultScheduleDurationMinutes: number
    autosaveMode: string
    entityContextCollapsedDefault: boolean
  }
  previewEntriesCount: number
  linkedPreviewKey: string | null
  linkedPreviewOpen: boolean
  onLinkedPreviewToggle: () => void
  onSelectLinkForPreview: (item: NoteEntityLinkedItem, direction: 'outgoing' | 'incoming') => void
  onLinksLoaded: (bundle: NoteLinksBundle) => void
  headerExtras?: ReactNode
  onTitleChange: (title: string) => void
  onOpenNoteById: (id: number) => void
  onOpenCategories: (anchor: { x: number; y: number }) => void
  onOpenSection: (anchor: { x: number; y: number }) => void
  onIconChange: (iconId: string | undefined) => void
  onIconColorChange: (iconColor: string | null) => void
  onScheduleChange: (value: ScheduleDraft) => void
  onCreateSubPage: () => void
  onEditBodyChange: (html: string) => void
  onOpenMeetingInsert: () => void
  onRefreshMeetingDetails: () => void
  canRefreshMeetingDetails: boolean
  meetingRefreshBusy: boolean
  onOpenEmbedInsert: () => void
  onOpenScreenClip: () => void
  onOpenInkDraw: () => void
  onOpenCloudTaskCreate: () => void
  canCreateCloudTask: boolean
  onOpenCalendarEventCreate: () => void
  canCreateCalendarEvent: boolean
  onInkImageDoubleClick: (inkJsonAttachmentId: number) => void
  onCreateCloudTaskFromSelection: () => void
  onCreateCalendarEventFromSelection: () => void
  onCloudTaskToggle: (ref: NoteCloudTaskRef, completed: boolean) => void | Promise<void>
  onEntityMentionLinkAdded?: () => void
  onEntityMentionLinkError?: (message: string) => void
  editorRef: React.MutableRefObject<Editor | null>
  onDeleteNote: () => void
  onSaveTemplateFromNote: () => void
  onPrintPage: () => void
  onExportPdf: () => void
  onSave: () => void
  onClose: () => void
  editorFlushRef: React.MutableRefObject<(() => void) | null>
  editorInsertHtmlRef: React.MutableRefObject<((html: string) => void) | null>
  editorInsertEmbedRef: React.MutableRefObject<((target: NoteEmbedInsertTarget) => boolean) | null>
  editorReplaceInkRef: React.MutableRefObject<
    ((inkJsonAttachmentId: number, html: string) => void) | null
  >
  editorFocusedRef: React.MutableRefObject<boolean>
}

export const NotesShellNoteEditorColumn = memo(function NotesShellNoteEditorColumn({
  layout,
  widthPx,
  editing,
  error,
  saving,
  openingNote = false,
  saveStatus = 'idle',
  lastSavedAt = null,
  editorSeedHtml,
  linksBodyHtml,
  scheduleDraft,
  categoryColorByName,
  editingSectionName,
  editingBreadcrumb,
  notesById,
  notesSettings,
  previewEntriesCount,
  linkedPreviewKey,
  linkedPreviewOpen,
  onLinkedPreviewToggle,
  onSelectLinkForPreview,
  onLinksLoaded,
  headerExtras,
  onTitleChange,
  onOpenNoteById,
  onOpenCategories,
  onOpenSection,
  onIconChange,
  onIconColorChange,
  onScheduleChange,
  onCreateSubPage,
  onEditBodyChange,
  onOpenMeetingInsert,
  onRefreshMeetingDetails,
  canRefreshMeetingDetails,
  meetingRefreshBusy,
  onOpenEmbedInsert,
  onOpenScreenClip,
  onOpenInkDraw,
  onOpenCloudTaskCreate,
  canCreateCloudTask,
  onOpenCalendarEventCreate,
  canCreateCalendarEvent,
  onInkImageDoubleClick,
  onCreateCloudTaskFromSelection,
  onCreateCalendarEventFromSelection,
  onCloudTaskToggle,
  onEntityMentionLinkAdded,
  onEntityMentionLinkError,
  editorRef,
  onDeleteNote,
  onSaveTemplateFromNote,
  onPrintPage,
  onExportPdf,
  onSave,
  onClose,
  editorFlushRef,
  editorInsertHtmlRef,
  editorInsertEmbedRef,
  editorReplaceInkRef,
  editorFocusedRef
}: NotesShellNoteEditorColumnProps): JSX.Element {
  const { t } = useTranslation()
  const isCalendar = layout === 'calendar'
  const Tag = isCalendar ? 'aside' : 'main'
  const calendarEditorHeightMax = notesCalendarEditorHeightMax()
  const [calendarEditorPaneHeight, setCalendarEditorPaneHeight] = useResizableHeight({
    storageKey: NOTES_CALENDAR_EDITOR_HEIGHT_KEY,
    defaultHeight: NOTES_CALENDAR_EDITOR_HEIGHT_DEFAULT,
    minHeight: NOTES_CALENDAR_EDITOR_HEIGHT_MIN,
    maxHeight: calendarEditorHeightMax
  })

  useEffect(() => {
    if (!isCalendar) return
    const clamp = (): void => {
      const max = notesCalendarEditorHeightMax()
      setCalendarEditorPaneHeight((h) =>
        Math.min(max, Math.max(NOTES_CALENDAR_EDITOR_HEIGHT_MIN, h))
      )
    }
    window.addEventListener('resize', clamp)
    return (): void => window.removeEventListener('resize', clamp)
  }, [isCalendar, setCalendarEditorPaneHeight])

  return (
    <Tag
      className={cn(
        'flex min-h-0 min-w-0 flex-col',
        isCalendar ? 'shrink-0 border-l border-border bg-card' : 'flex-1'
      )}
      style={isCalendar && widthPx != null ? { width: widthPx } : undefined}
    >
      <header className={cn(moduleColumnHeaderShellBarClass, 'min-w-0 shrink-0')}>
        <div className={cn(moduleColumnHeaderTitleClass, 'min-w-0 truncate text-left')}>
          {editing ? noteTitle(editing, t('notes.shell.untitled')) : t('notes.shell.selectNote')}
        </div>
        <div className="flex min-w-0 shrink-0 items-center gap-1.5">
          {headerExtras}
          {editing && previewEntriesCount > 0 ? (
            <ModuleColumnHeaderIconButton
              type="button"
              onClick={onLinkedPreviewToggle}
              aria-label={t('notes.preview.togglePane')}
              title={t('notes.preview.togglePaneShort')}
            >
              <PanelRightOpen
                className={cn(moduleColumnHeaderIconGlyphClass, linkedPreviewOpen && 'text-primary')}
              />
            </ModuleColumnHeaderIconButton>
          ) : null}
          {editing ? (
            <ModuleColumnHeaderIconButton type="button" onClick={onClose} aria-label={t('common.close')}>
              <X className={moduleColumnHeaderIconGlyphClass} />
            </ModuleColumnHeaderIconButton>
          ) : null}
        </div>
      </header>

      {error ? (
        <div className="border-b border-border px-4 py-2 text-xs text-destructive">{error}</div>
      ) : null}

      {!editing ? (
        <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
          {t('notes.shell.selectNoteHint')}
        </div>
      ) : (
        <ContentCrossfade contentKey={editing.id} className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
          {openingNote ? (
            <div
              className="absolute inset-0 z-10 flex items-center justify-center bg-background/70 backdrop-blur-[1px]"
              aria-busy="true"
              aria-label={t('notes.editor.opening')}
            >
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                {t('notes.editor.opening')}
              </div>
            </div>
          ) : null}
          <div
            className={cn(
              'flex min-w-0 flex-col overflow-hidden bg-muted/15',
              isCalendar ? 'shrink-0' : 'min-h-0 flex-1'
            )}
            style={
              isCalendar
                ? { height: Math.min(calendarEditorPaneHeight, calendarEditorHeightMax) }
                : undefined
            }
          >
            <div className="note-onenote-page flex min-h-0 w-full min-w-0 flex-1 flex-col bg-card px-5 pb-4 pt-4 sm:px-6">
              <NotesOneNotePageHeader
                key={editing.id}
                note={editing}
                noteId={editing.id}
                categories={(editing as UserNoteListItem).categories ?? []}
                categoryColorByName={categoryColorByName}
                sectionName={editingSectionName}
                initialTitle={editing.title ?? ''}
                onTitleChange={onTitleChange}
                disabled={saving}
                breadcrumb={editingBreadcrumb.map((crumb) => ({
                  id: crumb.id,
                  title: noteTitle(crumb, t('notes.shell.untitled'))
                }))}
                onBreadcrumbNavigate={(id): void => {
                  const crumb = notesById.get(id)
                  if (crumb) onOpenNoteById(crumb.id)
                }}
                onOpenCategories={onOpenCategories}
                onOpenSection={onOpenSection}
                onIconChange={onIconChange}
                onIconColorChange={onIconColorChange}
                scheduleNote={
                  scheduleDraft && !scheduleDraft.clearSchedule
                    ? {
                        scheduledStartIso: scheduleDraft.scheduledStartIso,
                        scheduledEndIso: scheduleDraft.scheduledEndIso,
                        scheduledAllDay: scheduleDraft.scheduledAllDay
                      }
                    : editing
                }
                defaultScheduleDurationMinutes={notesSettings.defaultScheduleDurationMinutes}
                onScheduleChange={onScheduleChange}
                onCreateSubPage={onCreateSubPage}
                onOpenNote={onOpenNoteById}
                linksBodyHtml={linksBodyHtml}
                linkedPreviewKey={linkedPreviewKey}
                onSelectLinkForPreview={onSelectLinkForPreview}
                onLinksLoaded={onLinksLoaded}
                linkedPreviewOpen={linkedPreviewOpen}
                onLinkedPreviewToggle={onLinkedPreviewToggle}
                saveStatus={saveStatus}
                lastSavedAt={lastSavedAt}
              />

              <NotesShellEditorPane
                noteId={editing.id}
                editorSeedHtml={editorSeedHtml}
                onChangeHtml={onEditBodyChange}
                flushRef={editorFlushRef}
                insertHtmlRef={editorInsertHtmlRef}
                replaceInkSnapshotRef={editorReplaceInkRef}
                onOpenLinkedNote={onOpenNoteById}
                onOpenMeetingInsert={onOpenMeetingInsert}
                onRefreshMeetingDetails={onRefreshMeetingDetails}
                canRefreshMeetingDetails={canRefreshMeetingDetails}
                meetingRefreshBusy={meetingRefreshBusy}
                onOpenEmbedInsert={onOpenEmbedInsert}
                onOpenScreenClip={onOpenScreenClip}
                onOpenInkDraw={onOpenInkDraw}
                onOpenCloudTaskCreate={onOpenCloudTaskCreate}
                canCreateCloudTask={canCreateCloudTask}
                onOpenCalendarEventCreate={onOpenCalendarEventCreate}
                canCreateCalendarEvent={canCreateCalendarEvent}
                onInkImageDoubleClick={onInkImageDoubleClick}
                onCreateCloudTaskFromSelection={onCreateCloudTaskFromSelection}
                onCreateCalendarEventFromSelection={onCreateCalendarEventFromSelection}
                onCloudTaskToggle={onCloudTaskToggle}
                onEntityMentionLinkAdded={onEntityMentionLinkAdded}
                onEntityMentionLinkError={onEntityMentionLinkError}
                editorRef={editorRef}
                editorInsertEmbedRef={editorInsertEmbedRef}
                editorFocusedRef={editorFocusedRef}
                saving={saving}
              />
            </div>
          </div>

          {isCalendar ? (
            <HorizontalSplitter
              variant="subtle"
              ariaLabel={t('notes.shell.contextSplitterAria')}
              onDrag={(deltaY): void => {
                setCalendarEditorPaneHeight((h) => {
                  const max = notesCalendarEditorHeightMax()
                  return Math.min(
                    max,
                    Math.max(NOTES_CALENDAR_EDITOR_HEIGHT_MIN, h + deltaY)
                  )
                })
              }}
            />
          ) : null}

          <div
            className={cn(
              'flex shrink-0 flex-col gap-1 border-t border-border/60 bg-background px-4 pb-2 pt-2',
              isCalendar && 'min-h-0 flex-1 overflow-hidden'
            )}
          >
            {notesSettings.autosaveMode !== 'on_change' ? (
              <div className="text-xs text-muted-foreground">{t('notes.editor.wysiwygHint')}</div>
            ) : null}

            <EntityContextBlock
              anchor={{ kind: 'note', noteId: editing.id }}
              showObjectNote={false}
              contentPaddingClass="px-0"
              sectionCollapsedDefault={
                isCalendar ? false : notesSettings.entityContextCollapsedDefault
              }
              dense={isCalendar}
              contextFillHeight={isCalendar}
              className="border-t border-border/60"
            />

            <footer className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={onDeleteNote}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 rounded-md border border-destructive/40 px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                  {t('common.delete')}
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={onSaveTemplateFromNote}
                  className={cn(moduleColumnHeaderOutlineSmClass, 'px-3 py-2 text-sm font-medium')}
                >
                  {t('notes.templates.saveFromNote')}
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={onPrintPage}
                  className={cn(
                    moduleColumnHeaderOutlineSmClass,
                    'inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium'
                  )}
                >
                  <Printer className="h-4 w-4" />
                  {t('notes.export.print')}
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={onExportPdf}
                  className={cn(
                    moduleColumnHeaderOutlineSmClass,
                    'inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium'
                  )}
                >
                  <FileDown className="h-4 w-4" />
                  {t('notes.export.pdf')}
                </button>
              </div>
              <button
                type="button"
                onClick={onSave}
                disabled={saving}
                className={cn(
                  moduleColumnHeaderOutlineSmClass,
                  'min-w-28 justify-center px-4 py-2 text-sm font-semibold'
                )}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {t('common.save')}
              </button>
            </footer>
          </div>
        </ContentCrossfade>
      )}
    </Tag>
  )
})
