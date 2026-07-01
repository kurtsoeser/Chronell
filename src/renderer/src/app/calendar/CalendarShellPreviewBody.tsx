import { useCallback, useMemo, type Dispatch, type RefObject, type SetStateAction } from 'react'
import type { TFunction } from 'i18next'
import type FullCalendar from '@fullcalendar/react'
import type { CalendarEventView, ConnectedAccount } from '@shared/types'
import type { WorkItemPlannedSchedule } from '@shared/work-item'
import type { CloudTaskListItem } from '@/app/tasks/tasks-types'
import type { CloudTaskSaveDraft } from '@/app/work/CloudTaskWorkItemDetail'
import { CalendarSchedulingPanel } from '@/app/calendar/CalendarSchedulingPanel'
import { CloudTaskItemPreview } from '@/app/calendar/CloudTaskItemPreview'
import { CalendarEventPreview } from '@/app/calendar/CalendarEventPreview'
import { ReadingPane } from '@/app/layout/ReadingPane'
import type { SchedulingSlot } from '@shared/scheduling-types'
import { cloudTaskStableKey } from '@shared/work-item-keys'

import type { CalendarShellEventDialogState, SetCalendarShellEventDialog } from '@/app/calendar/calendar-shell-event-dialog-state'

export interface CalendarShellPreviewBodyProps {
  t: TFunction
  accounts: ConnectedAccount[]
  fcTimeZone: string
  previewPlacement: 'dock' | 'float'
  schedulingOpen: boolean
  schedulingSlots: SchedulingSlot[]
  setSchedulingSlots: Dispatch<SetStateAction<SchedulingSlot[]>>
  schedulingAccountId: string
  setSchedulingAccountId: Dispatch<SetStateAction<string>>
  schedulingDurationMin: number
  setSchedulingDurationMin: Dispatch<SetStateAction<number>>
  schedulingMeetingTitle: string
  setSchedulingMeetingTitle: Dispatch<SetStateAction<string>>
  closeSchedulingPanel: () => void
  previewCloudTask: CloudTaskListItem | null
  previewCloudTaskPlanned: WorkItemPlannedSchedule | null
  previewCloudTaskAccountName: string | undefined
  previewCloudTaskSaving: boolean
  previewCalendarEvent: CalendarEventView | null
  previewCalendarName: string | null
  setEventDialog: SetCalendarShellEventDialog
  setPreviewCalendarEvent: Dispatch<SetStateAction<CalendarEventView | null>>
  setEvents: Dispatch<SetStateAction<CalendarEventView[]>>
  reloadCalendarEventsOnlyRef: RefObject<(opts?: { silent?: boolean }) => void>
  calendarRef: RefObject<FullCalendar>
  lastRangeRef: RefObject<{ start: Date; end: Date }>
  cloudTaskByKeyRef: RefObject<Map<string, CloudTaskListItem>>
  setCloudTaskAllItems: Dispatch<SetStateAction<CloudTaskListItem[]>>
  setCloudTaskRangeItems: Dispatch<SetStateAction<CloudTaskListItem[]>>
  setPreviewCloudTask: Dispatch<SetStateAction<CloudTaskListItem | null>>
  setPreviewCloudTaskPlannedFromTimeline: Dispatch<SetStateAction<WorkItemPlannedSchedule | null>>
  cloudTaskAllItems: CloudTaskListItem[]
  cloudTaskPlannedByKey: Map<string, WorkItemPlannedSchedule>
  commitCloudTaskLayer: (
    items: CloudTaskListItem[],
    planned: Map<string, WorkItemPlannedSchedule>,
    start: Date,
    end: Date,
    opts?: { force?: boolean }
  ) => void
  syncPreviewCloudTaskOnCalendar: (
    task: CloudTaskListItem,
    planned?: WorkItemPlannedSchedule
  ) => void
  setPreviewCloudTaskSaving: Dispatch<SetStateAction<boolean>>
}

export function CalendarShellPreviewBody({
  t,
  accounts,
  fcTimeZone,
  previewPlacement,
  schedulingOpen,
  schedulingSlots,
  setSchedulingSlots,
  schedulingAccountId,
  setSchedulingAccountId,
  schedulingDurationMin,
  setSchedulingDurationMin,
  schedulingMeetingTitle,
  setSchedulingMeetingTitle,
  closeSchedulingPanel,
  previewCloudTask,
  previewCloudTaskPlanned,
  previewCloudTaskAccountName,
  previewCloudTaskSaving,
  previewCalendarEvent,
  previewCalendarName,
  setEventDialog,
  setPreviewCalendarEvent,
  setEvents,
  reloadCalendarEventsOnlyRef,
  calendarRef,
  lastRangeRef,
  cloudTaskByKeyRef,
  setCloudTaskAllItems,
  setCloudTaskRangeItems,
  setPreviewCloudTask,
  setPreviewCloudTaskPlannedFromTimeline,
  cloudTaskAllItems,
  cloudTaskPlannedByKey,
  commitCloudTaskLayer,
  syncPreviewCloudTaskOnCalendar,
  setPreviewCloudTaskSaving
}: CalendarShellPreviewBodyProps): JSX.Element {
  const patchPreviewCloudTaskDisplay = useCallback(
    async (patch: import('@/app/work/CloudTaskWorkItemDetail').CloudTaskDisplayPatch): Promise<void> => {
      if (!previewCloudTask) return
      const next = await window.mailClient.tasks.patchTaskDisplay({
        accountId: previewCloudTask.accountId,
        listId: previewCloudTask.listId,
        taskId: previewCloudTask.id,
        ...patch
      })
      const merged: CloudTaskListItem = {
        ...next,
        accountId: previewCloudTask.accountId,
        listName: previewCloudTask.listName,
        source: 'cloud'
      }
      const key = cloudTaskStableKey(merged.accountId, merged.listId, merged.id)
      cloudTaskByKeyRef.current?.set(key, merged)
      const replace = (rows: CloudTaskListItem[]): CloudTaskListItem[] =>
        rows.map((row) =>
          cloudTaskStableKey(row.accountId, row.listId, row.id) === key ? merged : row
        )
      setCloudTaskAllItems(replace)
      setCloudTaskRangeItems(replace)
      setPreviewCloudTask(merged)
    },
    [previewCloudTask, cloudTaskByKeyRef, setCloudTaskAllItems, setCloudTaskRangeItems, setPreviewCloudTask]
  )

  const savePreviewCloudTask = useCallback(
    async (draft: CloudTaskSaveDraft): Promise<void> => {
      if (!previewCloudTask) return
      setPreviewCloudTaskSaving(true)
      try {
        const taskKey = cloudTaskStableKey(
          previewCloudTask.accountId,
          previewCloudTask.listId,
          previewCloudTask.id
        )
        const next = await window.mailClient.tasks.updateTask({
          accountId: previewCloudTask.accountId,
          listId: previewCloudTask.listId,
          taskId: previewCloudTask.id,
          title: draft.title,
          notes: draft.notes || null,
          dueIso: draft.dueIso,
          completed: previewCloudTask.completed,
          recurrence: draft.recurrence
        })
        let planned: WorkItemPlannedSchedule | null = null
        if (draft.plannedStartIso && draft.plannedEndIso) {
          await window.mailClient.tasks.setPlannedSchedule({
            taskKey,
            plannedStartIso: draft.plannedStartIso,
            plannedEndIso: draft.plannedEndIso
          })
          planned = {
            plannedStartIso: draft.plannedStartIso,
            plannedEndIso: draft.plannedEndIso
          }
        } else {
          await window.mailClient.tasks.clearPlannedSchedule({ taskKey })
        }
        const merged: CloudTaskListItem = {
          ...next,
          accountId: previewCloudTask.accountId,
          listName: previewCloudTask.listName,
          source: 'cloud'
        }
        const key = cloudTaskStableKey(merged.accountId, merged.listId, merged.id)
        cloudTaskByKeyRef.current?.set(key, merged)
        const replace = (rows: CloudTaskListItem[]): CloudTaskListItem[] =>
          rows.map((row) =>
            cloudTaskStableKey(row.accountId, row.listId, row.id) === key ? merged : row
          )
        const nextAll = replace(cloudTaskAllItems)
        const nextPlanned = new Map(cloudTaskPlannedByKey)
        if (planned) nextPlanned.set(key, planned)
        else nextPlanned.delete(key)
        setPreviewCloudTask(merged)
        setPreviewCloudTaskPlannedFromTimeline(null)
        const api = calendarRef.current?.getApi()
        const range = api
          ? { start: api.view.activeStart, end: api.view.activeEnd }
          : lastRangeRef.current
        if (!range) return
        const { start, end } = range
        commitCloudTaskLayer(nextAll, nextPlanned, start, end, { force: true })
        syncPreviewCloudTaskOnCalendar(merged, planned ?? undefined)
      } finally {
        setPreviewCloudTaskSaving(false)
      }
    },
    [
      previewCloudTask,
      cloudTaskAllItems,
      cloudTaskPlannedByKey,
      cloudTaskByKeyRef,
      calendarRef,
      lastRangeRef,
      commitCloudTaskLayer,
      syncPreviewCloudTaskOnCalendar,
      setPreviewCloudTask,
      setPreviewCloudTaskPlannedFromTimeline,
      setPreviewCloudTaskSaving
    ]
  )

  if (schedulingOpen) {
    return (
      <CalendarSchedulingPanel
        accounts={accounts}
        slots={schedulingSlots}
        onSlotsChange={setSchedulingSlots}
        accountId={schedulingAccountId}
        onAccountIdChange={setSchedulingAccountId}
        durationMinutes={schedulingDurationMin}
        onDurationMinutesChange={setSchedulingDurationMin}
        meetingTitle={schedulingMeetingTitle}
        onMeetingTitleChange={setSchedulingMeetingTitle}
        timeZone={fcTimeZone}
        onClose={closeSchedulingPanel}
        className="min-h-0 flex-1"
      />
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {previewCloudTask ? (
        <CloudTaskItemPreview
          task={previewCloudTask}
          planned={previewCloudTaskPlanned}
          accountDisplayName={previewCloudTaskAccountName}
          editable
          saving={previewCloudTaskSaving}
          onSave={savePreviewCloudTask}
          onDisplayChange={patchPreviewCloudTaskDisplay}
        />
      ) : previewCalendarEvent ? (
        <CalendarEventPreview
          event={previewCalendarEvent}
          calendarName={previewCalendarName}
          onEdit={(): void => setEventDialog({ mode: 'edit', event: previewCalendarEvent })}
          onEventChange={(updated): void => {
            setPreviewCalendarEvent(updated)
            setEvents((prev) =>
              prev.map((row) =>
                row.accountId === updated.accountId && row.graphEventId === updated.graphEventId
                  ? updated
                  : row
              )
            )
          }}
          onSaved={(): void => reloadCalendarEventsOnlyRef.current?.({ silent: true })}
        />
      ) : (
        <ReadingPane
          hideChromeWhenEmpty
          hidePreviewDetachToggle={previewPlacement === 'float'}
          emptySelectionTitle={t('calendar.shell.previewBadgeDefault')}
          emptySelectionBody={t('calendar.shell.emptyPreviewBody')}
        />
      )}
    </div>
  )
}
