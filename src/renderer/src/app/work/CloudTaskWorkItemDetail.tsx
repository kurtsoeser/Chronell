import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { CalendarRecurrenceRangeEndMode } from '@shared/types'
import type { CloudTaskWorkItem } from '@shared/work-item'
import { CalendarEventIconPicker } from '@/components/CalendarEventIconPicker'
import { IconColorPickerFooter } from '@/components/IconColorPickerFooter'
import { resolveEntityIconColor } from '@shared/entity-icon-color'
import {
  datetimeLocalValueToIso,
  dueDateInputToStorageIso,
  dueDateInputValue,
  isoToDatetimeLocalValue
} from '@/app/work-items/work-item-datetime'
import { CalendarEventRecurrenceSection } from '@/app/calendar/CalendarEventRecurrenceSection'
import { EntityContextBlock } from '@/components/connections/EntityContextBlock'
import {
  buildTaskSaveRecurrence,
  defaultWeekdayFromDueYmd,
  taskRecurrenceToFormState,
  type TaskRecurrenceUiFrequency,
  validateTaskRecurrenceForm
} from '@/lib/task-recurrence-form'
import type { TaskSaveRecurrence } from '@shared/types'
import { cn } from '@/lib/utils'
import {
  previewDetailFieldControlClass,
  previewDetailFieldLabelClass
} from '@/lib/chronell-ui-classes'

export interface CloudTaskSaveDraft {
  title: string
  notes: string
  dueIso: string | null
  plannedStartIso: string | null
  plannedEndIso: string | null
  /** `null` = keine Serie; `undefined` = unveraendert lassen (z. B. Inline-Vorschau). */
  recurrence?: TaskSaveRecurrence | null
}

export interface CloudTaskDisplayPatch {
  iconId?: string | null
  iconColor?: string | null
}

export interface CloudTaskWorkItemDetailProps {
  item: CloudTaskWorkItem
  accountLine?: string
  accountProvider?: 'microsoft' | 'google'
  saving?: boolean
  onSave: (draft: CloudTaskSaveDraft) => void | Promise<void>
  onDelete: () => void | Promise<void>
  onDisplayChange?: (patch: CloudTaskDisplayPatch) => void | Promise<void>
}

export function CloudTaskWorkItemDetail({
  item,
  accountLine,
  accountProvider,
  saving,
  onSave,
  onDelete,
  onDisplayChange
}: CloudTaskWorkItemDetailProps): JSX.Element {
  const { t } = useTranslation()
  const [title, setTitle] = useState(item.title)
  const [notes, setNotes] = useState(item.task.notes ?? '')
  const [due, setDue] = useState(() => dueDateInputValue(item.dueAtIso))
  const [plannedStart, setPlannedStart] = useState(() =>
    isoToDatetimeLocalValue(item.planned.plannedStartIso)
  )
  const [plannedEnd, setPlannedEnd] = useState(() =>
    isoToDatetimeLocalValue(item.planned.plannedEndIso)
  )
  const initialRecurrence = taskRecurrenceToFormState(item.task)
  const [recurFreq, setRecurFreq] = useState<TaskRecurrenceUiFrequency>(initialRecurrence.recurFreq)
  const [recurEnd, setRecurEnd] = useState<CalendarRecurrenceRangeEndMode>(initialRecurrence.recurEnd)
  const [recurUntilDate, setRecurUntilDate] = useState(initialRecurrence.recurUntilDate)
  const [recurCount, setRecurCount] = useState(initialRecurrence.recurCount)
  const [recurWeekdays, setRecurWeekdays] = useState(initialRecurrence.recurWeekdays)
  const [saveError, setSaveError] = useState<string | null>(null)

  /** Nur Server-/Auswahl-Daten — nicht die `item`-Referenz (wechselt bei jedem Parent-Rebuild). */
  const savedRecurrenceKey = useMemo(
    () => JSON.stringify(item.task.recurrence ?? null),
    [item.task.recurrence]
  )

  useEffect(() => {
    setTitle(item.title)
    setNotes(item.task.notes ?? '')
    setDue(dueDateInputValue(item.dueAtIso))
    setSaveError(null)
  }, [item.stableKey, item.title, item.task.notes, item.dueAtIso])

  useEffect(() => {
    setPlannedStart(isoToDatetimeLocalValue(item.planned.plannedStartIso))
    setPlannedEnd(isoToDatetimeLocalValue(item.planned.plannedEndIso))
  }, [item.stableKey, item.planned.plannedStartIso, item.planned.plannedEndIso])

  useEffect(() => {
    const nextRecurrence = taskRecurrenceToFormState(item.task)
    setRecurFreq(nextRecurrence.recurFreq)
    setRecurEnd(nextRecurrence.recurEnd)
    setRecurUntilDate(nextRecurrence.recurUntilDate)
    setRecurCount(nextRecurrence.recurCount)
    setRecurWeekdays(nextRecurrence.recurWeekdays)
  }, [item.stableKey, savedRecurrenceKey])

  const handleSave = (): void => {
    const dueYmd = due.trim()
    const recurErr = validateTaskRecurrenceForm(
      { recurFreq, recurEnd, recurUntilDate, recurCount, recurWeekdays },
      dueYmd
    )
    if (recurErr === 'dueRequired') {
      setSaveError(t('tasks.create.recurrenceDueRequired'))
      return
    }
    if (recurErr === 'untilInvalid') {
      setSaveError(t('tasks.create.recurrenceUntilInvalid'))
      return
    }
    if (recurErr === 'untilBeforeDue') {
      setSaveError(t('tasks.create.recurrenceUntilBeforeDue'))
      return
    }
    if (recurErr === 'countInvalid') {
      setSaveError(t('tasks.create.recurrenceCountInvalid'))
      return
    }
    setSaveError(null)
    const recurrence = buildTaskSaveRecurrence({
      recurFreq,
      recurEnd,
      recurUntilDate,
      recurCount,
      recurWeekdays
    })
    void onSave({
      title: title.trim() || t('tasks.shell.untitled'),
      notes: notes.trim(),
      dueIso: dueDateInputToStorageIso(due),
      plannedStartIso: datetimeLocalValueToIso(plannedStart),
      plannedEndIso: datetimeLocalValueToIso(plannedEnd),
      recurrence: recurrence ?? null
    })
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex flex-col gap-3 p-3">
          {accountLine ? <p className="text-2xs text-muted-foreground">{accountLine}</p> : null}
          <div className="shrink-0">
            <label className={previewDetailFieldLabelClass}>{t('tasks.shell.fieldTitle')}</label>
            <div className="flex items-start gap-2">
              {onDisplayChange ? (
                <CalendarEventIconPicker
                  layout="compact"
                  openOn="doubleClick"
                  iconId={item.task.iconId}
                  iconColorHex={resolveEntityIconColor(item.task.iconColor)}
                  title={title.trim() || t('tasks.shell.untitled')}
                  disabled={saving}
                  onIconChange={(iconId): void =>
                    void onDisplayChange({ iconId: iconId ?? null })
                  }
                  footer={
                    <IconColorPickerFooter
                      iconColor={item.task.iconColor}
                      onIconColorChange={(iconColor): void => void onDisplayChange({ iconColor })}
                    />
                  }
                />
              ) : null}
              <input
                value={title}
                onChange={(e): void => setTitle(e.target.value)}
                className={cn(previewDetailFieldControlClass, 'min-w-0 flex-1')}
              />
            </div>
          </div>
          <div className="shrink-0">
            <label className={previewDetailFieldLabelClass}>{t('work.preview.plannedStart')}</label>
            <input
              type="datetime-local"
              value={plannedStart}
              onChange={(e): void => setPlannedStart(e.target.value)}
              className={previewDetailFieldControlClass}
            />
          </div>
          <div className="shrink-0">
            <label className={previewDetailFieldLabelClass}>{t('work.preview.plannedEnd')}</label>
            <input
              type="datetime-local"
              value={plannedEnd}
              onChange={(e): void => setPlannedEnd(e.target.value)}
              className={previewDetailFieldControlClass}
            />
          </div>
          <div className="shrink-0">
            <label className={previewDetailFieldLabelClass}>{t('tasks.shell.fieldDue')}</label>
            <input
              type="date"
              value={due}
              onChange={(e): void => {
                const v = e.target.value
                setDue(v)
                if (
                  v &&
                  recurWeekdays.length === 0 &&
                  (recurFreq === 'weekly' || recurFreq === 'biweekly')
                ) {
                  setRecurWeekdays(defaultWeekdayFromDueYmd(v))
                }
              }}
              className={previewDetailFieldControlClass}
            />
          </div>
          <div className="shrink-0">
            <CalendarEventRecurrenceSection
              i18nPrefix="tasks.create"
              recurFreq={recurFreq}
              setRecurFreq={(v): void => {
                setRecurFreq(v)
                if (
                  (v === 'weekly' || v === 'biweekly') &&
                  recurWeekdays.length === 0 &&
                  due.trim()
                ) {
                  setRecurWeekdays(defaultWeekdayFromDueYmd(due.trim()))
                }
              }}
              recurEnd={recurEnd}
              setRecurEnd={setRecurEnd}
              recurUntilDate={recurUntilDate}
              setRecurUntilDate={setRecurUntilDate}
              recurCount={recurCount}
              setRecurCount={setRecurCount}
              recurWeekdays={recurWeekdays}
              setRecurWeekdays={setRecurWeekdays}
              eventFieldsLocked={Boolean(saving)}
              embedded
              controlClass={previewDetailFieldControlClass}
            />
            {accountProvider === 'google' && recurFreq !== 'none' ? (
              <p className="mt-2 text-[10px] leading-snug text-muted-foreground">
                {t('tasks.create.recurrenceGoogleNote')}
              </p>
            ) : null}
          </div>
          <div className="shrink-0">
            <label className={previewDetailFieldLabelClass}>{t('tasks.shell.fieldNotes')}</label>
            <textarea
              value={notes}
              onChange={(e): void => setNotes(e.target.value)}
              rows={4}
              className={cn(
                previewDetailFieldControlClass,
                'min-h-[4.5rem] max-h-36 resize-y'
              )}
            />
          </div>
          {saveError ? (
            <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-2xs text-destructive">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{saveError}</span>
            </div>
          ) : null}
        </div>

        <EntityContextBlock
          anchor={{
            kind: 'cloud_task',
            accountId: item.accountId,
            listId: item.listId,
            taskId: item.taskId
          }}
          showObjectNote={false}
          contentPaddingClass="px-3"
          sectionCollapsedDefault
          dense
          className="border-t border-white/[0.04] dark:border-white/[0.04]"
        />
      </div>

      <div className="flex shrink-0 flex-wrap gap-2 border-t border-white/[0.04] p-3 dark:border-white/[0.04]">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-md bg-primary px-3 py-1.5 text-2xs font-semibold text-primary-foreground disabled:opacity-50"
        >
          {saving ? t('common.loading') : t('common.save')}
        </button>
        <button
          type="button"
          onClick={(): void => void onDelete()}
          disabled={saving}
          className="inline-flex items-center gap-1 rounded-md border border-destructive/40 px-3 py-1.5 text-2xs text-destructive hover:bg-destructive/10 disabled:opacity-50"
        >
          <Trash2 className="h-3.5 w-3.5" />
          {t('common.delete')}
        </button>
      </div>
    </div>
  )
}
