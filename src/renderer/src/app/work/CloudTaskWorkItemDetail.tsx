import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
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
import { EntityContextBlock } from '@/components/connections/EntityContextBlock'
import { TaskRecurrenceSummaryFromItem } from '@/components/TaskRecurrenceSummary'
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
}

export interface CloudTaskDisplayPatch {
  iconId?: string | null
  iconColor?: string | null
}

export interface CloudTaskWorkItemDetailProps {
  item: CloudTaskWorkItem
  accountLine?: string
  saving?: boolean
  onSave: (draft: CloudTaskSaveDraft) => void | Promise<void>
  onDelete: () => void | Promise<void>
  onDisplayChange?: (patch: CloudTaskDisplayPatch) => void | Promise<void>
}

export function CloudTaskWorkItemDetail({
  item,
  accountLine,
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

  useEffect(() => {
    setTitle(item.title)
    setNotes(item.task.notes ?? '')
    setDue(dueDateInputValue(item.dueAtIso))
    setPlannedStart(isoToDatetimeLocalValue(item.planned.plannedStartIso))
    setPlannedEnd(isoToDatetimeLocalValue(item.planned.plannedEndIso))
  }, [item])

  const handleSave = (): void => {
    void onSave({
      title: title.trim() || t('tasks.shell.untitled'),
      notes: notes.trim(),
      dueIso: dueDateInputToStorageIso(due),
      plannedStartIso: datetimeLocalValueToIso(plannedStart),
      plannedEndIso: datetimeLocalValueToIso(plannedEnd)
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
          <TaskRecurrenceSummaryFromItem task={item.task} />

          <div className="shrink-0">
            <label className={previewDetailFieldLabelClass}>{t('tasks.shell.fieldDue')}</label>
            <input
              type="date"
              value={due}
              onChange={(e): void => setDue(e.target.value)}
              className={previewDetailFieldControlClass}
            />
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
