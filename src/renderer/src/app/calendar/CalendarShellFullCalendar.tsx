import FullCalendar from '@fullcalendar/react'
import type { EventChangeArg, EventContentArg, EventInput, EventSourceInput, LocaleInput } from '@fullcalendar/core'
import type { RefObject, MutableRefObject, Dispatch, SetStateAction } from 'react'
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
import { accountColorToCssBackground } from '@/lib/avatar-color'
import {
  buildMailCategorySubmenuItems,
  buildMailContextItems,
  type MailContextHandlers
} from '@/lib/mail-context-menu'
import { accountSupportsCloudTasks } from '@/lib/cloud-task-accounts'
import {
  buildCalendarEventCategorySubmenuItems,
  buildCalendarEventTransferSubmenuItems,
  buildCalendarEventContextItems,
  formatCalendarEventClipboardText
} from '@/lib/calendar-event-context-menu'
import {
  pickAndSendCalendarEventToNotion,
  runNotionSendWithErrorHandling,
  sendCalendarEventAsNewNotionPage
} from '@/lib/notion-ui'
import { deleteCalendarEventIpc } from '@/lib/calendar-ipc'
import { applyCalendarEventDomColors } from '@/lib/calendar-event-chip-style'
import { openExternalUrl } from '@/lib/open-external'
import {
  mailReadingPopoutOptsFromClick,
  openMailReadingPopout
} from '@/lib/open-mail-reading-popout'
import { showAppConfirm } from '@/stores/app-dialog'
import { useMailStore } from '@/stores/mail'
import { useNotesPendingFocusStore } from '@/stores/notes-pending-focus'
import { useAppModeStore } from '@/stores/app-mode'
import type { CloudTaskListItem } from '@/app/tasks/tasks-types'
import { cloudTaskStableKey } from '@shared/work-item-keys'
import type { Locale } from 'date-fns'
import type { ContextMenuItem } from '@/components/ContextMenu'
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
  previewCloudTask: CloudTaskListItem | null
  accounts: ConnectedAccount[]
  mailContextHandlersRef: MutableRefObject<MailContextHandlers>
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
  setRightPreviewOpen: Dispatch<SetStateAction<boolean>>
}

import type { WorkItemPlannedSchedule } from '@shared/work-item'

export function CalendarShellFullCalendar(props: CalendarShellFullCalendarProps): JSX.Element {
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
    previewCloudTask,
    accounts,
    mailContextHandlersRef,
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
    setRightPreviewOpen
  } = props

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
      views={{
        timeGrid: timeGridFcSlotOpts,
        ...multiDayViews,
        ...dayGridMonthView,
        ...multiMonthViews
      }}
      initialView={readCalendarActiveFcView()}
      slotMinTime={calSettings.slotMinTime}
      slotMaxTime={calSettings.slotMaxTime}
      scrollTime={calSettings.scrollTime}
      slotDuration={timeGridFcSlotOpts.slotDuration}
      snapDuration={timeGridFcSlotOpts.snapDuration}
      slotLabelInterval="01:00:00"
      nowIndicator
      editable={
        !isMultiMonthActive &&
        (calendarLinkedAccounts.length > 0 ||
          mailTodoOverlay ||
          cloudTaskOverlay ||
          userNoteOverlay)
      }
      eventResizableFromStart={
        !isMultiMonthActive &&
        (calendarLinkedAccounts.length > 0 ||
          mailTodoOverlay ||
          cloudTaskOverlay ||
          userNoteOverlay)
      }
      eventDrop={(info): void => {
        void handleGraphEventChange(info)
      }}
      eventResize={(info): void => {
        void handleGraphEventChange(info)
      }}
      eventAllow={(_span, movingEvent): boolean => {
        if (!movingEvent) return true
        const kind = movingEvent.extendedProps?.calendarKind as string | undefined
        if (kind === CALENDAR_KIND_MAIL_TODO) return true
        if (kind === CALENDAR_KIND_CLOUD_TASK) return true
        if (kind === CALENDAR_KIND_USER_NOTE) return true
        const calEv = movingEvent.extendedProps?.calendarEvent as
          | CalendarEventView
          | undefined
        if (!calEv?.graphEventId || calEv.calendarCanEdit === false) return false
        if (calEv.source === 'microsoft' || calEv.source === 'google') return true
        return false
      }}
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
      eventsSet={(): void => {
        if (graphCalendarReconcilingRef.current) return
        purgeDuplicateGraphCalendarEventsOnApi(calendarRef.current?.getApi())
      }}
      eventContent={calendarFcEventContentRender}
      eventDidMount={(info): void => {
        if (
          info.event.id === QUICK_CREATE_PLACEHOLDER_EVENT_ID ||
          info.el.classList.contains('fc-event-mirror') ||
          info.event.classNames.includes('fc-scheduling-slot-placeholder')
        ) {
          return
        }
        if (isMultiMonthFcView(info.view.type)) {
          applyMultiMonthEventDotMount(info)
          return
        }
        const kind = info.event.extendedProps.calendarKind as string | undefined
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
          const previewKey = previewCloudTask
            ? cloudTaskStableKey(
                previewCloudTask.accountId,
                previewCloudTask.listId,
                previewCloudTask.id
              )
            : null
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
            const onMailCtx = (e: MouseEvent): void => {
              e.preventDefault()
              e.stopPropagation()
              setError(null)
              setCalendarFolderContextMenu(null)
              void (async (): Promise<void> => {
                const anchor = { x: e.clientX, y: e.clientY }
                const ui = { snoozeAnchor: anchor }
                const cat = await buildMailCategorySubmenuItems(m, ui, () =>
                  useMailStore.getState().refreshNow()
                )
                const mailAcc = accounts.find((a) => a.id === m.accountId)
                const items = buildMailContextItems(m, mailContextHandlersRef.current, {
                  ...ui,
                  categorySubmenu: cat.length > 0 ? cat : undefined,
                  allowsCloudTaskCreate: accountSupportsCloudTasks(mailAcc),
                  t
                })
                setEventContextMenu({ x: anchor.x, y: anchor.y, items })
              })()
            }
            info.el.addEventListener('contextmenu', onMailCtx)
            const mailEl = info.el as HTMLElement & {
              _calCtxMenu?: (ev: MouseEvent) => void
              _calMailDblclick?: (ev: MouseEvent) => void
            }
            mailEl._calCtxMenu = onMailCtx
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
        const onCtx = (e: MouseEvent): void => {
          e.preventDefault()
          e.stopPropagation()
          setError(null)
          void (async (): Promise<void> => {
            const cat = await buildCalendarEventCategorySubmenuItems(
              calEv,
              reloadVisibleRange,
              t,
              calendarCollatorLocale
            )
            const copyTo = await buildCalendarEventTransferSubmenuItems(
              calEv,
              'copy',
              calendarLinkedAccounts,
              reloadVisibleRange,
              t,
              calendarCollatorLocale
            )
            const moveTo = await buildCalendarEventTransferSubmenuItems(
              calEv,
              'move',
              calendarLinkedAccounts,
              reloadVisibleRange,
              t,
              calendarCollatorLocale
            )
            const hasGraphEvent = Boolean(calEv.graphEventId?.trim())
            const canMutateEvent =
              calEv.calendarCanEdit !== false &&
              hasGraphEvent &&
              (calEv.source === 'microsoft' || calEv.source === 'google')
            const canCopyToOtherCalendar =
              hasGraphEvent &&
              copyTo.length > 0 &&
              (calEv.source === 'microsoft' || calEv.source === 'google')
            const canMoveToOtherCalendar =
              canMutateEvent && moveTo.length > 0
            const items = buildCalendarEventContextItems(
              calEv,
              canMutateEvent,
              canCopyToOtherCalendar,
              canMoveToOtherCalendar,
              calendarLinkedAccounts.length > 0,
              {
                onEdit: (): void => {
                  setError(null)
                  setEventDialog({ mode: 'edit', event: calEv })
                },
                onDuplicate: (): void => {
                  const titleTrim = calEv.title?.trim()
                  setError(null)
                  setEventDialog({
                    mode: 'create',
                    range: {
                      start: new Date(calEv.startIso),
                      end: new Date(calEv.endIso),
                      allDay: calEv.isAllDay
                    },
                    createPrefill: {
                      subject: titleTrim
                        ? `${titleTrim}${t('calendar.context.duplicateSuffix')}`
                        : t('calendar.context.duplicateEmptyTitle'),
                      location: calEv.location ?? ''
                    },
                    createAccountId: calEv.accountId
                  })
                },
                onOpenNote: (): void => {
                  const eventRemoteId = calEv.graphEventId?.trim()
                  if (!eventRemoteId) return
                  setError(null)
                  setMailNoteTarget(null)
                  setEventNoteTarget({
                    kind: 'calendar',
                    accountId: calEv.accountId,
                    calendarSource: calEv.source,
                    calendarRemoteId: calEv.graphCalendarId?.trim() || 'default',
                    eventRemoteId,
                    title: calEv.title,
                    eventTitleSnapshot: calEv.title,
                    eventStartIsoSnapshot: calEv.startIso
                  })
                },
                onSendToNotion: (): void => {
                  void runNotionSendWithErrorHandling(() =>
                    pickAndSendCalendarEventToNotion(
                      calEv,
                      isDeCalendar ? 'de' : 'en'
                    )
                  )
                },
                onSendToNotionAsNewPage: (): void => {
                  void runNotionSendWithErrorHandling(() =>
                    sendCalendarEventAsNewNotionPage(
                      calEv,
                      isDeCalendar ? 'de' : 'en'
                    )
                  )
                },
                onCopyDetails: (): void => {
                  const text = formatCalendarEventClipboardText(
                    calEv,
                    t,
                    clipboardDfLocale,
                    isDeCalendar
                  )
                  if (!navigator.clipboard?.writeText) {
                    setError(t('calendar.errors.clipboardUnsupported'))
                    return
                  }
                  void navigator.clipboard.writeText(text).catch(() => {
                    setError(t('calendar.errors.clipboardWriteFailed'))
                  })
                },
                onCopyWebLink: (): void => {
                  const u = calEv.webLink?.trim()
                  if (!u) return
                  if (!navigator.clipboard?.writeText) {
                    setError(t('calendar.errors.clipboardUnsupported'))
                    return
                  }
                  void navigator.clipboard.writeText(u).catch(() => {
                    setError(t('calendar.errors.clipboardWriteFailed'))
                  })
                },
                onCopyJoinUrl: (): void => {
                  const u = calEv.joinUrl?.trim()
                  if (!u) return
                  if (!navigator.clipboard?.writeText) {
                    setError(t('calendar.errors.clipboardUnsupported'))
                    return
                  }
                  void navigator.clipboard.writeText(u).catch(() => {
                    setError(t('calendar.errors.clipboardWriteFailed'))
                  })
                },
                onOpenWeb: (): void => {
                  const u = calEv.webLink?.trim()
                  if (u) {
                    void openExternalUrl(u).catch((err) => {
                      setError(err instanceof Error ? err.message : String(err))
                    })
                  }
                },
                onOpenTeams: (): void => {
                  const u = calEv.joinUrl?.trim()
                  if (u) {
                    void openExternalUrl(u).catch((err) => {
                      setError(err instanceof Error ? err.message : String(err))
                    })
                  }
                },
                onDelete: (): void => {
                  const gid = calEv.graphEventId
                  if (!gid) return
                  void (async (): Promise<void> => {
                    const ok = await showAppConfirm(
                      t('calendar.confirm.deleteEventBody'),
                      {
                        title: t('calendar.confirm.deleteEventTitle'),
                        variant: 'danger',
                        confirmLabel: t('calendar.confirm.deleteEventConfirm')
                      }
                    )
                    if (!ok) return
                    try {
                      setError(null)
                      await deleteCalendarEventIpc({
                        accountId: calEv.accountId,
                        graphEventId: gid,
                        graphCalendarId: calEv.graphCalendarId ?? null
                      })
                      reloadVisibleRange()
                    } catch (err) {
                      setError(err instanceof Error ? err.message : String(err))
                    }
                  })()
                }
              },
              t,
              {
                categorySubmenu: cat.length > 0 ? cat : undefined,
                copyToSubmenu: copyTo.length > 0 ? copyTo : undefined,
                moveToSubmenu: moveTo.length > 0 ? moveTo : undefined
              }
            )
            setCalendarFolderContextMenu(null)
            setEventContextMenu({ x: e.clientX, y: e.clientY, items })
          })()
        }
        info.el.addEventListener('contextmenu', onCtx)
        const el = info.el as HTMLElement & { _calCtxMenu?: (ev: MouseEvent) => void }
        el._calCtxMenu = onCtx
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
        const el = info.el as HTMLElement & {
          _calCtxMenu?: (ev: MouseEvent) => void
          _calMailDblclick?: (ev: MouseEvent) => void
        }
        if (el._calCtxMenu) {
          info.el.removeEventListener('contextmenu', el._calCtxMenu)
          delete el._calCtxMenu
        }
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
        const kind = arg.event.extendedProps.calendarKind as string | undefined
        if (kind) return []
        const ev = arg.event.extendedProps.calendarEvent as CalendarEventView | undefined
        if (!ev) return []
        const key = graphEventKey(ev)
        if (!key || !graphEventSelection.isSelected(key)) return []
        return ['ring-2', 'ring-primary/40', 'ring-inset', 'rounded']
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
}
