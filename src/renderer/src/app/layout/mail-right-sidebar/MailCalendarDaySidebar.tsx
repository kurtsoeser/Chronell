import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Locale } from 'date-fns'
import {
  addDays,
  addMonths,
  format,
  isToday,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek
} from 'date-fns'
import { useDateFnsLocale } from '@/lib/date-fns-locale'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight, CalendarClock, Loader2 } from 'lucide-react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import luxonPlugin from '@fullcalendar/luxon'
import { useCalendarFcLocale } from '@/hooks/use-calendar-fc-locale'
import type { DateSelectArg, EventClickArg, EventInput } from '@fullcalendar/core'
import type { DateClickArg } from '@fullcalendar/interaction'
import type { CalendarEventView, MailListItem, TaskListRow } from '@shared/types'
import {
  CalendarCreateQuickPopover,
  type CalendarCreateQuickDraft
} from '@/app/calendar/CalendarCreateQuickPopover'
import { CalendarEventDialog } from '@/app/calendar/CalendarEventDialog'
import {
  QUICK_CREATE_PLACEHOLDER_EVENT_ID,
  quickCreateRangeToFcPlaceholder
} from '@/app/calendar/calendar-quick-create-placeholder'
import type { CalendarCreateRange } from '@/app/tasks/tasks-calendar-create-range'
import { useAccountsStore } from '@/stores/accounts'
import { useAppModeStore } from '@/stores/app-mode'
import { focusContextPreviewMailMessage, openCalendarEventInCustomViewOrModule } from '@/lib/focus-context-preview'
import { useInboxCalendarAgendaCacheStore } from '@/stores/inbox-calendar-agenda-cache'
import { buildCalendarIncludeCalendars } from '@/lib/build-calendar-include-calendars'
import {
  CALENDAR_KIND_MAIL_TODO,
  mailTodoItemsToFullCalendarEvents
} from '@/app/calendar/mail-todo-calendar'
import { useCalendarFcEventContent } from '@/app/calendar/use-calendar-fc-event-content'
import { useCalendarSettingsPrefs } from '@/lib/use-calendar-settings-prefs'
import { timeGridFcSnapOptions } from '@/app/calendar/calendar-shell-storage'
import { accountColorToCssBackground } from '@/lib/avatar-color'
import {
  buildCalendarDisplayHexByKey,
  buildDefaultGraphCalendarIdByAccount,
  resolveGraphEventDisplayHex
} from '@/lib/calendar-event-display-hex'
import { applyCalendarEventDomColors } from '@/lib/calendar-event-chip-style'
import { useCalendarListByAccount } from '@/lib/use-calendar-list-by-account'
import { useMailStore } from '@/stores/mail'
import { openScheduleMeetingFromMail } from '@/lib/mail-schedule-meeting-action'
import {
  readMailCalendarSidebarViewMode,
  writeMailCalendarSidebarViewMode,
  type MailCalendarSidebarViewMode
} from '@/app/layout/mail-right-sidebar/mail-right-sidebar-calendar-view-mode'
import { MailCalendarDayViewModeToggle } from '@/app/layout/mail-right-sidebar/MailCalendarDayViewModeToggle'
import { MailCalendarGoToTodayIconButton } from '@/app/layout/mail-right-sidebar/MailCalendarGoToTodayIconButton'
import '@/app/calendar/notion-calendar.css'

const K_DAY_ISO = 'mailclient.mailRightSidebar.dayIso'

type SidebarViewMode = MailCalendarSidebarViewMode

function readDay(): Date {
  try {
    const v = window.localStorage.getItem(K_DAY_ISO)
    if (v) {
      const d = parseISO(v)
      if (!Number.isNaN(d.getTime())) return startOfDay(d)
    }
  } catch {
    // ignore
  }
  return startOfDay(new Date())
}

function writeDay(d: Date): void {
  try {
    window.localStorage.setItem(K_DAY_ISO, format(d, 'yyyy-MM-dd'))
  } catch {
    // ignore
  }
}

function formatDayTitle(d: Date, locale: Locale): string {
  return format(d, 'PPPP', { locale })
}

function formatWeekTitle(weekStart: Date, weekEndExcl: Date, locale: Locale): string {
  const weekEnd = addDays(weekEndExcl, -1)
  const sameMonth = weekStart.getMonth() === weekEnd.getMonth()
  if (sameMonth) {
    return `${format(weekStart, 'd.', { locale })}–${format(weekEnd, 'd. MMM yyyy', { locale })}`
  }
  return `${format(weekStart, 'd. MMM', { locale })} – ${format(weekEnd, 'd. MMM yyyy', { locale })}`
}

function sidebarFcViewId(mode: SidebarViewMode): string {
  if (mode === 'week') return 'timeGridWeek'
  if (mode === 'month') return 'dayGridMonth'
  return 'timeGridDay'
}

export type MailCalendarDaySidebarProps = {
  viewMode?: SidebarViewMode
  onViewModeChange?: (mode: SidebarViewMode) => void
  onTodayHeaderStateChange?: (state: MailCalendarSidebarTodayHeaderState | null) => void
}

export type MailCalendarSidebarTodayHeaderState = {
  isViewingToday: boolean
  goToToday: () => void
}

export function MailCalendarDaySidebar({
  viewMode: viewModeProp,
  onViewModeChange,
  onTodayHeaderStateChange
}: MailCalendarDaySidebarProps = {}): JSX.Element {
  const { t, i18n } = useTranslation()
  const dfLocale = useDateFnsLocale()
  const calSettings = useCalendarSettingsPrefs()
  const calendarFcEventContentRender = useCalendarFcEventContent()
  const calendarRef = useRef<FullCalendar | null>(null)
  const calendarHostRef = useRef<HTMLDivElement | null>(null)

  const accounts = useAccountsStore((s) => s.accounts)
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
  const accountColorById = useMemo(() => {
    const out: Record<string, string> = {}
    for (const a of accounts) out[a.id] = a.color
    return out
  }, [accounts])

  const previewRangeEvents = useInboxCalendarAgendaCacheStore((s) => s.previewRangeEvents)
  const inFlight = useInboxCalendarAgendaCacheStore((s) => s.inFlight)
  const calError = useInboxCalendarAgendaCacheStore((s) => s.error)
  const loadAgendaFromCache = useInboxCalendarAgendaCacheStore((s) => s.loadAgenda)

  const setAppMode = useAppModeStore((s) => s.setMode)
  const selectedMessage = useMailStore((s) => s.selectedMessage)

  const [anchorDay, setAnchorDay] = useState(() => readDay())
  const [internalViewMode, setInternalViewMode] = useState<SidebarViewMode>(() =>
    readMailCalendarSidebarViewMode()
  )
  const isViewModeControlled = viewModeProp != null && onViewModeChange != null
  const viewMode = viewModeProp ?? internalViewMode
  useEffect(() => writeDay(anchorDay), [anchorDay])
  useEffect(() => {
    if (!isViewModeControlled) writeMailCalendarSidebarViewMode(internalViewMode)
  }, [internalViewMode, isViewModeControlled])
  useEffect(() => {
    if (isViewModeControlled && viewModeProp != null) {
      writeMailCalendarSidebarViewMode(viewModeProp)
    }
  }, [isViewModeControlled, viewModeProp])

  const setViewModePersisted = useCallback(
    (mode: SidebarViewMode): void => {
      if (onViewModeChange) onViewModeChange(mode)
      else setInternalViewMode(mode)
    },
    [onViewModeChange]
  )

  const rangeStart = useMemo(() => {
    if (viewMode === 'week') {
      return startOfWeek(anchorDay, { weekStartsOn: calSettings.weekStartsOn })
    }
    if (viewMode === 'month') return startOfMonth(anchorDay)
    return startOfDay(anchorDay)
  }, [anchorDay, viewMode, calSettings.weekStartsOn])

  const rangeEndExcl = useMemo(() => {
    if (viewMode === 'week') return addDays(rangeStart, 7)
    if (viewMode === 'month') return addMonths(rangeStart, 1)
    return addDays(rangeStart, 1)
  }, [rangeStart, viewMode])

  const isViewingToday = useMemo(() => {
    const today = startOfDay(new Date())
    if (viewMode === 'day') return isToday(rangeStart)
    if (viewMode === 'week') {
      const weekStart = startOfWeek(today, { weekStartsOn: calSettings.weekStartsOn })
      return weekStart.getTime() === rangeStart.getTime()
    }
    return startOfMonth(today).getTime() === rangeStart.getTime()
  }, [viewMode, rangeStart, calSettings.weekStartsOn])

  const headerTitle = useMemo(() => {
    if (viewMode === 'week') return formatWeekTitle(rangeStart, rangeEndExcl, dfLocale)
    if (viewMode === 'month') {
      return format(rangeStart, 'MMMM yyyy', { locale: dfLocale })
    }
    return formatDayTitle(rangeStart, dfLocale)
  }, [viewMode, rangeStart, rangeEndExcl, dfLocale])

  const shiftRange = useCallback(
    (delta: number): void => {
      setAnchorDay((d) => {
        if (viewMode === 'week') return addDays(d, delta * 7)
        if (viewMode === 'month') return addMonths(d, delta)
        return addDays(d, delta)
      })
    },
    [viewMode]
  )

  const goToToday = useCallback((): void => {
    setAnchorDay(startOfDay(new Date()))
  }, [])

  useEffect(() => {
    onTodayHeaderStateChange?.({ isViewingToday, goToToday })
  }, [isViewingToday, goToToday, onTodayHeaderStateChange])

  useEffect(() => {
    return (): void => {
      onTodayHeaderStateChange?.(null)
    }
  }, [onTodayHeaderStateChange])

  const isTimeGridView = viewMode === 'day' || viewMode === 'week'
  const fcViewId = sidebarFcViewId(viewMode)

  const [quickCreate, setQuickCreate] = useState<{
    anchor: { x: number; y: number }
    range: CalendarCreateRange
  } | null>(null)
  const [eventDialog, setEventDialog] = useState<{
    range: CalendarCreateRange
    draft: CalendarCreateQuickDraft
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

  const [mailTodosLoading, setMailTodosLoading] = useState(false)
  const [mailTodosErr, setMailTodosErr] = useState<string | null>(null)
  const [mailTodos, setMailTodos] = useState<MailListItem[]>([])

  useEffect(() => {
    void loadAgendaFromCache(calendarLinkedAccounts)
  }, [calendarLinkedAccounts, loadAgendaFromCache])

  const dayStart = rangeStart
  const dayEndExcl = rangeEndExcl

  useEffect(() => {
    let cancelled = false
    setMailTodosLoading(true)
    setMailTodosErr(null)
    void window.mailClient.mail
      .listTodoMessagesInRange({
        accountId: null,
        rangeStartIso: dayStart.toISOString(),
        rangeEndIso: dayEndExcl.toISOString(),
        limit: 250
      })
      .then((rows) => {
        if (cancelled) return
        setMailTodos(rows)
      })
      .catch((e) => {
        if (cancelled) return
        setMailTodos([])
        setMailTodosErr(e instanceof Error ? e.message : String(e))
      })
      .finally(() => {
        if (!cancelled) setMailTodosLoading(false)
      })
    return (): void => {
      cancelled = true
    }
  }, [dayStart, dayEndExcl])

  const openCalendarEvent = useCallback(
    (ev: CalendarEventView): void => {
      openCalendarEventInCustomViewOrModule(ev, setAppMode)
    },
    [setAppMode]
  )

  const ensureEventRangeInCache = useCallback(async (): Promise<void> => {
    if (calendarLinkedAccounts.length === 0) return
    try {
      const includeCalendars = await buildCalendarIncludeCalendars(calendarLinkedAccounts)
      await window.mailClient.calendar.listEvents({
        startIso: dayStart.toISOString(),
        endIso: dayEndExcl.toISOString(),
        focusCalendar: null,
        includeCalendars
      })
      await loadAgendaFromCache(calendarLinkedAccounts, { force: true })
    } catch {
      // ignore; UI shows existing cache + error state from store
    }
  }, [calendarLinkedAccounts, dayStart, dayEndExcl, loadAgendaFromCache])

  useEffect(() => {
    void ensureEventRangeInCache()
  }, [ensureEventRangeInCache])

  useEffect(() => {
    const api = calendarRef.current?.getApi()
    if (!api) return
    if (api.view.type !== fcViewId) {
      api.changeView(fcViewId, rangeStart)
      return
    }
    api.gotoDate(rangeStart)
  }, [fcViewId, rangeStart])

  useEffect(() => {
    const host = calendarHostRef.current
    if (!host) return
    if (typeof ResizeObserver === 'undefined') return

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
    // initial sync after mount (e.g. after split drag ended)
    raf = requestAnimationFrame(() => api()?.updateSize())
    return (): void => {
      if (raf) cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [])

  const graphFcEvents = useMemo((): EventInput[] => {
    const startMs = dayStart.getTime()
    const endMs = dayEndExcl.getTime()
    const out: EventInput[] = []
    for (const ev of previewRangeEvents) {
      const s = Date.parse(ev.startIso)
      const e = Date.parse(ev.endIso)
      if (!Number.isFinite(s) || !Number.isFinite(e)) continue
      if (s >= endMs || e <= startMs) continue
      const resolvedDisplayHex = resolveGraphEventDisplayHex(
        ev,
        defaultGraphCalendarIdByAccount,
        calendarDisplayHexByKey
      )
      out.push({
        id: ev.id,
        title: ev.title,
        start: ev.startIso,
        end: ev.endIso,
        allDay: ev.isAllDay,
        url: ev.joinUrl ?? ev.webLink ?? undefined,
        extendedProps: {
          accountColor: ev.accountColorClass,
          displayColorHex: resolvedDisplayHex,
          joinUrl: ev.joinUrl,
          calendarEvent: ev
        },
        editable: false
      })
    }
    return out
  }, [
    previewRangeEvents,
    dayStart,
    dayEndExcl,
    defaultGraphCalendarIdByAccount,
    calendarDisplayHexByKey
  ])

  const mailTodoFcEvents = useMemo(
    () => mailTodoItemsToFullCalendarEvents(mailTodos, accountColorById),
    [mailTodos, accountColorById]
  )

  const quickCreatePlaceholderEvents = useMemo((): EventInput[] => {
    if (!quickCreate) return []
    return [quickCreateRangeToFcPlaceholder(quickCreate.range)]
  }, [quickCreate])

  const fcEvents = useMemo(
    () => [...graphFcEvents, ...mailTodoFcEvents, ...quickCreatePlaceholderEvents],
    [graphFcEvents, mailTodoFcEvents, quickCreatePlaceholderEvents]
  )

  const canInteractInTimeGrid = calendarLinkedAccounts.length > 0 || taskAccounts.length > 0

  const reloadDayData = useCallback((created?: CalendarEventView): void => {
    if (created) {
      useInboxCalendarAgendaCacheStore.getState().upsertPreviewCalendarEvent(created)
      return
    }
    void ensureEventRangeInCache()
    void window.mailClient.mail
      .listTodoMessagesInRange({
        accountId: null,
        rangeStartIso: dayStart.toISOString(),
        rangeEndIso: dayEndExcl.toISOString(),
        limit: 250
      })
      .then(setMailTodos)
      .catch(() => {
        // keep existing list
      })
  }, [ensureEventRangeInCache, dayStart, dayEndExcl])

  const timeGridFcSlotOpts = useMemo(
    () => timeGridFcSnapOptions(calSettings.defaultTimeGridSlotMinutes),
    [calSettings.defaultTimeGridSlotMinutes]
  )

  const fcLocale = useCalendarFcLocale()

  const onSelect = useCallback(
    (sel: DateSelectArg): void => {
      if (!canInteractInTimeGrid) return
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
    [canInteractInTimeGrid]
  )

  const onEventClick = useCallback(
    (info: EventClickArg): void => {
      if (info.event.id === QUICK_CREATE_PLACEHOLDER_EVENT_ID) return
      info.jsEvent.preventDefault()
      const kind = info.event.extendedProps?.calendarKind as string | undefined
      if (kind === CALENDAR_KIND_MAIL_TODO) {
        const m = info.event.extendedProps?.mailMessage as MailListItem | undefined
        if (m) void focusContextPreviewMailMessage(m.id)
        return
      }
      const cal = info.event.extendedProps?.calendarEvent as CalendarEventView | undefined
      if (cal) openCalendarEvent(cal)
    },
    [openCalendarEvent]
  )

  const onMonthDateClick = useCallback((info: DateClickArg): void => {
    setAnchorDay(startOfDay(info.date))
    setViewModePersisted('day')
  }, [setViewModePersisted])

  const dayGridMonthView = useMemo(
    () => ({
      dayGridMonth: {
        moreLinkClick: 'popover' as const
      }
    }),
    []
  )

  const navPrevTitle =
    viewMode === 'week'
      ? t('calendar.eventDialog.dayColumnWeekPrev')
      : viewMode === 'month'
        ? t('mail.rightSidebar.dayPrevMonth')
        : t('mail.rightSidebar.dayPrev')

  const navNextTitle =
    viewMode === 'week'
      ? t('calendar.eventDialog.dayColumnWeekNext')
      : viewMode === 'month'
        ? t('mail.rightSidebar.dayNextMonth')
        : t('mail.rightSidebar.dayNext')

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-border px-3 py-2">
        {!isViewModeControlled ? (
          <div className="mb-2 flex items-center justify-between gap-2">
            <MailCalendarDayViewModeToggle viewMode={viewMode} onChange={setViewModePersisted} />
            <MailCalendarGoToTodayIconButton
              variant="compact"
              disabled={isViewingToday}
              onClick={goToToday}
            />
          </div>
        ) : null}
        <div className="grid grid-cols-[2rem_1fr_2rem] items-center gap-1">
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
            title={navPrevTitle}
            onClick={(): void => shiftRange(-1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0 text-center">
            <div className="truncate text-xs font-semibold text-foreground">{headerTitle}</div>
            <div className="text-[11px] text-muted-foreground">
              {viewMode === 'day' && isToday(rangeStart)
                ? t('mail.rightSidebar.dayToday')
                : viewMode === 'day'
                  ? format(rangeStart, 'yyyy-MM-dd')
                  : null}
            </div>
          </div>
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
            title={navNextTitle}
            onClick={(): void => shiftRange(1)}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        {selectedMessage ? (
          <button
            type="button"
            className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1.5 text-[11px] font-medium text-emerald-700 transition-colors hover:bg-emerald-500/20 dark:text-emerald-300"
            onClick={(): void => openScheduleMeetingFromMail(selectedMessage)}
          >
            <CalendarClock className="h-3.5 w-3.5" />
            {t('mail.scheduleMeeting.sidebar')}
          </button>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        {calError ? (
          <p className="px-3 py-2 text-2xs leading-snug text-destructive">{calError}</p>
        ) : null}
        {mailTodosErr ? (
          <p className="px-3 py-2 text-2xs leading-snug text-destructive">{mailTodosErr}</p>
        ) : null}

        <div className="relative flex h-full min-h-0 flex-col">
          {(inFlight && previewRangeEvents.length === 0) || mailTodosLoading ? (
            <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-center gap-2 bg-background/70 py-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {inFlight ? t('mail.inboxCal.loading') : t('mail.rightSidebar.tasksLoading')}
            </div>
          ) : null}
          <div
            ref={calendarHostRef}
            className="calendar-notion-shell calendar-notion-shell--mail-day h-full min-h-0 flex-1"
          >
            <FullCalendar
              key={`${i18n.language}-${viewMode}-${calSettings.defaultTimeGridSlotMinutes}-${calSettings.slotMinTime}-${calSettings.slotMaxTime}-${calSettings.scrollTime}-${calSettings.weekStartsOn}-${calSettings.hideWeekends}`}
              ref={(inst): void => {
                calendarRef.current = inst
              }}
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, luxonPlugin]}
              locale={fcLocale}
              height="100%"
              timeZone="local"
              headerToolbar={false}
              initialView={fcViewId}
              initialDate={rangeStart}
              firstDay={calSettings.weekStartsOn}
              weekends={!calSettings.hideWeekends}
              slotMinTime={isTimeGridView ? calSettings.slotMinTime : undefined}
              slotMaxTime={isTimeGridView ? calSettings.slotMaxTime : undefined}
              scrollTime={isTimeGridView ? calSettings.scrollTime : undefined}
              slotDuration={isTimeGridView ? timeGridFcSlotOpts.slotDuration : undefined}
              snapDuration={isTimeGridView ? timeGridFcSlotOpts.snapDuration : undefined}
              slotLabelInterval={isTimeGridView ? '01:00:00' : undefined}
              nowIndicator={isTimeGridView}
              allDaySlot={viewMode !== 'month'}
              dayMaxEvents={viewMode === 'month'}
              views={dayGridMonthView}
              editable={false}
              selectable={canInteractInTimeGrid}
              selectMirror={false}
              selectLongPressDelay={380}
              selectAllow={(): boolean => canInteractInTimeGrid}
              select={onSelect}
              dateClick={viewMode === 'month' ? onMonthDateClick : undefined}
              events={fcEvents}
              eventContent={calendarFcEventContentRender}
              eventDidMount={(info): void => {
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
              }}
              eventClick={onEventClick}
            />
          </div>
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
              onSaved={reloadDayData}
              onOpenDetails={(draft): void => {
                dismissQuickCreate()
                setEventDialog({ range: draft.range, draft })
              }}
            />,
            document.body
          )
        : null}

      <CalendarEventDialog
        open={eventDialog != null}
        mode="create"
        accounts={calendarLinkedAccounts}
        defaultAccountId={eventDialog?.draft.accountId ?? calendarLinkedAccounts[0]?.id}
        initialRange={eventDialog?.range ?? undefined}
        createPrefill={
          eventDialog ? { subject: eventDialog.draft.subject, location: '' } : undefined
        }
        initialCreateKind={eventDialog?.draft.createKind}
        initialGraphCalendarId={eventDialog?.draft.graphCalendarId || undefined}
        initialTaskListId={eventDialog?.draft.taskListId || undefined}
        taskAccounts={taskAccounts}
        loadListsForAccount={loadTaskListsForAccount}
        onClose={(): void => setEventDialog(null)}
        onSaved={reloadDayData}
      />
    </div>
  )
}

