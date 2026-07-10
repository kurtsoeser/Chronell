import { useCallback, useMemo, useRef, type Dispatch, type RefObject, type SetStateAction } from 'react'
import type { TFunction } from 'i18next'
import type FullCalendar from '@fullcalendar/react'
import type { ConnectedAccount, MailListItem, TodoDueKindOpen } from '@shared/types'
import type { CloudTaskListItem } from '@/app/tasks/tasks-types'
import type { CloudTaskDragPayload } from '@/app/tasks/tasks-cloud-task-dnd'
import { useMailStore } from '@/stores/mail'
import { useComposeStore } from '@/stores/compose'
import { useSnoozeUiStore } from '@/stores/snooze-ui'
import { loadPlannedScheduleMapForTasks } from '@/app/work-items/load-planned-schedules'
import { loadUnifiedCloudTasks } from '@/app/tasks/tasks-calendar-load'
import { applyCloudTaskPersistTarget } from '@/app/calendar/apply-cloud-task-persist'
import { useCalendarMailExternalDrop } from '@/lib/use-calendar-mail-external-drop'
import { useCalendarCloudTaskExternalDrop } from '@/lib/use-calendar-cloud-task-external-drop'
import { useCalendarIcsDrop } from '@/lib/use-calendar-ics-drop'
import {
  type MailContextHandlers
} from '@/lib/mail-context-menu'
import {
  createMailSendToExistingNoteHandler,
  createMailSendToNewNoteHandler
} from '@/lib/mail-to-note'
import type { ObjectNoteTarget } from '@/components/ObjectNoteEditor'

export function useCalendarShellMailActions(args: {
  t: TFunction
  fcTimeZone: string
  taskAccounts: ConnectedAccount[]
  calendarDropRootRef: RefObject<HTMLDivElement | null>
  calendarRef: RefObject<FullCalendar | null>
  lastRangeRef: RefObject<{ start: Date; end: Date }>
  timelineReloadRef: RefObject<(() => void) | null>
  loadMailTodosForRange: (start: Date, end: Date) => Promise<void>
  commitCloudTaskLayer: (
    items: CloudTaskListItem[],
    planned: Map<string, import('@shared/work-item').WorkItemPlannedSchedule>,
    start: Date,
    end: Date
  ) => void
  bumpCloudTaskLayerRevision: () => void
  setTodoSideListRefreshKey: Dispatch<SetStateAction<number>>
  setError: (msg: string | null) => void
  setEventNoteTarget: (t: ObjectNoteTarget | null) => void
  setMailNoteTarget: (t: Extract<ObjectNoteTarget, { kind: 'mail' }> | null) => void
  selectMessage: (id: number) => void
}) {
  const {
    t,
    fcTimeZone,
    taskAccounts,
    calendarDropRootRef,
    calendarRef,
    lastRangeRef,
    timelineReloadRef,
    loadMailTodosForRange,
    commitCloudTaskLayer,
    bumpCloudTaskLayerRevision,
    setTodoSideListRefreshKey,
    setError,
    setEventNoteTarget,
    setMailNoteTarget,
    selectMessage
  } = args

  const openReply = useComposeStore((s) => s.openReply)
  const openForward = useComposeStore((s) => s.openForward)
  const openSnoozePicker = useSnoozeUiStore((s) => s.open)
  const setTodoScheduleForMessage = useMailStore((s) => s.setTodoScheduleForMessage)
  const refreshNow = useMailStore((s) => s.refreshNow)
  const setMessageRead = useMailStore((s) => s.setMessageRead)
  const toggleMessageFlag = useMailStore((s) => s.toggleMessageFlag)
  const archiveMessage = useMailStore((s) => s.archiveMessage)
  const deleteMessage = useMailStore((s) => s.deleteMessage)
  const setTodoForMessage = useMailStore((s) => s.setTodoForMessage)
  const completeTodoForMessage = useMailStore((s) => s.completeTodoForMessage)
  const setWaitingForMessage = useMailStore((s) => s.setWaitingForMessage)
  const clearWaitingForMessage = useMailStore((s) => s.clearWaitingForMessage)

  const bumpTodoOverlayAndSideList = useCallback((): void => {
    setTodoSideListRefreshKey((k) => k + 1)
    timelineReloadRef.current?.()
    const api = calendarRef.current?.getApi()
    if (api) {
      void loadMailTodosForRange(api.view.activeStart, api.view.activeEnd)
      return
    }
    const range = lastRangeRef.current
    if (!range) return
    const { start, end } = range
    void loadMailTodosForRange(start, end)
  }, [calendarRef, lastRangeRef, loadMailTodosForRange, setTodoSideListRefreshKey, timelineReloadRef])

  const scheduleMailsOnCalendar = useCallback(
    async (messageIds: number[], startIso: string, endIso: string): Promise<void> => {
      for (const id of messageIds) {
        await setTodoScheduleForMessage(id, startIso, endIso, { skipSelectedRefresh: true })
      }
      await useMailStore.getState().reloadSelectedMessageFromDb()
      bumpTodoOverlayAndSideList()
    },
    [setTodoScheduleForMessage, bumpTodoOverlayAndSideList]
  )

  const setTodoForCalendarShell = useCallback(
    async (messageId: number, dueKind: TodoDueKindOpen): Promise<void> => {
      await setTodoForMessage(messageId, dueKind)
      bumpTodoOverlayAndSideList()
    },
    [setTodoForMessage, bumpTodoOverlayAndSideList]
  )

  const completeTodoForCalendarShell = useCallback(
    async (messageId: number): Promise<void> => {
      await completeTodoForMessage(messageId)
      bumpTodoOverlayAndSideList()
    },
    [completeTodoForMessage, bumpTodoOverlayAndSideList]
  )

  const mailContextHandlers = useMemo<MailContextHandlers>(
    () => ({
      openReply,
      openForward,
      openNote: (message: MailListItem): void => {
        setEventNoteTarget(null)
        setMailNoteTarget({
          kind: 'mail',
          messageId: message.id,
          title: message.subject || t('common.noSubject')
        })
        void selectMessage(message.id)
      },
      sendMailToNewNote: createMailSendToNewNoteHandler(),
      sendMailToExistingNote: createMailSendToExistingNoteHandler(),
      setMessageRead,
      toggleMessageFlag,
      archiveMessage,
      deleteMessage,
      setTodoForMessage: setTodoForCalendarShell,
      completeTodoForMessage: completeTodoForCalendarShell,
      setWaitingForMessage,
      clearWaitingForMessage,
      openSnoozePicker,
      refreshNow: async (): Promise<void> => {
        await refreshNow()
        bumpTodoOverlayAndSideList()
      }
    }),
    [
      openReply,
      openForward,
      t,
      selectMessage,
      setMessageRead,
      toggleMessageFlag,
      archiveMessage,
      deleteMessage,
      setTodoForCalendarShell,
      completeTodoForCalendarShell,
      setWaitingForMessage,
      clearWaitingForMessage,
      openSnoozePicker,
      refreshNow,
      bumpTodoOverlayAndSideList,
      setEventNoteTarget,
      setMailNoteTarget
    ]
  )

  const mailContextHandlersRef = useRef<MailContextHandlers>(mailContextHandlers)
  mailContextHandlersRef.current = mailContextHandlers

  useCalendarMailExternalDrop(calendarDropRootRef, {
    timeZone: fcTimeZone,
    enabled: true,
    onScheduleMany: scheduleMailsOnCalendar
  })

  const scheduleCloudTaskFromExternalDrop = useCallback(
    async (payload: CloudTaskDragPayload, startIso: string, endIso: string): Promise<void> => {
      const taskPick = { accountId: payload.accountId, listId: payload.listId, id: payload.taskId }
      const target = {
        kind: 'planned' as const,
        taskKey: payload.taskKey,
        plannedStartIso: startIso,
        plannedEndIso: endIso
      }
      try {
        await applyCloudTaskPersistTarget(target, taskPick, fcTimeZone)
        setError(null)
        const items = await loadUnifiedCloudTasks(taskAccounts, { cacheOnly: true })
        const planned = await loadPlannedScheduleMapForTasks(items)
        const api = calendarRef.current?.getApi()
        const range = api
          ? { start: api.view.activeStart, end: api.view.activeEnd }
          : lastRangeRef.current
        if (!range) return
        const { start, end } = range
        bumpCloudTaskLayerRevision()
        commitCloudTaskLayer(items, planned, start, end)
        setTodoSideListRefreshKey((k) => k + 1)
        timelineReloadRef.current?.()
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      }
    },
    [
      fcTimeZone,
      taskAccounts,
      calendarRef,
      lastRangeRef,
      commitCloudTaskLayer,
      bumpCloudTaskLayerRevision,
      setTodoSideListRefreshKey,
      timelineReloadRef,
      setError
    ]
  )

  useCalendarCloudTaskExternalDrop(calendarDropRootRef, {
    timeZone: fcTimeZone,
    enabled: true,
    onSchedulePlanned: scheduleCloudTaskFromExternalDrop
  })

  useCalendarIcsDrop(calendarDropRootRef, { enabled: true })

  return { mailContextHandlers, mailContextHandlersRef, bumpTodoOverlayAndSideList }
}
