import {
  useCallback,
  type Dispatch,
  type MutableRefObject,
  type RefObject,
  type SetStateAction
} from 'react'
import { flushSync } from 'react-dom'
import type { EventChangeArg } from '@fullcalendar/core'
import type FullCalendar from '@fullcalendar/react'
import type { TFunction } from 'i18next'
import type { CalendarEventView, ConnectedAccount, MailListItem } from '@shared/types'
import type { WorkItemPlannedSchedule } from '@shared/work-item'
import type { CloudTaskListItem } from '@/app/tasks/tasks-types'
import {
  patchScheduleInputWithMeetingNotify,
  resolveMeetingScheduleChange
} from '@/app/calendar/calendar-meeting-schedule-change'
import {
  CALENDAR_KIND_MAIL_TODO,
  computePersistIsoRangeForMailTodo,
  mailTodoFullCalendarEventId
} from '@/app/calendar/mail-todo-calendar'
import {
  CALENDAR_KIND_CLOUD_TASK,
  cloudTaskEventId,
  computePersistTargetForCloudTask
} from '@/app/calendar/cloud-task-calendar'
import {
  CALENDAR_KIND_USER_NOTE,
  computePersistTargetForUserNote,
  userNoteEventId
} from '@/app/calendar/notes-calendar'
import {
  scheduleRemoveCloudTaskCalendarEventsByTaskKey,
  scheduleRemoveDuplicateFullCalendarEventsById,
  scheduleRemoveMailTodoCalendarEventsByMessageId
} from '@/app/calendar/calendar-fc-event-source'
import {
  applyOptimisticMailTodoScheduleToItems,
  syncFullCalendarMailTodoEventFromLayer
} from '@/app/calendar/optimistic-mail-todo-calendar'
import { deduplicateCalendarEventsByGraphEventId, purgeDuplicateGraphCalendarEventsOnApi } from '@/app/calendar/calendar-graph-events'
import {
  reconcileGraphCalendarEventOnCalendar,
  syncFullCalendarGraphEventFromLayer
} from '@/app/calendar/optimistic-graph-calendar'
import { clearMegaTimelineCache } from '@/app/work-items/apply-calendar-event-schedule-to-work-items'
import { applyCloudTaskPersistTarget } from '@/app/calendar/apply-cloud-task-persist'
import {
  applyOptimisticCloudTaskPersistToLayer,
  syncFullCalendarCloudTaskEventFromLayer
} from '@/app/calendar/optimistic-cloud-task-calendar'
import { loadPlannedScheduleMapForTasks } from '@/app/work-items/load-planned-schedules'
import { loadUnifiedCloudTasks } from '@/app/tasks/tasks-calendar-load'
import { cloudTaskStableKey } from '@shared/work-item-keys'
import {
  fullCalendarEventToPatchSchedule,
  resolveCalendarEventGraphCalendarId
} from '@/app/calendar/calendar-shell-view-helpers'
import { useInboxCalendarAgendaCacheStore } from '@/stores/inbox-calendar-agenda-cache'
import { useMailStore } from '@/stores/mail'

export interface UseCalendarShellEventPersistParams {
  calendarRef: RefObject<FullCalendar | null>
  lastRangeRef: MutableRefObject<{ start: Date; end: Date }>
  fcTimeZone: string
  accountColorById: Record<string, string>
  cloudTaskByKeyRef: MutableRefObject<Map<string, CloudTaskListItem>>
  cloudTaskAllItemsRef: MutableRefObject<CloudTaskListItem[]>
  cloudTaskPlannedByKeyRef: MutableRefObject<Map<string, WorkItemPlannedSchedule>>
  cloudTaskPersistInFlightRef: MutableRefObject<number>
  graphCalendarPersistInFlightRef: MutableRefObject<number>
  graphCalendarReconcilingRef: MutableRefObject<boolean>
  skipCalendarReloadUntilRef: MutableRefObject<number>
  timelineReloadRef: MutableRefObject<(() => void) | null>
  taskAccounts: ConnectedAccount[]
  defaultGraphCalendarIdByAccount: Record<string, string | null>
  setError: Dispatch<SetStateAction<string | null>>
  setMailTodoItems: Dispatch<SetStateAction<MailListItem[]>>
  setTodoSideListRefreshKey: Dispatch<SetStateAction<number>>
  setEvents: Dispatch<SetStateAction<CalendarEventView[]>>
  setPreviewCalendarEvent: Dispatch<SetStateAction<CalendarEventView | null>>
  setGraphCalendarSourceRev: Dispatch<SetStateAction<number>>
  setPreviewCloudTask: Dispatch<SetStateAction<CloudTaskListItem | null>>
  setPreviewCloudTaskPlannedFromTimeline: Dispatch<SetStateAction<WorkItemPlannedSchedule | null>>
  commitCloudTaskLayer: (
    items: CloudTaskListItem[],
    plannedByKey: Map<string, WorkItemPlannedSchedule>,
    start: Date,
    end: Date,
    opts?: { force?: boolean }
  ) => void
  loadUserNotesForRange: (start: Date, end: Date) => void | Promise<void>
  setTodoScheduleForMessage: (
    messageId: number,
    startIso: string,
    endIso: string,
    opts?: { skipSelectedRefresh?: boolean }
  ) => Promise<void>
  t: TFunction
}

export function useCalendarShellEventPersist({
  calendarRef,
  lastRangeRef,
  fcTimeZone,
  accountColorById,
  cloudTaskByKeyRef,
  cloudTaskAllItemsRef,
  cloudTaskPlannedByKeyRef,
  cloudTaskPersistInFlightRef,
  graphCalendarPersistInFlightRef,
  graphCalendarReconcilingRef,
  skipCalendarReloadUntilRef,
  timelineReloadRef,
  taskAccounts,
  defaultGraphCalendarIdByAccount,
  setError,
  setMailTodoItems,
  setTodoSideListRefreshKey,
  setEvents,
  setPreviewCalendarEvent,
  setGraphCalendarSourceRev,
  setPreviewCloudTask,
  setPreviewCloudTaskPlannedFromTimeline,
  commitCloudTaskLayer,
  loadUserNotesForRange,
  setTodoScheduleForMessage,
  t
}: UseCalendarShellEventPersistParams) {
  const handleGraphEventChange = useCallback(
    async (info: EventChangeArg): Promise<void> => {
      const kind = info.event.extendedProps.calendarKind as string | undefined
      if (kind === CALENDAR_KIND_CLOUD_TASK) {
        const taskKey =
          (typeof info.event.extendedProps.taskKey === 'string' && info.event.extendedProps.taskKey) ||
          null
        if (!taskKey) {
          info.revert()
          return
        }
        const task = cloudTaskByKeyRef.current.get(taskKey)
        if (!task) {
          info.revert()
          return
        }
        const target = computePersistTargetForCloudTask(info.event, info.oldEvent, fcTimeZone)
        if (!target) {
          info.revert()
          return
        }
        try {
          cloudTaskPersistInFlightRef.current += 1
          await applyCloudTaskPersistTarget(target, task, fcTimeZone)
          setError(null)

          const optimistic = applyOptimisticCloudTaskPersistToLayer(
            target,
            task,
            cloudTaskAllItemsRef.current,
            cloudTaskPlannedByKeyRef.current,
            fcTimeZone
          )
          const api = calendarRef.current?.getApi()
          const { start, end } = api
            ? { start: api.view.activeStart, end: api.view.activeEnd }
            : lastRangeRef.current
          const optimisticTask: CloudTaskListItem =
            optimistic.items.find(
              (row) => cloudTaskStableKey(row.accountId, row.listId, row.id) === taskKey
            ) ?? task
          const optimisticPlanned = optimistic.plannedByKey.get(taskKey)
          const canonicalEventId = cloudTaskEventId(taskKey)

          flushSync(() => {
            commitCloudTaskLayer(optimistic.items, optimistic.plannedByKey, start, end, {
              force: true
            })
          })

          syncFullCalendarCloudTaskEventFromLayer(
            api,
            optimisticTask,
            optimisticPlanned,
            fcTimeZone,
            accountColorById
          )
          scheduleRemoveCloudTaskCalendarEventsByTaskKey(api, taskKey, canonicalEventId)

          const items = await loadUnifiedCloudTasks(taskAccounts, { cacheOnly: true })
          const plannedFromStore = await loadPlannedScheduleMapForTasks(items)
          const mergedPlanned = new Map(plannedFromStore)
          if (optimisticPlanned) mergedPlanned.set(taskKey, optimisticPlanned)
          const mergedItems = items.map((row) => {
            const rowKey = cloudTaskStableKey(row.accountId, row.listId, row.id)
            return rowKey === taskKey ? optimisticTask : row
          })
          if (
            !mergedItems.some(
              (row) => cloudTaskStableKey(row.accountId, row.listId, row.id) === taskKey
            )
          ) {
            mergedItems.push(optimisticTask)
          }
          commitCloudTaskLayer(mergedItems, mergedPlanned, start, end, { force: true })

          const apiAfter = calendarRef.current?.getApi()
          syncFullCalendarCloudTaskEventFromLayer(
            apiAfter,
            optimisticTask,
            optimisticPlanned,
            fcTimeZone,
            accountColorById
          )
          scheduleRemoveCloudTaskCalendarEventsByTaskKey(apiAfter, taskKey, canonicalEventId)

          setPreviewCloudTaskPlannedFromTimeline(optimisticPlanned ?? null)
          setPreviewCloudTask(optimisticTask)
          timelineReloadRef.current?.()
        } catch (e) {
          setError(e instanceof Error ? e.message : String(e))
          info.revert()
        } finally {
          cloudTaskPersistInFlightRef.current = Math.max(0, cloudTaskPersistInFlightRef.current - 1)
        }
        return
      }
      if (kind === CALENDAR_KIND_USER_NOTE) {
        const target = computePersistTargetForUserNote(info.event, fcTimeZone)
        if (!target) {
          info.revert()
          return
        }
        try {
          await window.mailClient.notes.setSchedule({
            id: target.noteId,
            scheduledStartIso: target.scheduledStartIso,
            scheduledEndIso: target.scheduledEndIso,
            scheduledAllDay: target.scheduledAllDay
          })
          setError(null)
          const api = calendarRef.current?.getApi()
          if (api) {
            scheduleRemoveDuplicateFullCalendarEventsById(api, [userNoteEventId(target.noteId)])
            void loadUserNotesForRange(api.view.activeStart, api.view.activeEnd)
          } else {
            const { start, end } = lastRangeRef.current
            void loadUserNotesForRange(start, end)
          }
        } catch (e) {
          setError(e instanceof Error ? e.message : String(e))
          info.revert()
        } finally {
          cloudTaskPersistInFlightRef.current = Math.max(0, cloudTaskPersistInFlightRef.current - 1)
        }
        return
      }
      if (kind === CALENDAR_KIND_MAIL_TODO) {
        const m = info.event.extendedProps.mailMessage as MailListItem | undefined
        const range = computePersistIsoRangeForMailTodo(info.event, info.oldEvent, fcTimeZone)
        if (!m || !range) {
          info.revert()
          return
        }
        try {
          const api = calendarRef.current?.getApi()
          const mailTodoFcId = info.event.id || mailTodoFullCalendarEventId(m)
          const optimisticMail: MailListItem = {
            ...m,
            todoStartAt: range.startIso,
            todoEndAt: range.endIso,
            todoDueAt: range.endIso
          }

          flushSync(() => {
            setMailTodoItems((prev) =>
              applyOptimisticMailTodoScheduleToItems(prev, m.id, range)
            )
          })
          syncFullCalendarMailTodoEventFromLayer(api, optimisticMail, accountColorById)

          await setTodoScheduleForMessage(m.id, range.startIso, range.endIso, {
            skipSelectedRefresh: true
          })
          await useMailStore.getState().reloadSelectedMessageFromDb()
          setError(null)
          setTodoSideListRefreshKey((k) => k + 1)
          timelineReloadRef.current?.()

          if (api) {
            syncFullCalendarMailTodoEventFromLayer(api, optimisticMail, accountColorById)
            scheduleRemoveMailTodoCalendarEventsByMessageId(api, m.id, mailTodoFcId)
            scheduleRemoveDuplicateFullCalendarEventsById(api, [mailTodoFcId])
          }
        } catch (e) {
          setError(e instanceof Error ? e.message : String(e))
          info.revert()
        }
        return
      }
      const calEv = info.event.extendedProps.calendarEvent as CalendarEventView | undefined
      const graphEventId = calEv?.graphEventId?.trim()
      if (!calEv || !graphEventId) {
        info.revert()
        return
      }
      const resolvedGraphCalendarId = resolveCalendarEventGraphCalendarId(
        calEv,
        defaultGraphCalendarIdByAccount
      )
      if (calEv.source === 'google' && !resolvedGraphCalendarId?.trim()) {
        info.revert()
        setError(t('calendar.errors.missingGraphCalendarId'))
        return
      }
      if (calEv.calendarCanEdit === false) {
        info.revert()
        setError(t('calendar.errors.calendarReadOnlyEdit'))
        return
      }
      const sched = fullCalendarEventToPatchSchedule({
        start: info.event.start,
        end: info.event.end,
        allDay: info.event.allDay
      })
      if (!sched) {
        info.revert()
        setError(t('calendar.errors.scheduleParseFailed'))
        return
      }
      if (graphCalendarPersistInFlightRef.current > 0) {
        info.revert()
        setError(t('calendar.errors.schedulePersistInFlight'))
        return
      }
      const updatedCalEv: CalendarEventView = {
        ...calEv,
        graphCalendarId: resolvedGraphCalendarId,
        startIso: sched.startIso,
        endIso: sched.endIso,
        isAllDay: sched.isAllDay
      }

      const applyOptimisticGraphSchedule = (): void => {
        graphCalendarReconcilingRef.current = true
        try {
          flushSync(() => {
            setEvents((prev) =>
              deduplicateCalendarEventsByGraphEventId(
                prev.map((ev) =>
                  ev.accountId === calEv.accountId && ev.graphEventId === calEv.graphEventId
                    ? updatedCalEv
                    : ev
                )
              )
            )
            setPreviewCalendarEvent((prev) =>
              prev &&
              prev.accountId === calEv.accountId &&
              prev.graphEventId === calEv.graphEventId
                ? updatedCalEv
                : prev
            )
            setGraphCalendarSourceRev((rev) => rev + 1)
          })
          useInboxCalendarAgendaCacheStore.getState().upsertPreviewCalendarEvent(updatedCalEv)
          const api = calendarRef.current?.getApi()
          syncFullCalendarGraphEventFromLayer(api, updatedCalEv)
          reconcileGraphCalendarEventOnCalendar(api, updatedCalEv)
        } finally {
          queueMicrotask(() => {
            graphCalendarReconcilingRef.current = false
          })
        }
      }

      const rollbackOptimisticGraphSchedule = (): void => {
        graphCalendarReconcilingRef.current = true
        try {
          flushSync(() => {
            setEvents((prev) =>
              deduplicateCalendarEventsByGraphEventId(
                prev.map((ev) =>
                  ev.accountId === calEv.accountId && ev.graphEventId === calEv.graphEventId
                    ? calEv
                    : ev
                )
              )
            )
            setPreviewCalendarEvent((prev) =>
              prev &&
              prev.accountId === calEv.accountId &&
              prev.graphEventId === calEv.graphEventId
                ? calEv
                : prev
            )
          })
          const api = calendarRef.current?.getApi()
          syncFullCalendarGraphEventFromLayer(api, calEv)
          reconcileGraphCalendarEventOnCalendar(api, calEv)
          info.revert()
        } finally {
          queueMicrotask(() => {
            graphCalendarReconcilingRef.current = false
          })
        }
      }

      graphCalendarPersistInFlightRef.current += 1
      skipCalendarReloadUntilRef.current = Date.now() + 6000
      applyOptimisticGraphSchedule()

      void (async (): Promise<void> => {
        try {
          const scheduleResolution = await resolveMeetingScheduleChange(calEv, t)
          if (scheduleResolution.action === 'discard') {
            rollbackOptimisticGraphSchedule()
            return
          }

          await window.mailClient.calendar.patchEventSchedule(
            patchScheduleInputWithMeetingNotify(
              {
                accountId: calEv.accountId,
                graphEventId,
                graphCalendarId: resolvedGraphCalendarId,
                startIso: sched.startIso,
                endIso: sched.endIso,
                isAllDay: sched.isAllDay
              },
              scheduleResolution.notifyAttendees
            )
          )
          setError(null)
          clearMegaTimelineCache()
          purgeDuplicateGraphCalendarEventsOnApi(calendarRef.current?.getApi())
          timelineReloadRef.current?.()
        } catch (e) {
          setError(e instanceof Error ? e.message : String(e))
          rollbackOptimisticGraphSchedule()
        } finally {
          graphCalendarPersistInFlightRef.current = Math.max(
            0,
            graphCalendarPersistInFlightRef.current - 1
          )
        }
      })()
    },
    [
      fcTimeZone,
      accountColorById,
      setTodoScheduleForMessage,
      taskAccounts,
      commitCloudTaskLayer,
      defaultGraphCalendarIdByAccount,
      t,
      calendarRef,
      lastRangeRef,
      cloudTaskByKeyRef,
      cloudTaskAllItemsRef,
      cloudTaskPlannedByKeyRef,
      cloudTaskPersistInFlightRef,
      graphCalendarPersistInFlightRef,
      graphCalendarReconcilingRef,
      skipCalendarReloadUntilRef,
      timelineReloadRef,
      setError,
      setMailTodoItems,
      setTodoSideListRefreshKey,
      setEvents,
      setPreviewCalendarEvent,
      setGraphCalendarSourceRev,
      setPreviewCloudTask,
      setPreviewCloudTaskPlannedFromTimeline,
      loadUserNotesForRange
    ]
  )

  return { handleGraphEventChange }
}
