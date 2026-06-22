import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { format, parseISO } from 'date-fns'
import { de as deFns, enUS as enUSFns } from 'date-fns/locale'
import type { Locale } from 'date-fns'
import { useTranslation } from 'react-i18next'
import { CheckSquare, Loader2, Square, StickyNote } from 'lucide-react'
import type { WorkItemPlannedSchedule } from '@shared/work-item'
import type { TaskItemWithContext } from '@/app/tasks/tasks-types'
import type { CloudTaskDisplayPatch, CloudTaskSaveDraft } from '@/app/work/CloudTaskWorkItemDetail'
import {
  datetimeLocalValueToIso,
  dueDateInputToStorageIso,
  dueDateInputValue,
  isoToDatetimeLocalValue
} from '@/app/work-items/work-item-datetime'
import { CalendarEventIconPicker } from '@/components/CalendarEventIconPicker'
import { IconColorPickerFooter } from '@/components/IconColorPickerFooter'
import { resolveEntityIconColor } from '@shared/entity-icon-color'
import { RichTextNotesPreview } from '@/components/RichTextNotesPreview'
import { useThemeStore } from '@/stores/theme'
import { cn } from '@/lib/utils'
import { PreviewFoldSection } from '@/components/PreviewFoldSection'
import { ChronellDatePickerPanel } from '@/components/ChronellDatePickerPanel'
import { EntityContextBlock } from '@/components/connections/EntityContextBlock'
import {
  HorizontalSplitter,
  useResizableHeight
} from '@/components/ResizableSplitter'
import {
  CALENDAR_PREVIEW_NOTE_PANE_HEIGHT_DEFAULT,
  CALENDAR_PREVIEW_NOTE_PANE_HEIGHT_KEY,
  CALENDAR_PREVIEW_NOTE_PANE_HEIGHT_MIN,
  calendarPreviewNotePaneHeightMax
} from '@/app/calendar/calendar-preview-storage'
import { previewSectionDividerClass } from '@/lib/chronell-ui-classes'

function formatIsoDate(iso: string | null, locale: Locale): string | null {
  if (!iso) return null
  const d = parseISO(iso.length <= 10 ? `${iso.slice(0, 10)}T12:00:00` : iso)
  if (Number.isNaN(d.getTime())) return null
  return format(d, 'PPP', { locale })
}

function formatPlannedRange(planned: WorkItemPlannedSchedule, locale: Locale): string | null {
  if (!planned.plannedStartIso || !planned.plannedEndIso) return null
  const start = parseISO(planned.plannedStartIso)
  const end = parseISO(planned.plannedEndIso)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return `${planned.plannedStartIso} – ${planned.plannedEndIso}`
  }
  if (format(start, 'yyyy-MM-dd') === format(end, 'yyyy-MM-dd')) {
    return `${format(start, 'PPP', { locale })} · ${format(start, 'HH:mm')} – ${format(end, 'HH:mm')}`
  }
  return `${format(start, 'Pp', { locale })} – ${format(end, 'Pp', { locale })}`
}

type PreviewEditField = 'title' | 'due' | 'planned' | 'notes'

function buildSaveDraft(args: {
  title: string
  notes: string
  due: string
  plannedStart: string
  plannedEnd: string
  untitled: string
  recurrence?: CloudTaskSaveDraft['recurrence']
}): CloudTaskSaveDraft {
  return {
    title: args.title.trim() || args.untitled,
    notes: args.notes.trim(),
    dueIso: dueDateInputToStorageIso(args.due),
    plannedStartIso: datetimeLocalValueToIso(args.plannedStart),
    plannedEndIso: datetimeLocalValueToIso(args.plannedEnd),
    ...(args.recurrence !== undefined ? { recurrence: args.recurrence } : {})
  }
}

export function CloudTaskItemPreview(props: {
  task: TaskItemWithContext
  planned?: WorkItemPlannedSchedule | null
  accountDisplayName?: string
  className?: string
  /** Klick (Standard) oder Doppelklick zum Start der Inline-Bearbeitung. */
  inlineEditActivateOn?: 'click' | 'doubleClick'
  editable?: boolean
  saving?: boolean
  onSave?: (draft: CloudTaskSaveDraft) => void | Promise<void>
  onDisplayChange?: (patch: CloudTaskDisplayPatch) => void | Promise<void>
}): JSX.Element {
  const {
    task,
    planned,
    accountDisplayName,
    className,
    inlineEditActivateOn = 'click',
    editable = false,
    saving = false,
    onSave,
    onDisplayChange
  } = props
  const { t, i18n } = useTranslation()
  const viewerTheme = useThemeStore((s) => s.effective)
  const dfLocale: Locale = i18n.language.startsWith('de') ? deFns : enUSFns
  const untitled = t('tasks.shell.untitled')

  const [editingField, setEditingField] = useState<PreviewEditField | null>(null)
  const [titleDraft, setTitleDraft] = useState('')
  const [notesDraft, setNotesDraft] = useState('')
  const [dueDraft, setDueDraft] = useState('')
  const [plannedStartDraft, setPlannedStartDraft] = useState('')
  const [plannedEndDraft, setPlannedEndDraft] = useState('')
  const [inlineError, setInlineError] = useState<string | null>(null)
  const [notesSectionExpanded, setNotesSectionExpanded] = useState(false)

  const notePaneHeightMax = calendarPreviewNotePaneHeightMax()
  const [notePaneHeight, setNotePaneHeight] = useResizableHeight({
    storageKey: CALENDAR_PREVIEW_NOTE_PANE_HEIGHT_KEY,
    defaultHeight: CALENDAR_PREVIEW_NOTE_PANE_HEIGHT_DEFAULT,
    minHeight: CALENDAR_PREVIEW_NOTE_PANE_HEIGHT_MIN,
    maxHeight: notePaneHeightMax
  })

  useEffect(() => {
    const clamp = (): void => {
      const max = calendarPreviewNotePaneHeightMax()
      setNotePaneHeight((h) =>
        Math.min(max, Math.max(CALENDAR_PREVIEW_NOTE_PANE_HEIGHT_MIN, h))
      )
    }
    window.addEventListener('resize', clamp)
    return (): void => window.removeEventListener('resize', clamp)
  }, [setNotePaneHeight])

  const titleInputRef = useRef<HTMLInputElement>(null)
  const notesEditorRef = useRef<HTMLTextAreaElement>(null)
  const dueEditorRef = useRef<HTMLDivElement>(null)
  const plannedEditorRef = useRef<HTMLDivElement>(null)

  const dueLabel = useMemo(() => formatIsoDate(task.dueIso, dfLocale), [task.dueIso, dfLocale])
  const plannedLabel = useMemo(
    () => (planned ? formatPlannedRange(planned, dfLocale) : null),
    [planned, dfLocale]
  )

  const title = task.title?.trim() || untitled

  const syncDraftsFromTask = useCallback((): void => {
    setTitleDraft(task.title?.trim() ?? '')
    setNotesDraft(task.notes?.trim() ?? '')
    setDueDraft(dueDateInputValue(task.dueIso))
    setPlannedStartDraft(isoToDatetimeLocalValue(planned?.plannedStartIso))
    setPlannedEndDraft(isoToDatetimeLocalValue(planned?.plannedEndIso))
  }, [planned?.plannedEndIso, planned?.plannedStartIso, task.dueIso, task.notes, task.title])

  useEffect(() => {
    setEditingField(null)
    setInlineError(null)
    syncDraftsFromTask()
  }, [task.id, task.title, task.notes, task.dueIso, planned?.plannedStartIso, planned?.plannedEndIso, syncDraftsFromTask])

  useEffect(() => {
    if (editingField === 'title') {
      setTitleDraft(task.title?.trim() ?? '')
      titleInputRef.current?.focus()
      titleInputRef.current?.select()
    }
    if (editingField === 'notes') {
      setNotesDraft(task.notes?.trim() ?? '')
      notesEditorRef.current?.focus()
    }
    if (editingField === 'due') {
      setDueDraft(dueDateInputValue(task.dueIso))
    }
    if (editingField === 'planned') {
      setPlannedStartDraft(isoToDatetimeLocalValue(planned?.plannedStartIso))
      setPlannedEndDraft(isoToDatetimeLocalValue(planned?.plannedEndIso))
    }
  }, [editingField, planned?.plannedEndIso, planned?.plannedStartIso, task.dueIso, task.notes, task.title])

  const cancelInlineEdit = useCallback((): void => {
    setEditingField(null)
    setInlineError(null)
    syncDraftsFromTask()
  }, [syncDraftsFromTask])

  const commitInlineEdit = useCallback(async (): Promise<void> => {
    if (!editable || !onSave || !editingField) return
    const draft = buildSaveDraft({
      title: titleDraft,
      notes: notesDraft,
      due: dueDraft,
      plannedStart: plannedStartDraft,
      plannedEnd: plannedEndDraft,
      untitled
    })
    const prev = buildSaveDraft({
      title: task.title?.trim() ?? '',
      notes: task.notes?.trim() ?? '',
      due: dueDateInputValue(task.dueIso),
      plannedStart: isoToDatetimeLocalValue(planned?.plannedStartIso),
      plannedEnd: isoToDatetimeLocalValue(planned?.plannedEndIso),
      untitled
    })
    const unchanged =
      draft.title === prev.title &&
      draft.notes === prev.notes &&
      draft.dueIso === prev.dueIso &&
      draft.plannedStartIso === prev.plannedStartIso &&
      draft.plannedEndIso === prev.plannedEndIso
    setEditingField(null)
    if (unchanged) return
    setInlineError(null)
    try {
      await onSave(draft)
    } catch (e) {
      setInlineError(e instanceof Error ? e.message : String(e))
      syncDraftsFromTask()
    }
  }, [
    dueDraft,
    editable,
    editingField,
    onSave,
    planned?.plannedEndIso,
    planned?.plannedStartIso,
    plannedEndDraft,
    plannedStartDraft,
    syncDraftsFromTask,
    task.dueIso,
    task.notes,
    task.title,
    titleDraft,
    notesDraft,
    untitled
  ])

  useEffect(() => {
    if (!editingField) return
    function onDocMouseDown(e: globalThis.MouseEvent): void {
      const target = e.target as Node
      if (editingField === 'title' && titleInputRef.current?.contains(target)) return
      if (editingField === 'notes' && notesEditorRef.current?.contains(target)) return
      if (editingField === 'due' && dueEditorRef.current?.contains(target)) return
      if (editingField === 'planned' && plannedEditorRef.current?.contains(target)) return
      void commitInlineEdit()
    }
    function onKeyDown(e: KeyboardEvent): void {
      if (e.key !== 'Escape') return
      e.preventDefault()
      cancelInlineEdit()
    }
    document.addEventListener('mousedown', onDocMouseDown)
    document.addEventListener('keydown', onKeyDown, true)
    return (): void => {
      document.removeEventListener('mousedown', onDocMouseDown)
      document.removeEventListener('keydown', onKeyDown, true)
    }
  }, [cancelInlineEdit, commitInlineEdit, editingField])

  const clickableClass = editable && !saving
    ? 'cursor-pointer rounded-sm transition-colors hover:bg-secondary/60'
    : ''

  const beginInlineEdit = useCallback(
    (field: PreviewEditField): void => {
      if (!editable || saving) return
      if (field === 'notes') setNotesSectionExpanded(true)
      setEditingField(field)
    },
    [editable, saving]
  )

  const hasNotes = Boolean(task.notes?.trim())
  const notesSummary = hasNotes
    ? task.notes!.trim().replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80)
    : t('calendar.cloudTaskPreview.notesEmpty')

  const inlineEditHandlers = useCallback(
    (field: PreviewEditField) => {
      if (!editable) return {}
      const hintKey =
        field === 'title'
          ? inlineEditActivateOn === 'doubleClick'
            ? 'calendar.cloudTaskPreview.editTitleDoubleClick'
            : 'calendar.cloudTaskPreview.editTitle'
          : field === 'due'
            ? inlineEditActivateOn === 'doubleClick'
              ? 'calendar.cloudTaskPreview.editDueDoubleClick'
              : 'calendar.cloudTaskPreview.editDue'
            : field === 'planned'
              ? inlineEditActivateOn === 'doubleClick'
                ? 'calendar.cloudTaskPreview.editPlannedDoubleClick'
                : 'calendar.cloudTaskPreview.editPlanned'
              : inlineEditActivateOn === 'doubleClick'
                ? 'calendar.cloudTaskPreview.editNotesDoubleClick'
                : 'calendar.cloudTaskPreview.editNotes'
      if (inlineEditActivateOn === 'doubleClick') {
        return {
          title: t(hintKey),
          onDoubleClick: (e: { preventDefault: () => void; stopPropagation: () => void }): void => {
            e.preventDefault()
            e.stopPropagation()
            beginInlineEdit(field)
          }
        }
      }
      return {
        title: t(hintKey),
        onClick: (): void => beginInlineEdit(field)
      }
    },
    [beginInlineEdit, editable, inlineEditActivateOn, t]
  )

  const contextPane = (
    <EntityContextBlock
      anchor={{ kind: 'cloud_task', accountId: task.accountId, listId: task.listId, taskId: task.id }}
      showObjectNote={false}
      contentPaddingClass="px-4"
      sectionCollapsedDefault={false}
      contextFillHeight
      dense
      className={cn('min-h-0 flex-1', previewSectionDividerClass)}
    />
  )

  const detailsBody: ReactNode = (
    <>
      <div className="shrink-0 space-y-2 border-b border-border px-4 py-3">
        <p className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t('calendar.cloudTaskPreview.sourceLabel')}
        </p>
        <div className="flex items-start gap-2">
          {onDisplayChange ? (
            <CalendarEventIconPicker
              layout="compact"
              openOn="doubleClick"
              iconId={task.iconId}
              iconColorHex={resolveEntityIconColor(task.iconColor)}
              title={title}
              disabled={saving}
              onIconChange={(iconId): void =>
                void onDisplayChange({ iconId: iconId ?? null })
              }
              footer={
                <IconColorPickerFooter
                  iconColor={task.iconColor}
                  onIconColorChange={(iconColor): void => void onDisplayChange({ iconColor })}
                />
              }
            />
          ) : null}
          {editingField === 'title' ? (
            <input
              ref={titleInputRef}
              type="text"
              value={titleDraft}
              disabled={saving}
              onChange={(e): void => setTitleDraft(e.target.value)}
              onKeyDown={(e): void => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void commitInlineEdit()
                }
              }}
              className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1 text-[17px] font-semibold leading-snug outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
            />
          ) : (
            <h2
              role={editable ? 'button' : undefined}
              tabIndex={editable ? 0 : undefined}
              title={inlineEditHandlers('title').title}
              onClick={inlineEditHandlers('title').onClick}
              onDoubleClick={inlineEditHandlers('title').onDoubleClick}
              onKeyDown={(e): void => {
                if (!editable) return
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  beginInlineEdit('title')
                }
              }}
              className={cn(
                'min-w-0 flex-1 text-[17px] font-semibold leading-snug text-foreground',
                task.completed && 'text-muted-foreground line-through',
                clickableClass,
                editable && '-mx-1 px-1'
              )}
            >
              {title}
            </h2>
          )}
          {saving ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" /> : null}
        </div>
        {accountDisplayName ? (
          <p className="text-sm text-muted-foreground">
            {accountDisplayName}
            {task.listName ? ` · ${task.listName}` : ''}
          </p>
        ) : task.listName ? (
          <p className="text-sm text-muted-foreground">{task.listName}</p>
        ) : null}
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          {task.completed ? (
            <CheckSquare className="h-3.5 w-3.5 shrink-0 text-primary" />
          ) : (
            <Square className="h-3.5 w-3.5 shrink-0" />
          )}
          <span>
            {task.completed
              ? t('calendar.cloudTaskPreview.statusDone')
              : t('calendar.cloudTaskPreview.statusOpen')}
          </span>
        </div>
        {inlineError ? <p className="text-xs text-destructive">{inlineError}</p> : null}
      </div>
      <div className="space-y-3 px-4 py-3 text-sm">
        <div>
          <p className="mb-0.5 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t('calendar.cloudTaskPreview.dueLabel')}
          </p>
          {editingField === 'due' ? (
            <div ref={dueEditorRef}>
              <ChronellDatePickerPanel
                value={dueDraft}
                disabled={saving}
                onChange={setDueDraft}
              />
            </div>
          ) : (
            <p
              role={editable ? 'button' : undefined}
              tabIndex={editable ? 0 : undefined}
              title={inlineEditHandlers('due').title}
              onClick={inlineEditHandlers('due').onClick}
              onDoubleClick={inlineEditHandlers('due').onDoubleClick}
              onKeyDown={(e): void => {
                if (!editable) return
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  beginInlineEdit('due')
                }
              }}
              className={cn('text-foreground', clickableClass, editable && '-mx-1 px-1')}
            >
              {dueLabel ?? t('calendar.cloudTaskPreview.dueUnset')}
            </p>
          )}
        </div>
        <div>
          <p className="mb-0.5 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t('calendar.cloudTaskPreview.plannedLabel')}
          </p>
          {editingField === 'planned' ? (
            <div ref={plannedEditorRef} className="space-y-2">
              <label className="block space-y-0.5">
                <span className="text-2xs text-muted-foreground">
                  {t('work.preview.plannedStart')}
                </span>
                <input
                  type="datetime-local"
                  disabled={saving}
                  value={plannedStartDraft}
                  onChange={(e): void => setPlannedStartDraft(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-2 py-1 text-sm tabular-nums"
                />
              </label>
              <label className="block space-y-0.5">
                <span className="text-2xs text-muted-foreground">
                  {t('work.preview.plannedEnd')}
                </span>
                <input
                  type="datetime-local"
                  disabled={saving}
                  value={plannedEndDraft}
                  onChange={(e): void => setPlannedEndDraft(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-2 py-1 text-sm tabular-nums"
                />
              </label>
            </div>
          ) : (
            <p
              role={editable ? 'button' : undefined}
              tabIndex={editable ? 0 : undefined}
              title={inlineEditHandlers('planned').title}
              onClick={inlineEditHandlers('planned').onClick}
              onDoubleClick={inlineEditHandlers('planned').onDoubleClick}
              onKeyDown={(e): void => {
                if (!editable) return
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  beginInlineEdit('planned')
                }
              }}
              className={cn('text-foreground', clickableClass, editable && '-mx-1 px-1')}
            >
              {plannedLabel ?? t('calendar.cloudTaskPreview.plannedUnset')}
            </p>
          )}
        </div>
        <PreviewFoldSection
          icon={StickyNote}
          title={t('calendar.cloudTaskPreview.notesLabel')}
          expanded={notesSectionExpanded}
          onToggle={(): void => setNotesSectionExpanded((v) => !v)}
          summary={notesSummary}
          iconClassName={hasNotes ? 'fill-amber-300 text-amber-500' : undefined}
        >
          {editingField === 'notes' ? (
            <textarea
              ref={notesEditorRef}
              value={notesDraft}
              disabled={saving}
              onChange={(e): void => setNotesDraft(e.target.value)}
              rows={8}
              className="min-h-[120px] w-full resize-y rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
            />
          ) : task.notes?.trim() || editable ? (
            <div
              role={editable ? 'button' : undefined}
              tabIndex={editable ? 0 : undefined}
              title={inlineEditHandlers('notes').title}
              onClick={inlineEditHandlers('notes').onClick}
              onDoubleClick={inlineEditHandlers('notes').onDoubleClick}
              onKeyDown={(e): void => {
                if (!editable) return
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  beginInlineEdit('notes')
                }
              }}
              className={cn(editable && clickableClass, editable && 'rounded-sm -mx-1 px-1')}
            >
              {task.notes?.trim() ? (
                <RichTextNotesPreview notes={task.notes.trim()} viewerTheme={viewerTheme} />
              ) : (
                <p className="text-muted-foreground">{t('calendar.cloudTaskPreview.notesEmpty')}</p>
              )}
            </div>
          ) : null}
        </PreviewFoldSection>
      </div>
    </>
  )

  return (
    <div className={cn('flex min-h-0 flex-1 flex-col overflow-hidden bg-background', className)}>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="space-y-3 px-4 py-3 text-sm">{detailsBody}</div>
      </div>
      <HorizontalSplitter
        variant="subtle"
        ariaLabel={t('calendar.cloudTaskPreview.contextSplitterAria')}
        onDrag={(deltaY): void => {
          setNotePaneHeight((h) => {
            const max = calendarPreviewNotePaneHeightMax()
            return Math.min(
              max,
              Math.max(CALENDAR_PREVIEW_NOTE_PANE_HEIGHT_MIN, h - deltaY)
            )
          })
        }}
      />
      <div
        className="flex min-h-0 shrink-0 flex-col overflow-hidden border-t border-border/40 bg-secondary/[0.02]"
        style={{ height: Math.min(notePaneHeight, notePaneHeightMax) }}
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{contextPane}</div>
      </div>
    </div>
  )
}
