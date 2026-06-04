import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { formatISO, startOfDay } from 'date-fns'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import luxonPlugin from '@fullcalendar/luxon'
import deLocale from '@fullcalendar/core/locales/de'
import enGbLocale from '@fullcalendar/core/locales/en-gb'
import type { DateSelectArg, DatesSetArg, EventClickArg } from '@fullcalendar/core'
import type { CalendarEventView, TaskListRow } from '@shared/types'
import {
  CalendarCreateQuickPopover,
  type CalendarCreateQuickDraft
} from '@/app/calendar/CalendarCreateQuickPopover'
import { CalendarEventDialog } from '@/app/calendar/CalendarEventDialog'
import {
  QUICK_CREATE_PLACEHOLDER_EVENT_ID,
  quickCreateRangeToFcPlaceholder
} from '@/app/calendar/calendar-quick-create-placeholder'
import { deduplicateCalendarEventsByGraphEventId } from '@/app/calendar/calendar-graph-events'
import type { CalendarCreateRange } from '@/app/tasks/tasks-calendar-create-range'
import { useAccountsStore } from '@/stores/accounts'
import { useAppModeStore } from '@/stores/app-mode'
import { useCalendarPendingFocusStore } from '@/stores/calendar-pending-focus'
import { buildCalendarIncludeCalendars } from '@/lib/build-calendar-include-calendars'
import { useCalendarFcEventContent } from '@/app/calendar/use-calendar-fc-event-content'
import { useCalendarSettingsPrefs } from '@/lib/use-calendar-settings-prefs'
import { timeGridFcSnapOptions } from '@/app/calendar/calendar-shell-storage'
import {
  buildCalendarDisplayHexByKey,
  buildDefaultGraphCalendarIdByAccount
} from '@/lib/calendar-event-display-hex'
import { graphCalendarEventsToFcInputs } from '@/lib/graph-calendar-events-to-fc'
import { applyCalendarEventDomColors } from '@/lib/calendar-event-chip-style'
import { focusContextPreviewCalendarEvent } from '@/lib/focus-context-preview'
import { useCalendarListByAccount } from '@/lib/use-calendar-list-by-account'
import '@/app/calendar/notion-calendar.css'

export type LayoutStudioGraphCalendarFcView = 'timeGridWeek' | 'dayGridMonth'

export function LayoutStudioGraphCalendar({
  fcView
}: {
  fcView: LayoutStudioGraphCalendarFcView
}): JSX.Element {
  const { t, i18n } = useTranslation()
  const calSettings = useCalendarSettingsPrefs()
  const calendarFcEventContentRender = useCalendarFcEventContent()
  const calendarRef = useRef<FullCalendar | null>(null)
  const calendarHostRef = useRef<HTMLDivElement | null>(null)
  const lastRangeRef = useRef<{ start: Date; end: Date }>({
    start: new Date(),
    end: new Date()
  })

  const accounts = useAccountsStore((s) => s.accounts)
  const calendarTimeZoneConfig = useAccountsStore((s) => s.config?.calendarTimeZone ?? null)
  const fcTimeZone = useMemo(
    () => (calendarTimeZoneConfig?.trim() ? calendarTimeZoneConfig.trim() : 'local'),
    [calendarTimeZoneConfig]
  )

  const calendarLinkedAccounts = useMemo(
    () => accounts.filter((a) => a.provider === 'microsoft' || a.provider === 'google'),
    [accounts]
  )
  const taskAccounts = calendarLinkedAccounts
  const calendarsByAccount = useCalendarListByAccount(calendarLinkedAccounts)
  const calendarLinkedAccountIds = useMemo(
    () => calendarLinkedAccounts.map((a) => a.id),
    [calendarLinkedAccounts]
  )
  const defaultGraphCalendarIdByAccount = useMemo(
    () => buildDefaultGraphCalendarIdByAccount(calendarLinkedAccountIds, calendarsByAccount),
    [calendarLinkedAccountIds, calendarsByAccount]
  )
  const calendarDisplayHexByKey = useMemo(
    () => buildCalendarDisplayHexByKey(calendarLinkedAccountIds, calendarsByAccount),
    [calendarLinkedAccountIds, calendarsByAccount]
  )

  const [events, setEvents] = useState<CalendarEventView[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [quickCreate, setQuickCreate] = useState<{
    anchor: { x: number; y: number }
    range: CalendarCreateRange
  } | null>(null)
  const [eventDialog, setEventDialog] = useState<{
    mode: 'create' | 'edit'
    range: CalendarCreateRange | null
    draft?: CalendarCreateQuickDraft
    event?: CalendarEventView
  } | null>(null)

  const dismissQuickCreate = useCallback((): void => {
    calendarRef.current?.getApi()?.unselect()
    setQuickCreate(null)
  }, [])

  const handleQuickCreateRangeChange = useCallback((range: CalendarCreateRange): void => {
    setQuickCreate((prev) => (prev ? { ...prev, range } : null))
  }, [])

  const loadTaskListsForAccount = useCallback(
    async (accountId: string): Promise<TaskListRow[]> =>
      window.mailClient.tasks.listLists({ accountId }),
    []
  )

  const loadRange = useCallback(
    async (start: Date, end: Date, opts?: { silent?: boolean }): Promise<void> => {
      lastRangeRef.current = { start, end }
      if (calendarLinkedAccounts.length === 0) {
        setEvents([])
        setError(null)
        return
      }
      const silent = opts?.silent === true
      if (!silent) setLoading(true)
      setError(null)
      try {
        const includeCalendars = await buildCalendarIncludeCalendars(
          calendarLinkedAccounts,
          calendarsByAccount
        )
        const list = await window.mailClient.calendar.listEvents({
          startIso: start.toISOString(),
          endIso: end.toISOString(),
          focusCalendar: null,
          includeCalendars
        })
        setEvents(deduplicateCalendarEventsByGraphEventId(list))
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
        if (!silent) setEvents([])
      } finally {
        if (!silent) setLoading(false)
      }
    },
    [calendarLinkedAccounts, calendarsByAccount]
  )

  const reloadVisibleRange = useCallback(
    (opts?: { silent?: boolean }): void => {
      const silent = opts?.silent ?? events.length > 0
      const api = calendarRef.current?.getApi()
      if (api) {
        const { activeStart, activeEnd } = api.view
        void loadRange(activeStart, activeEnd, { silent })
        return
      }
      const { start, end } = lastRangeRef.current
      void loadRange(start, end, { silent })
    },
    [loadRange, events.length]
  )

  useEffect(() => {
    const off = window.mailClient.events.onCalendarChanged(() => {
      reloadVisibleRange({ silent: true })
    })
    return off
  }, [reloadVisibleRange])

  useEffect(() => {
    const host = calendarHostRef.current
    if (!host || typeof ResizeObserver === 'undefined') return

    const api = (): ReturnType<NonNullable<FullCalendar['getApi']>> | null =>
      calendarRef.current?.getApi?.() ?? null

    let raf = 0
    const ro = new ResizeObserver(() => {
      if (raf) cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        api()?.updateSize()
      })
    })
    ro.observe(host)
    raf = requestAnimationFrame(() => api()?.updateSize())
    return (): void => {
      if (raf) cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [])

  const graphFcEvents = useMemo(
    () =>
      graphCalendarEventsToFcInputs(
        events,
        defaultGraphCalendarIdByAccount,
        calendarDisplayHexByKey
      ),
    [events, defaultGraphCalendarIdByAccount, calendarDisplayHexByKey]
  )

  const quickCreatePlaceholderEvents = useMemo(() => {
    if (!quickCreate) return []
    return [quickCreateRangeToFcPlaceholder(quickCreate.range)]
  }, [quickCreate])

  const fcEvents = useMemo(
    () => [...graphFcEvents, ...quickCreatePlaceholderEvents],
    [graphFcEvents, quickCreatePlaceholderEvents]
  )

  const canInteract = calendarLinkedAccounts.length > 0 || taskAccounts.length > 0
  const isWeekView = fcView === 'timeGridWeek'

  const timeGridFcSlotOpts = useMemo(
    () => timeGridFcSnapOptions(calSettings.defaultTimeGridSlotMinutes),
    [calSettings.defaultTimeGridSlotMinutes]
  )

  const fcLocale = i18n.language.startsWith('de') ? deLocale : enGbLocale
  const setAppMode = useAppModeStore((s) => s.setMode)

  const onDatesSet = useCallback(
    (arg: DatesSetArg): void => {
      void loadRange(arg.start, arg.end, { silent: events.length > 0 })
    },
    [loadRange, events.length]
  )

  const onSelect = useCallback(
    (sel: DateSelectArg): void => {
      if (!canInteract) return
      const js = sel.jsEvent as MouseEvent | undefined
      setQuickCreate({
        anchor: {
          x: js?.clientX ?? window.innerWidth / 2,
          y: js?.clientY ?? window.innerHeight / 2
        },
        range: { start: sel.start, end: sel.end, allDay: sel.allDay }
      })
      queueMicrotask(() => calendarRef.current?.getApi()?.unselect())
    },
    [canInteract]
  )

  const onEventClick = useCallback((info: EventClickArg): void => {
    if (info.event.id === QUICK_CREATE_PLACEHOLDER_EVENT_ID) return
    info.jsEvent.preventDefault()
    const cal = info.event.extendedProps?.calendarEvent as CalendarEventView | undefined
    if (!cal) return
    if (focusContextPreviewCalendarEvent(cal)) return
    setEventDialog({ mode: 'edit', range: null, event: cal })
  }, [])

  const onSaved = useCallback(
    (created?: CalendarEventView): void => {
      setEventDialog(null)
      if (created) {
        setEvents((prev) =>
          deduplicateCalendarEventsByGraphEventId([
            ...prev.filter((e) => e.id !== created.id),
            created
          ])
        )
      }
      reloadVisibleRange({ silent: true })
    },
    [reloadVisibleRange]
  )

  const dayGridMonthView = useMemo(
    () => ({
      dayGridMonth: {
        moreLinkClick: 'popover' as const
      }
    }),
    []
  )

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      {error ? (
        <p className="shrink-0 px-2 py-1 text-2xs leading-snug text-destructive">{error}</p>
      ) : null}
      <div className="relative min-h-0 flex-1 overflow-hidden p-0.5">
        {loading && events.length === 0 ? (
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-center gap-2 bg-background/70 py-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {t('mail.inboxCal.loading')}
          </div>
        ) : null}
        <div
          ref={calendarHostRef}
          className="calendar-notion-shell h-full min-h-0 flex-1"
        >
          <FullCalendar
            key={`${fcView}-${i18n.language}-${calSettings.defaultTimeGridSlotMinutes}-${calSettings.slotMinTime}-${calSettings.slotMaxTime}-${calSettings.scrollTime}-${calSettings.weekStartsOn}-${calSettings.hideWeekends}`}
            ref={(inst): void => {
              calendarRef.current = inst
            }}
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, luxonPlugin]}
            locale={fcLocale}
            height="100%"
            timeZone={fcTimeZone}
            headerToolbar={{
              left: 'prev,next today',
              center: 'title',
              right: ''
            }}
            initialView={fcView}
            weekends={!calSettings.hideWeekends}
            firstDay={calSettings.weekStartsOn}
            slotMinTime={isWeekView ? calSettings.slotMinTime : undefined}
            slotMaxTime={isWeekView ? calSettings.slotMaxTime : undefined}
            scrollTime={isWeekView ? calSettings.scrollTime : undefined}
            slotDuration={isWeekView ? timeGridFcSlotOpts.slotDuration : undefined}
            snapDuration={isWeekView ? timeGridFcSlotOpts.snapDuration : undefined}
            slotLabelInterval={isWeekView ? '01:00:00' : undefined}
            nowIndicator={isWeekView}
            allDaySlot={isWeekView}
            dayMaxEvents
            editable={false}
            selectable={canInteract}
            selectMirror={false}
            selectLongPressDelay={380}
            selectAllow={(): boolean => canInteract}
            select={onSelect}
            datesSet={onDatesSet}
            events={fcEvents}
            views={dayGridMonthView}
            eventContent={calendarFcEventContentRender}
            eventDidMount={(info): void => {
              if (
                info.event.id === QUICK_CREATE_PLACEHOLDER_EVENT_ID ||
                info.el.classList.contains('fc-event-mirror')
              ) {
                return
              }
              const calEv = info.event.extendedProps.calendarEvent as CalendarEventView | undefined
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
            }}
            eventClick={onEventClick}
            dateClick={
              fcView === 'dayGridMonth'
                ? (info): void => {
                    useCalendarPendingFocusStore
                      .getState()
                      .queueGotoDate(formatISO(startOfDay(info.date)))
                    setAppMode('calendar')
                  }
                : undefined
            }
          />
        </div>
      </div>

      {quickCreate
        ? createPortal(
            <CalendarCreateQuickPopover
              anchor={quickCreate.anchor}
              range={quickCreate.range}
              calendarAccounts={calendarLinkedAccounts}
              taskAccounts={taskAccounts}
              defaultAccountId={calendarLinkedAccounts[0]?.id ?? taskAccounts[0]?.id}
              loadListsForAccount={loadTaskListsForAccount}
              onRangeChange={handleQuickCreateRangeChange}
              onClose={dismissQuickCreate}
              onSaved={onSaved}
              onOpenDetails={(draft): void => {
                dismissQuickCreate()
                setEventDialog({ mode: 'create', range: draft.range, draft })
              }}
            />,
            document.body
          )
        : null}

      <CalendarEventDialog
        open={eventDialog != null}
        mode={eventDialog?.mode ?? 'create'}
        accounts={calendarLinkedAccounts}
        defaultAccountId={
          eventDialog?.draft?.accountId ??
          eventDialog?.event?.accountId ??
          calendarLinkedAccounts[0]?.id
        }
        initialRange={eventDialog?.range ?? undefined}
        initialEvent={eventDialog?.mode === 'edit' ? (eventDialog.event ?? null) : null}
        createPrefill={
          eventDialog?.draft
            ? { subject: eventDialog.draft.subject, location: '' }
            : undefined
        }
        initialCreateKind={eventDialog?.draft?.createKind}
        initialGraphCalendarId={eventDialog?.draft?.graphCalendarId || undefined}
        initialTaskListId={eventDialog?.draft?.taskListId || undefined}
        taskAccounts={taskAccounts}
        loadListsForAccount={loadTaskListsForAccount}
        onClose={(): void => setEventDialog(null)}
        onSaved={onSaved}
      />
    </div>
  )
}
