import type { ReactNode } from 'react'
import { FileDown, Loader2, PanelRightOpen, Printer, Trash2, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { NoteEntityLinkedItem, NoteLinksBundle } from '@shared/note-entity-links'
import type { Editor } from '@tiptap/react'
import type { NoteCloudTaskRef } from '@shared/note-cloud-task'
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
import { cn } from '@/lib/utils'
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
  editorReplaceInkRef: React.MutableRefObject<
    ((inkJsonAttachmentId: number, html: string) => void) | null
  >
}

export function NotesShellNoteEditorColumn({
  layout,
  widthPx,
  editing,
  error,
  saving,
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
  editorReplaceInkRef
}: NotesShellNoteEditorColumnProps): JSX.Element {
  const { t } = useTranslation()
  const isCalendar = layout === 'calendar'
  const Tag = isCalendar ? 'aside' : 'main'

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
        <ContentCrossfade contentKey={editing.id} className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-muted/15">
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
                saving={saving}
              />
            </div>
          </div>

          <div className="flex shrink-0 flex-col gap-1 border-t border-border/60 bg-background px-4 pb-2 pt-2">
            <div className="text-xs text-muted-foreground">
              {notesSettings.autosaveMode === 'on_change'
                ? t('notes.editor.autosaveHint')
                : t('notes.editor.wysiwygHint')}
            </div>

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
}
