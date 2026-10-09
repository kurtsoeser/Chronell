import FullCalendar from '@fullcalendar/react'
import type { EventChangeArg, EventContentArg, EventInput, EventSourceInput, LocaleInput } from '@fullcalendar/core'
import {
  memo,
  useCallback,
  useMemo,
  useRef,
  type RefObject,
  type MutableRefObject,
  type Dispatch,
  type SetStateAction
} from 'react'
import type FullCalendarType from '@fullcalendar/react'
import { startOfMonth } from 'date-fns'
import type { TFunction } from 'i18next'
import type {
  CalendarEventView,
  CalendarGraphCalendarRow,
  ConnectedAccount,
  MailListItem,
  UserNoteListItem
} from '@shared/types'
import {
  CALENDAR_KIND_MAIL_TODO
} from '@/app/calendar/mail-todo-calendar'
import {
  CALENDAR_KIND_CLOUD_TASK
} from '@/app/calendar/cloud-task-calendar'
import {
  CALENDAR_KIND_USER_NOTE
} from '@/app/calendar/notes-calendar'
import { purgeDuplicateGraphCalendarEventsOnApi } from '@/app/calendar/calendar-graph-events'
import {
  applyMultiMonthEventDotMount,
  isMultiMonthFcView,
  multiMonthDatesSetKey,
  shouldSkipHeavyCalendarLayersForMultiMonth
} from '@/app/calendar/calendar-fc-multimonth'
import { QUICK_CREATE_PLACEHOLDER_EVENT_ID } from '@/app/calendar/calendar-quick-create-placeholder'
import type { CalendarCreateRange } from '@/app/tasks/tasks-calendar-create-range'
import { CALENDAR_FC_PLUGINS } from '@/app/calendar/calendar-fc-plugins'
import {
  readCalendarActiveFcView,
  persistCalendarActiveFcView
} from '@/app/calendar/calendar-active-fc-view-storage'
import { syncFullCalendarWidth } from '@/app/calendar/sync-full-calendar-width'
import { calendarShellFullCalendarPropsAreEqual } from '@/app/calendar/calendar-shell-full-calendar-props-equal'
import { accountColorToCssBackground } from '@/lib/avatar-color'
import {
  attachCalendarOverlayContextMenu,
  attachGraphCalendarEventContextMenu,
  detachCalendarFcContextMenu
} from '@/app/calendar/calendar-fc-event-context-menu-mount'
import { applyCalendarEventDomColors } from '@/lib/calendar-event-chip-style'
import {
  mailReadingPopoutOptsFromClick,
  openMailReadingPopout
} from '@/lib/open-mail-reading-popout'
import { useNotesPendingFocusStore } from '@/stores/notes-pending-focus'
import { useAppModeStore } from '@/stores/app-mode'
import type { CloudTaskListItem } from '@/app/tasks/tasks-types'
import { cloudTaskStableKey } from '@shared/work-item-keys'
import { previewStableKeyFromFcEvent } from '@/app/calendar/calendar-preview-focus'
import type { Locale } from 'date-fns'
import type { ContextMenuItem } from '@/components/ContextMenu'
import type { CalendarOverlayContextMenuOptions } from '@/app/calendar/calendar-overlay-context-menu'
import type { ObjectNoteTarget } from '@/components/ObjectNoteEditor'
import { type TimeGridSlotMinutes } from '@/app/calendar/calendar-shell-storage'
import type { IdBulkSelection } from '@/lib/id-bulk-selection'
import type { CalendarShellEventDialogState, SetCalendarShellEventDialog } from '@/app/calendar/calendar-shell-event-dialog-state'

export interface CalendarShellFullCalendarProps {
  fcTimeZone: string
  i18nLanguage: string
  timeGridSlotMinutes: TimeGridSlotMinutes
  calSettings: {
    weekStartsOn: number
    slotMinTime: string
    slotMaxTime: string
    scrollTime: string
    hideWeekends: boolean
  }
  calendarRef: RefObject<FullCalendarType>
  fcLocale: LocaleInput
  timeGridFcSlotOpts: { slotDuration: string; snapDuration: string }
  multiDayViews: Record<string, unknown>
  dayGridMonthView: Record<string, unknown>
  multiMonthViews: Record<string, unknown>
  isMultiMonthActive: boolean
  calendarLinkedAccounts: ConnectedAccount[]
  mailTodoOverlay: boolean
  cloudTaskOverlay: boolean
  userNoteOverlay: boolean
  handleGraphEventChange: (info: EventChangeArg) => void | Promise<void>
  deleteGraphCalendarEvent: (ev: CalendarEventView) => Promise<void>
  /** Shared mit Shell: pinnt FC-EventSources während Drag/Resize. */
  eventPointerManipulatingRef: MutableRefObject<boolean>
  canInteractInTimeGrid: boolean
  setError: (msg: string | null) => void
  setPreviewCloudTask: Dispatch<SetStateAction<CloudTaskListItem | null>>
  setPreviewCloudTaskPlannedFromTimeline: Dispatch<SetStateAction<WorkItemPlannedSchedule | null>>
  setPreviewCalendarEvent: Dispatch<SetStateAction<CalendarEventView | null>>
  schedulingOpen: boolean
  addSchedulingSlot: (range: CalendarCreateRange) => void
  setQuickCreate: Dispatch<
    SetStateAction<{ anchor: { x: number; y: number }; range: CalendarCreateRange } | null>
  >
  fcEventSources: EventSourceInput[]
  graphCalendarReconcilingRef: MutableRefObject<boolean>
  calendarFcEventContentRender: (arg: EventContentArg) => { domNodes: Node[] }
  cloudTaskElByKeyRef: MutableRefObject<Map<string, HTMLElement>>
  t: TFunction
  reloadVisibleRange: (opts?: { silent?: boolean; forceRefresh?: boolean }) => void
  calendarCollatorLocale: string
  isDeCalendar: boolean
  clipboardDfLocale: Locale
  setEventDialog: SetCalendarShellEventDialog
  setMailNoteTarget: Dispatch<
    SetStateAction<Extract<ObjectNoteTarget, { kind: 'mail' }> | null>
  >
  setEventNoteTarget: Dispatch<SetStateAction<ObjectNoteTarget | null>>
  setCalendarFolderContextMenu: Dispatch<
    SetStateAction<{ x: number; y: number; items: ContextMenuItem[] } | null>
  >
  setEventContextMenu: Dispatch<
    SetStateAction<{ x: number; y: number; items: ContextMenuItem[] } | null>
  >
  overlayContextMenuOptionsRef: MutableRefObject<CalendarOverlayContextMenuOptions>
  calendarDropRootRef: RefObject<HTMLDivElement>
  lastDatesSetKeyRef: MutableRefObject<string>
  lastRangeRef: MutableRefObject<{ start: Date; end: Date }>
  activeViewIdRef: MutableRefObject<string>
  setActiveViewId: Dispatch<SetStateAction<string>>
  setVisibleStart: Dispatch<SetStateAction<Date>>
  setMiniMonth: Dispatch<SetStateAction<Date>>
  setRangeTitle: Dispatch<SetStateAction<string>>
  datesSetLoadTimerRef: MutableRefObject<ReturnType<typeof setTimeout> | undefined>
  loadRange: (
    start: Date,
    end: Date,
    opts?: { silent?: boolean }
  ) => void | Promise<void>
  eventsRef: MutableRefObject<EventInput[]>
  mailTodoOverlayRef: MutableRefObject<boolean>
  cloudTaskOverlayRef: MutableRefObject<boolean>
  userNoteOverlayRef: MutableRefObject<boolean>
  loadMailTodosForRange: (start: Date, end: Date) => void | Promise<void>
  loadCloudTasksForRange: (start: Date, end: Date) => void | Promise<void>
  loadUserNotesForRange: (start: Date, end: Date) => void | Promise<void>
  graphEventSelection: IdBulkSelection<string>
  graphEventKey: (ev: CalendarEventView) => string
  clearSelectedMessage: () => void
  selectMessageWithThreadPreview: (messageId: number) => void | Promise<void>
  persistRightPreviewOpen: (open: boolean) => void
  setRightPreviewOpen: (open: boolean) => void
  previewFocusStableKey: string | null
}

import type { WorkItemPlannedSchedule } from '@shared/work-item'

export const CalendarShellFullCalendar = memo(function CalendarShellFullCalendar(
  props: CalendarShellFullCalendarProps
): JSX.Element {
  const {
    fcTimeZone,
    i18nLanguage,
    timeGridSlotMinutes,
    calSettings,
    calendarRef,
    fcLocale,
    timeGridFcSlotOpts,
    multiDayViews,
    dayGridMonthView,
    multiMonthViews,
    isMultiMonthActive,
    calendarLinkedAccounts,
    mailTodoOverlay,
    cloudTaskOverlay,
    userNoteOverlay,
    handleGraphEventChange,
    deleteGraphCalendarEvent,
    eventPointerManipulatingRef,
    canInteractInTimeGrid,
    setError,
    setPreviewCloudTask,
    setPreviewCloudTaskPlannedFromTimeline,
    setPreviewCalendarEvent,
    schedulingOpen,
    addSchedulingSlot,
    setQuickCreate,
    fcEventSources,
    graphCalendarReconcilingRef,
    calendarFcEventContentRender,
    cloudTaskElByKeyRef,
    t,
    reloadVisibleRange,
    calendarCollatorLocale,
    isDeCalendar,
    clipboardDfLocale,
    setEventDialog,
    setMailNoteTarget,
    setEventNoteTarget,
    setCalendarFolderContextMenu,
    setEventContextMenu,
    overlayContextMenuOptionsRef,
    calendarDropRootRef,
    lastDatesSetKeyRef,
    lastRangeRef,
    activeViewIdRef,
    setActiveViewId,
    setVisibleStart,
    setMiniMonth,
    setRangeTitle,
    datesSetLoadTimerRef,
    loadRange,
    eventsRef,
    mailTodoOverlayRef,
    cloudTaskOverlayRef,
    userNoteOverlayRef,
    loadMailTodosForRange,
    loadCloudTasksForRange,
    loadUserNotesForRange,
    graphEventSelection,
    graphEventKey,
    clearSelectedMessage,
    selectMessageWithThreadPreview,
    persistRightPreviewOpen,
    setRightPreviewOpen,
    previewFocusStableKey
  } = props

  const handlersRef = useRef({
    handleGraphEventChange,
    deleteGraphCalendarEvent,
    setError,
    setPreviewCloudTask,
    setPreviewCloudTaskPlannedFromTimeline,
    setPreviewCalendarEvent,
    addSchedulingSlot,
    setQuickCreate,
    reloadVisibleRange,
    setEventDialog,
    setMailNoteTarget,
    setEventNoteTarget,
    setCalendarFolderContextMenu,
    setEventContextMenu,
    clearSelectedMessage,
    selectMessageWithThreadPreview,
    persistRightPreviewOpen,
    setRightPreviewOpen,
    setActiveViewId,
    setVisibleStart,
    setMiniMonth,
    setRangeTitle,
    loadRange,
    loadMailTodosForRange,
    loadCloudTasksForRange,
    loadUserNotesForRange,
    t,
    calendarCollatorLocale,
    isDeCalendar,
    clipboardDfLocale,
    calendarFcEventContentRender
  })
  handlersRef.current = {
    handleGraphEventChange,
    deleteGraphCalendarEvent,
    setError,
    setPreviewCloudTask,
    setPreviewCloudTaskPlannedFromTimeline,
    setPreviewCalendarEvent,
    addSchedulingSlot,
    setQuickCreate,
    reloadVisibleRange,
    setEventDialog,
    setMailNoteTarget,
    setEventNoteTarget,
    setCalendarFolderContextMenu,
    setEventContextMenu,
    clearSelectedMessage,
    selectMessageWithThreadPreview,
    persistRightPreviewOpen,
    setRightPreviewOpen,
    setActiveViewId,
    setVisibleStart,
    setMiniMonth,
    setRangeTitle,
    loadRange,
    loadMailTodosForRange,
    loadCloudTasksForRange,
    loadUserNotesForRange,
    t,
    calendarCollatorLocale,
    isDeCalendar,
    clipboardDfLocale,
    calendarFcEventContentRender
  }

  const views = useMemo(
    () => ({
      timeGrid: timeGridFcSlotOpts,
      ...multiDayViews,
      ...dayGridMonthView,
      ...multiMonthViews
    }),
    [timeGridFcSlotOpts, multiDayViews, dayGridMonthView, multiMonthViews]
  )

  const clearPointerManipulatingSoon = useCallback((): void => {
    // eventDragStop läuft vor eventDrop — Flag erst danach lösen, sonst Purge/Pin-Race.
    queueMicrotask(() => {
      eventPointerManipulatingRef.current = false
    })
  }, [eventPointerManipulatingRef])

  const onEventDragStart = useCallback((): void => {
    eventPointerManipulatingRef.current = true
  }, [eventPointerManipulatingRef])

  const onEventDrop = useCallback((info: EventChangeArg): void => {
    void handlersRef.current.handleGraphEventChange(info)
  }, [])

  const onEventResize = useCallback((info: EventChangeArg): void => {
    void handlersRef.current.handleGraphEventChange(info)
  }, [])

  const onEventAllow = useCallback((_span: unknown, movingEvent: { extendedProps?: Record<string, unknown> } | null): boolean => {
    if (!movingEvent) return true
    const kind = movingEvent.extendedProps?.calendarKind as string | undefined
    if (kind === CALENDAR_KIND_MAIL_TODO) return true
    if (kind === CALENDAR_KIND_CLOUD_TASK) return true
    if (kind === CALENDAR_KIND_USER_NOTE) return true
    const calEv = movingEvent.extendedProps?.calendarEvent as CalendarEventView | undefined
    if (!calEv?.graphEventId || calEv.calendarCanEdit === false) return false
    if (calEv.source === 'microsoft' || calEv.source === 'google') return true
    return false
  }, [])

  const onEventsSet = useCallback((): void => {
    if (graphCalendarReconcilingRef.current) return
    if (eventPointerManipulatingRef.current) return
    purgeDuplicateGraphCalendarEventsOnApi(calendarRef.current?.getApi())
  }, [calendarRef, eventPointerManipulatingRef, graphCalendarReconcilingRef])

  const calendarEditable =
    !isMultiMonthActive &&
    (calendarLinkedAccounts.length > 0 ||
      mailTodoOverlay ||
      cloudTaskOverlay ||
      userNoteOverlay)

  return (
    <FullCalendar
      key={`${fcTimeZone}-${i18nLanguage}-${timeGridSlotMinutes}-${calSettings.weekStartsOn}-${calSettings.slotMinTime}-${calSettings.slotMaxTime}-${calSettings.hideWeekends}`}
      ref={calendarRef}
      plugins={CALENDAR_FC_PLUGINS}
      locale={fcLocale}
      height="100%"
      handleWindowResize
      timeZone={fcTimeZone}
      headerToolbar={false}
      firstDay={calSettings.weekStartsOn}
      weekends={!calSettings.hideWeekends}
      views={views}
      initialView={readCalendarActiveFcView()}
      slotMinTime={calSettings.slotMinTime}
      slotMaxTime={calSettings.slotMaxTime}
      scrollTime={calSettings.scrollTime}
      slotDuration={timeGridFcSlotOpts.slotDuration}
      snapDuration={timeGridFcSlotOpts.snapDuration}
      slotLabelInterval="01:00:00"
      nowIndicator
      editable={calendarEditable}
      eventResizableFromStart={calendarEditable}
      eventDragStart={onEventDragStart}
      eventDragStop={clearPointerManipulatingSoon}
      eventResizeStart={onEventDragStart}
      eventResizeStop={clearPointerManipulatingSoon}
      eventDrop={onEventDrop}
      eventResize={onEventResize}
      eventAllow={onEventAllow}
      selectable={canInteractInTimeGrid}
      selectMirror={false}
      selectLongPressDelay={380}
      selectAllow={(): boolean => canInteractInTimeGrid}
      dateClick={(info): void => {
        if (!isMultiMonthFcView(info.view.type)) return
        const api = calendarRef.current?.getApi()
        if (!api) return
        api.gotoDate(info.date)
        api.changeView('dayGridMonth')
        setActiveViewId('dayGridMonth')
        persistCalendarActiveFcView('dayGridMonth')
      }}
      select={(sel): void => {
        if (!canInteractInTimeGrid) return
        setError(null)
        setPreviewCloudTask(null)
        setPreviewCloudTaskPlannedFromTimeline(null)
        setPreviewCalendarEvent(null)
        if (schedulingOpen) {
          addSchedulingSlot({
            start: sel.start,
            end: sel.end,
            allDay: sel.allDay
          })
          queueMicrotask(() => calendarRef.current?.getApi().unselect())
          return
        }
        const js = sel.jsEvent as MouseEvent | undefined
        setQuickCreate({
          anchor: {
            x: js?.clientX ?? window.innerWidth / 2,
            y: js?.clientY ?? window.innerHeight / 2
          },
          range: { start: sel.start, end: sel.end, allDay: sel.allDay }
        })
        queueMicrotask(() => calendarRef.current?.getApi().unselect())
      }}
      dayMaxEvents
      eventSources={fcEventSources}
      eventsSet={onEventsSet}
      eventContent={calendarFcEventContentRender}
      eventDidMount={(info): void => {
        if (
          info.event.id === QUICK_CREATE_PLACEHOLDER_EVENT_ID ||
          info.el.classList.contains('fc-event-mirror') ||
          info.event.classNames.includes('fc-scheduling-slot-placeholder')
        ) {
          return
        }
        const kind = info.event.extendedProps.calendarKind as string | undefined
        if (isMultiMonthFcView(info.view.type)) {
          applyMultiMonthEventDotMount(info)
          if (kind !== CALENDAR_KIND_CLOUD_TASK && kind !== CALENDAR_KIND_MAIL_TODO) {
            return
          }
        }
        if (kind === CALENDAR_KIND_CLOUD_TASK) {
          const el = info.el as HTMLElement & {
            _cloudTaskBaseStyled?: boolean
            _cloudTaskPreviewKey?: string | null
          }
          const cloudTask = info.event.extendedProps.cloudTask as
            | CloudTaskListItem
            | undefined
          el.classList.toggle('fc-cal-event--completed', cloudTask?.completed === true)
          const raw = info.event.extendedProps.accountColor as string | undefined
          const bg = accountColorToCssBackground(raw)
          const key =
            typeof info.event.extendedProps.taskKey === 'string'
              ? info.event.extendedProps.taskKey
              : ''
          if (!el._cloudTaskBaseStyled) {
            el._cloudTaskBaseStyled = true
            if (bg) {
              el.style.backgroundColor = bg
              el.style.borderColor = 'transparent'
              el.style.color = '#fafafa'
            } else {
              el.style.borderLeft = '4px solid hsl(var(--primary))'
            }
          }
          if (key) cloudTaskElByKeyRef.current.set(key, el)
          if (cloudTask) {
            attachCalendarOverlayContextMenu(
              info.el,
              { kind: 'cloud_task', task: cloudTask },
              {
                setError,
                setCalendarFolderContextMenu,
                setEventContextMenu,
                overlayContextMenuOptionsRef
              }
            )
          }
          return
        }
        if (kind === CALENDAR_KIND_MAIL_TODO) {
          const raw = info.event.extendedProps.accountColor as string | undefined
          const bg = accountColorToCssBackground(raw)
          if (bg) {
            info.el.style.backgroundColor = bg
            info.el.style.borderColor = 'transparent'
            info.el.style.color = '#fafafa'
          } else {
            info.el.style.borderLeft = '4px solid hsl(var(--secondary))'
          }
          const m = info.event.extendedProps.mailMessage as MailListItem | undefined
          if (m) {
            attachCalendarOverlayContextMenu(
              info.el,
              { kind: 'mail_todo', mail: m },
              {
                setError,
                setCalendarFolderContextMenu,
                setEventContextMenu,
                overlayContextMenuOptionsRef
              }
            )
            const mailEl = info.el as HTMLElement & {
              _calCtxMenu?: (ev: MouseEvent) => void
              _calMailDblclick?: (ev: MouseEvent) => void
            }
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

        if (kind === CALENDAR_KIND_USER_NOTE) {
          info.el.classList.add('fc-user-note-event')
          info.el.style.borderLeft = '4px solid #a855f7'
          return
        }
        const calEv = info.event.extendedProps.calendarEvent as
          | CalendarEventView
          | undefined
        const displayHex =
          (info.event.extendedProps.displayColorHex as string | null | undefined) ??
          calEv?.displayColorHex
        const tw =
          (info.event.extendedProps.accountColor as string | undefined) ??
          calEv?.accountColorClass
        applyCalendarEventDomColors(info.el as HTMLElement, {
          displayColorHex: displayHex ?? null,
          accountTailwindBgClass: tw ?? null
        })
        if (!calEv) return
        attachGraphCalendarEventContextMenu(info.el, calEv, {
          t,
          calendarCollatorLocale,
          isDeCalendar,
          clipboardDfLocale,
          calendarLinkedAccounts,
          reloadVisibleRange,
          setError,
          setEventDialog,
          setMailNoteTarget,
          setEventNoteTarget,
          deleteGraphCalendarEvent,
          setCalendarFolderContextMenu,
          setEventContextMenu
        })
      }}
      eventWillUnmount={(info): void => {
        const kind = info.event.extendedProps.calendarKind as string | undefined
        if (kind === CALENDAR_KIND_CLOUD_TASK) {
          const key =
            typeof info.event.extendedProps.taskKey === 'string'
              ? info.event.extendedProps.taskKey
              : ''
          if (key) cloudTaskElByKeyRef.current.delete(key)
        }
        const el = info.el as HTMLElement & { _calMailDblclick?: (ev: MouseEvent) => void }
        detachCalendarFcContextMenu(info.el)
        if (el._calMailDblclick) {
          info.el.removeEventListener('dblclick', el._calMailDblclick)
          delete el._calMailDblclick
        }
      }}
      datesSet={(arg): void => {
        window.requestAnimationFrame(() => {
          syncFullCalendarWidth(calendarDropRootRef.current, arg.view.calendar)
        })
        const datesKey = multiMonthDatesSetKey(arg.view.type, arg.start, arg.end)
        const rangeUnchanged = datesKey === lastDatesSetKeyRef.current
        lastDatesSetKeyRef.current = datesKey
        lastRangeRef.current = { start: arg.start, end: arg.end }

        if (arg.view.type !== activeViewIdRef.current) {
          setActiveViewId(arg.view.type)
          persistCalendarActiveFcView(arg.view.type)
        }
        setVisibleStart(arg.view.currentStart)
        setMiniMonth(startOfMonth(arg.view.currentStart))
        setRangeTitle(arg.view.title)

        if (rangeUnchanged) return

        if (datesSetLoadTimerRef.current) clearTimeout(datesSetLoadTimerRef.current)
        const isOverview = isMultiMonthFcView(arg.view.type)
        const runLoads = (): void => {
          void loadRange(arg.start, arg.end, { silent: true })
          if (
            mailTodoOverlayRef.current &&
            !shouldSkipHeavyCalendarLayersForMultiMonth(arg.view.type)
          ) {
            void loadMailTodosForRange(arg.start, arg.end)
          }
          if (
            cloudTaskOverlayRef.current &&
            !shouldSkipHeavyCalendarLayersForMultiMonth(arg.view.type)
          ) {
            void loadCloudTasksForRange(arg.start, arg.end)
          }
          if (
            userNoteOverlayRef.current &&
            !shouldSkipHeavyCalendarLayersForMultiMonth(arg.view.type)
          ) {
            void loadUserNotesForRange(arg.start, arg.end)
          }
        }
        if (isOverview) {
          datesSetLoadTimerRef.current = setTimeout(runLoads, 100)
        } else {
          void loadRange(arg.start, arg.end, {
            silent: eventsRef.current.length > 0
          })
          if (mailTodoOverlayRef.current) void loadMailTodosForRange(arg.start, arg.end)
          if (cloudTaskOverlayRef.current) void loadCloudTasksForRange(arg.start, arg.end)
          if (userNoteOverlayRef.current) void loadUserNotesForRange(arg.start, arg.end)
        }
      }}
      eventClassNames={(arg): string[] => {
        const classes: string[] = []
        if (previewFocusStableKey) {
          const focusKey = previewStableKeyFromFcEvent(arg.event)
          if (focusKey && focusKey === previewFocusStableKey) {
            classes.push('fc-event--preview-focus')
          }
        }
        const kind = arg.event.extendedProps.calendarKind as string | undefined
        if (kind) return classes
        const ev = arg.event.extendedProps.calendarEvent as CalendarEventView | undefined
        if (!ev) return classes
        if (ev.showAs === 'free') classes.push('fc-cal-event--free')
        if (
          ev.sensitivity === 'private' ||
          ev.sensitivity === 'personal' ||
          ev.sensitivity === 'confidential'
        ) {
          classes.push('fc-cal-event--private')
        }
        const key = graphEventKey(ev)
        if (key && graphEventSelection.isSelected(key)) {
          classes.push('ring-2', 'ring-primary/40', 'ring-inset', 'rounded')
        }
        return classes
      }}
      eventClick={(info): boolean => {
        info.jsEvent.preventDefault()
        if (info.event.id === QUICK_CREATE_PLACEHOLDER_EVENT_ID) return false
        const kind = info.event.extendedProps.calendarKind as string | undefined
        if (kind === CALENDAR_KIND_CLOUD_TASK) {
          const task = info.event.extendedProps.cloudTask as CloudTaskListItem | undefined
          if (task) {
            setError(null)
            setPreviewCalendarEvent(null)
            clearSelectedMessage()
            setPreviewCloudTaskPlannedFromTimeline(null)
            setPreviewCloudTask(task)
            persistRightPreviewOpen(true)
            setRightPreviewOpen(true)
          }
          return false
        }
        if (kind === CALENDAR_KIND_MAIL_TODO) {
          const m = info.event.extendedProps.mailMessage as MailListItem | undefined
          if (m) {
            setError(null)
            setPreviewCalendarEvent(null)
            setPreviewCloudTask(null)
            setPreviewCloudTaskPlannedFromTimeline(null)
            void selectMessageWithThreadPreview(m.id)
            persistRightPreviewOpen(true)
            setRightPreviewOpen(true)
          }
          return false
        }
        if (kind === CALENDAR_KIND_USER_NOTE) {
          const note = info.event.extendedProps.userNote as UserNoteListItem | undefined
          if (note) {
            useNotesPendingFocusStore.getState().setPendingNoteId(note.id)
            useAppModeStore.getState().setMode('notes')
          }
          return false
        }
        const ev = info.event.extendedProps.calendarEvent as CalendarEventView | undefined
        if (ev) {
          graphEventSelection.handlePointerDown(graphEventKey(ev), {
            shiftKey: info.jsEvent.shiftKey,
            ctrlKey: info.jsEvent.ctrlKey,
            metaKey: info.jsEvent.metaKey
          })
          setError(null)
          clearSelectedMessage()
          setPreviewCloudTask(null)
          setPreviewCloudTaskPlannedFromTimeline(null)
          setPreviewCalendarEvent(ev)
          persistRightPreviewOpen(true)
          setRightPreviewOpen(true)
        }
        return false
      }}
    />
  )
}, calendarShellFullCalendarPropsAreEqual)
