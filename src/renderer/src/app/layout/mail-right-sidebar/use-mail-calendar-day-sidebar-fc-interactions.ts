import { useCallback, useMemo, useRef, useState, type RefObject, type SetStateAction } from 'react'
import type { EventChangeArg, EventMountArg } from '@fullcalendar/core'
import type FullCalendar from '@fullcalendar/react'
import type { CalendarEventView, ConnectedAccount, MailListItem } from '@shared/types'
import { useTranslation } from 'react-i18next'
import { CALENDAR_KIND_MAIL_TODO } from '@/app/calendar/mail-todo-calendar'
import { CALENDAR_KIND_CLOUD_TASK } from '@/app/calendar/cloud-task-calendar'
import { CALENDAR_KIND_USER_NOTE } from '@/app/calendar/notes-calendar'
import { useCalendarShellEventPersist } from '@/app/calendar/use-calendar-shell-event-persist'
import type { CalendarShellEventDialogState } from '@/app/calendar/calendar-shell-event-dialog-state'
import {
  attachCalendarOverlayContextMenu,
  attachGraphCalendarEventContextMenu,
  detachCalendarFcContextMenu,
  type CalendarFcContextMenuAnchor,
  type CalendarFcGraphEventContextMenuDeps
} from '@/app/calendar/calendar-fc-event-context-menu-mount'
import type { CalendarOverlayContextMenuOptions } from '@/app/calendar/calendar-overlay-context-menu'
import type { ContextMenuItem } from '@/components/ContextMenu'
import type { ObjectNoteTarget } from '@/components/ObjectNoteEditor'
import { accountColorToCssBackground } from '@/lib/avatar-color'
import { applyCalendarEventDomColors } from '@/lib/calendar-event-chip-style'
import { QUICK_CREATE_PLACEHOLDER_EVENT_ID } from '@/app/calendar/calendar-quick-create-placeholder'
import {
  mailReadingPopoutOptsFromClick,
  openMailReadingPopout
} from '@/lib/open-mail-reading-popout'
import { useCalendarCollatorLocale, useCalendarDateFnsLocale } from '@/hooks/use-calendar-date-fns-locale'
import { useMailStore } from '@/stores/mail'
import { useAppModeStore } from '@/stores/app-mode'
import { useComposeStore } from '@/stores/compose'
import { useSnoozeUiStore } from '@/stores/snooze-ui'
import type { MailContextHandlers } from '@/lib/mail-context-menu'
import type { WorkItemContextHandlers } from '@/app/work-items/work-item-context-menu'
import { accountSupportsCloudTasks } from '@/lib/cloud-task-accounts'
import { confirmDeleteCloudTasks } from '@/app/tasks/confirm-delete-cloud-task'
import { focusContextPreviewMailMessage } from '@/lib/focus-context-preview'
import type { CloudTaskListItem } from '@/app/tasks/tasks-types'

/** Kalender-Modul-Interaktionen (Kontextmenü, Drag, Resize) für die Mail-Rechtsspalte. */
export function useMailCalendarDaySidebarFcInteractions(opts: {
  calendarRef: RefObject<FullCalendar | null>
  calendarLinkedAccounts: ConnectedAccount[]
  taskAccounts: ConnectedAccount[]
  accountColorById: Record<string, string>
  defaultGraphCalendarIdByAccount: Record<string, string | null>
  rangeStart: Date
  rangeEndExcl: Date
  isTimeGridView: boolean
  canInteractInTimeGrid: boolean
  setMailTodos: React.Dispatch<React.SetStateAction<MailListItem[]>>
  reloadDayData: (created?: CalendarEventView) => void
}): {
  calendarEditable: boolean
  eventContextMenu: CalendarFcContextMenuAnchor | null
  setEventContextMenu: React.Dispatch<SetStateAction<CalendarFcContextMenuAnchor | null>>
  eventDialog: CalendarShellEventDialogState
  setEventDialog: React.Dispatch<SetStateAction<CalendarShellEventDialogState>>
  eventNoteTarget: ObjectNoteTarget | null
  setEventNoteTarget: React.Dispatch<SetStateAction<ObjectNoteTarget | null>>
  mailNoteTarget: Extract<ObjectNoteTarget, { kind: 'mail' }> | null
  setMailNoteTarget: React.Dispatch<
    SetStateAction<Extract<ObjectNoteTarget, { kind: 'mail' }> | null>
  >
  interactionError: string | null
  onEventDrop: (info: EventChangeArg) => void
  onEventResize: (info: EventChangeArg) => void
  onEventAllow: (
    _span: unknown,
    movingEvent: { extendedProps?: Record<string, unknown> } | null
  ) => boolean
  onEventDragStart: () => void
  clearPointerManipulatingSoon: () => void
  eventDidMount: (info: EventMountArg) => void
  eventWillUnmount: (info: EventMountArg) => void
} {
  const { t } = useTranslation()
  const calendarCollatorLocale = useCalendarCollatorLocale()
  const isDeCalendar = calendarCollatorLocale === 'de'
  const clipboardDfLocale = useCalendarDateFnsLocale()

  const setTodoScheduleForMessage = useMailStore((s) => s.setTodoScheduleForMessage)
  const selectMessage = useMailStore((s) => s.selectMessage)
  const setMessageRead = useMailStore((s) => s.setMessageRead)
  const toggleMessageFlag = useMailStore((s) => s.toggleMessageFlag)
  const archiveMessage = useMailStore((s) => s.archiveMessage)
  const deleteMessage = useMailStore((s) => s.deleteMessage)
  const setTodoForMessage = useMailStore((s) => s.setTodoForMessage)
  const completeTodoForMessage = useMailStore((s) => s.completeTodoForMessage)
  const setWaitingForMessage = useMailStore((s) => s.setWaitingForMessage)
  const clearWaitingForMessage = useMailStore((s) => s.clearWaitingForMessage)
  const refreshNow = useMailStore((s) => s.refreshNow)
  const openReply = useComposeStore((s) => s.openReply)
  const openForward = useComposeStore((s) => s.openForward)
  const openSnoozePicker = useSnoozeUiStore((s) => s.open)
  const setAppMode = useAppModeStore((s) => s.setMode)

  const [interactionError, setInteractionError] = useState<string | null>(null)
  const [eventContextMenu, setEventContextMenu] = useState<CalendarFcContextMenuAnchor | null>(null)
  const [eventDialog, setEventDialog] = useState<CalendarShellEventDialogState>(null)
  const [eventNoteTarget, setEventNoteTarget] = useState<ObjectNoteTarget | null>(null)
  const [mailNoteTarget, setMailNoteTarget] = useState<
    Extract<ObjectNoteTarget, { kind: 'mail' }> | null
  >(null)
  const [, setCalendarFolderContextMenu] = useState<CalendarFcContextMenuAnchor | null>(null)

  const lastRangeRef = useRef({ start: opts.rangeStart, end: opts.rangeEndExcl })
  lastRangeRef.current = { start: opts.rangeStart, end: opts.rangeEndExcl }

  const cloudTaskByKeyRef = useRef(new Map<string, CloudTaskListItem>())
  const cloudTaskAllItemsRef = useRef<CloudTaskListItem[]>([])
  const cloudTaskPlannedByKeyRef = useRef(new Map())
  const cloudTaskPersistInFlightRef = useRef(0)
  const graphCalendarPersistInFlightRef = useRef(0)
  const graphCalendarReconcilingRef = useRef(false)
  const skipCalendarReloadUntilRef = useRef(0)
  const timelineReloadRef = useRef<(() => void) | null>(null)

  const reloadVisibleRange = useCallback((): void => {
    opts.reloadDayData()
  }, [opts.reloadDayData])

  const noopSetEvents = useCallback((_action: SetStateAction<CalendarEventView[]>): void => {}, [])
  const bumpTodoSideList = useCallback((_v: SetStateAction<number>): void => {}, [])

  const { handleGraphEventChange, deleteGraphCalendarEvent } = useCalendarShellEventPersist({
    calendarRef: opts.calendarRef,
    lastRangeRef,
    fcTimeZone: 'local',
    accountColorById: opts.accountColorById,
    cloudTaskByKeyRef,
    cloudTaskAllItemsRef,
    cloudTaskPlannedByKeyRef,
    cloudTaskPersistInFlightRef,
    graphCalendarPersistInFlightRef,
    graphCalendarReconcilingRef,
    skipCalendarReloadUntilRef,
    timelineReloadRef,
    taskAccounts: opts.taskAccounts,
    defaultGraphCalendarIdByAccount: opts.defaultGraphCalendarIdByAccount,
    setError: setInteractionError,
    setMailTodoItems: opts.setMailTodos,
    setTodoSideListRefreshKey: bumpTodoSideList,
    setEvents: noopSetEvents,
    setPreviewCalendarEvent: (): void => {},
    setGraphCalendarSourceRev: (): void => {},
    setPreviewCloudTask: (): void => {},
    setPreviewCloudTaskPlannedFromTimeline: (): void => {},
    commitCloudTaskLayer: (): void => {},
    loadUserNotesForRange: (): void => {},
    setTodoScheduleForMessage,
    releasePinnedFcEventSources: (): void => {},
    t
  })

  const refreshMailTodos = useCallback((): void => {
    opts.reloadDayData()
  }, [opts.reloadDayData])

  const mailContextHandlers = useMemo<MailContextHandlers>(
    () => ({
      openReply,
      openForward,
      setMessageRead,
      toggleMessageFlag,
      archiveMessage,
      deleteMessage,
      setTodoForMessage,
      completeTodoForMessage: async (messageId: number): Promise<void> => {
        await completeTodoForMessage(messageId)
        refreshMailTodos()
      },
      setWaitingForMessage,
      clearWaitingForMessage,
      openSnoozePicker,
      refreshNow: async (): Promise<void> => {
        await refreshNow()
        refreshMailTodos()
      }
    }),
    [
      openReply,
      openForward,
      setMessageRead,
      toggleMessageFlag,
      archiveMessage,
      deleteMessage,
      setTodoForMessage,
      completeTodoForMessage,
      setWaitingForMessage,
      clearWaitingForMessage,
      openSnoozePicker,
      refreshNow,
      refreshMailTodos
    ]
  )

  const workContextHandlers = useMemo<WorkItemContextHandlers>(
    () => ({
      t,
      mailHandlers: mailContextHandlers,
      canCreateCloudTask: (accountId): boolean =>
        opts.taskAccounts.some((a) => a.id === accountId && accountSupportsCloudTasks(a)),
      onToggleCompleted: async (): Promise<void> => {
        refreshMailTodos()
      },
      onShowInCalendar: (): void => {
        setAppMode('calendar')
      },
      onOpenInMail: (item): void => {
        void selectMessage(item.messageId)
        setAppMode('mail')
      },
      onOpenInTasks: (): void => setAppMode('tasks'),
      onDeleteCloudTask: async (item): Promise<void> => {
        if (!(await confirmDeleteCloudTasks(t, 1))) return
        try {
          await window.mailClient.tasks.deleteTask({
            accountId: item.accountId,
            listId: item.listId,
            taskId: item.taskId
          })
          refreshMailTodos()
        } catch (err) {
          setInteractionError(err instanceof Error ? err.message : String(err))
        }
      },
      refreshMailList: refreshMailTodos
    }),
    [t, mailContextHandlers, opts.taskAccounts, refreshMailTodos, selectMessage, setAppMode]
  )

  const overlayContextMenuOptions = useMemo<CalendarOverlayContextMenuOptions>(
    () => ({
      t,
      mailTodoListLabel: t('calendar.shell.mailTodosLabel'),
      workItemHandlers: workContextHandlers,
      onEditMailTodo: (mail): void => {
        setInteractionError(null)
        void focusContextPreviewMailMessage(mail.id)
      }
    }),
    [t, workContextHandlers]
  )

  const overlayContextMenuOptionsRef = useRef(overlayContextMenuOptions)
  overlayContextMenuOptionsRef.current = overlayContextMenuOptions

  const graphContextMenuDeps = useMemo(
    (): CalendarFcGraphEventContextMenuDeps => ({
      t,
      calendarCollatorLocale,
      isDeCalendar,
      clipboardDfLocale,
      calendarLinkedAccounts: opts.calendarLinkedAccounts,
      reloadVisibleRange,
      setError: setInteractionError,
      setEventDialog,
      setMailNoteTarget,
      setEventNoteTarget,
      deleteGraphCalendarEvent,
      setCalendarFolderContextMenu,
      setEventContextMenu
    }),
    [
      t,
      calendarCollatorLocale,
      isDeCalendar,
      clipboardDfLocale,
      opts.calendarLinkedAccounts,
      reloadVisibleRange,
      deleteGraphCalendarEvent
    ]
  )
  const graphContextMenuDepsRef = useRef(graphContextMenuDeps)
  graphContextMenuDepsRef.current = graphContextMenuDeps

  const calendarEditable =
    opts.isTimeGridView && (opts.calendarLinkedAccounts.length > 0 || opts.taskAccounts.length > 0)

  const clearPointerManipulatingSoon = useCallback((): void => {
    queueMicrotask(() => {
      /* Sidebar hat keine gepinnten EventSources — Flag nur für API-Kompatibilität. */
    })
  }, [])

  const onEventDragStart = useCallback((): void => {}, [])

  const onEventDrop = useCallback(
    (info: EventChangeArg): void => {
      void handleGraphEventChange(info)
    },
    [handleGraphEventChange]
  )

  const onEventResize = useCallback(
    (info: EventChangeArg): void => {
      void handleGraphEventChange(info)
    },
    [handleGraphEventChange]
  )

  const onEventAllow = useCallback(
    (_span: unknown, movingEvent: { extendedProps?: Record<string, unknown> } | null): boolean => {
      if (!movingEvent) return true
      const kind = movingEvent.extendedProps?.calendarKind as string | undefined
      if (kind === CALENDAR_KIND_MAIL_TODO) return true
      if (kind === CALENDAR_KIND_CLOUD_TASK) return true
      if (kind === CALENDAR_KIND_USER_NOTE) return true
      const calEv = movingEvent.extendedProps?.calendarEvent as CalendarEventView | undefined
      if (!calEv?.graphEventId || calEv.calendarCanEdit === false) return false
      if (calEv.source === 'microsoft' || calEv.source === 'google') return true
      return false
    },
    []
  )

  const eventDidMount = useCallback((info: EventMountArg): void => {
    if (
      info.event.id === QUICK_CREATE_PLACEHOLDER_EVENT_ID ||
      info.el.classList.contains('fc-event-mirror')
    ) {
      return
    }
    const kind = info.event.extendedProps.calendarKind as string | undefined
    if (kind === CALENDAR_KIND_MAIL_TODO) {
      const raw = info.event.extendedProps.accountColor as string | undefined
      const bg = accountColorToCssBackground(raw)
      if (bg) {
        info.el.style.backgroundColor = bg
        info.el.style.borderColor = 'transparent'
        info.el.style.color = '#fafafa'
      } else {
        info.el.style.borderLeft = '4px solid hsl(var(--primary))'
      }
      const m = info.event.extendedProps.mailMessage as MailListItem | undefined
      if (m) {
        attachCalendarOverlayContextMenu(
          info.el,
          { kind: 'mail_todo', mail: m },
          {
            setError: setInteractionError,
            setCalendarFolderContextMenu,
            setEventContextMenu,
            overlayContextMenuOptionsRef
          }
        )
        const mailEl = info.el as HTMLElement & { _calMailDblclick?: (ev: MouseEvent) => void }
        const onMailDblclick = (e: MouseEvent): void => {
          e.preventDefault()
          e.stopPropagation()
          openMailReadingPopout(m.id, mailReadingPopoutOptsFromClick(e))
        }
        mailEl._calMailDblclick = onMailDblclick
        info.el.addEventListener('dblclick', onMailDblclick)
      }
      return
    }
    if (kind === CALENDAR_KIND_CLOUD_TASK || kind === CALENDAR_KIND_USER_NOTE) {
      return
    }
    const calEv = info.event.extendedProps.calendarEvent as CalendarEventView | undefined
    const displayHex =
      (info.event.extendedProps.displayColorHex as string | null | undefined) ??
      calEv?.displayColorHex
    const tw =
      (info.event.extendedProps.accountColor as string | undefined) ?? calEv?.accountColorClass
    applyCalendarEventDomColors(info.el as HTMLElement, {
      displayColorHex: displayHex ?? null,
      accountTailwindBgClass: tw ?? null
    })
    if (!calEv) return
    attachGraphCalendarEventContextMenu(info.el, calEv, graphContextMenuDepsRef.current)
  }, [])

  const eventWillUnmount = useCallback((info: EventMountArg): void => {
    const el = info.el as HTMLElement & { _calMailDblclick?: (ev: MouseEvent) => void }
    detachCalendarFcContextMenu(info.el)
    if (el._calMailDblclick) {
      info.el.removeEventListener('dblclick', el._calMailDblclick)
      delete el._calMailDblclick
    }
  }, [])

  return {
    calendarEditable,
    eventContextMenu,
    setEventContextMenu,
    eventDialog,
    setEventDialog,
    eventNoteTarget,
    setEventNoteTarget,
    mailNoteTarget,
    setMailNoteTarget,
    interactionError,
    onEventDrop,
    onEventResize,
    onEventAllow,
    onEventDragStart,
    clearPointerManipulatingSoon,
    eventDidMount,
    eventWillUnmount
  }
}
