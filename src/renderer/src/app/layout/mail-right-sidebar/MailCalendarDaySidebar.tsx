import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { addDays, format, isToday, parseISO, startOfDay } from 'date-fns'
import { de as deFns, enUS as enUSFns } from 'date-fns/locale'
import type { Locale } from 'date-fns'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import luxonPlugin from '@fullcalendar/luxon'
import deLocale from '@fullcalendar/core/locales/de'
import enGbLocale from '@fullcalendar/core/locales/en-gb'
import type { DateSelectArg, EventClickArg, EventInput } from '@fullcalendar/core'
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
import { useCalendarPendingFocusStore } from '@/stores/calendar-pending-focus'
import { useMailStore } from '@/stores/mail'
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
import '@/app/calendar/notion-calendar.css'

const K_DAY_ISO = 'mailclient.mailRightSidebar.dayIso'

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

export function MailCalendarDaySidebar(): JSX.Element {
  const { t, i18n } = useTranslation()
  const dfLocale: Locale = i18n.language.startsWith('de') ? deFns : enUSFns
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
  const selectMessage = useMailStore((s) => s.selectMessage)

  const [day, setDay] = useState(() => readDay())
  useEffect(() => writeDay(day), [day])

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

  const dayStart = useMemo(() => startOfDay(day), [day])
  const dayEndExcl = useMemo(() => addDays(dayStart, 1), [dayStart])

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
      useCalendarPendingFocusStore.getState().queueFocusEvent(ev)
      setAppMode('calendar')
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
    calendarRef.current?.getApi()?.gotoDate(dayStart)
  }, [dayStart])

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

  const fcLocale = i18n.language.startsWith('de') ? deLocale : enGbLocale

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
        if (m) void selectMessage(m.id)
        return
      }
      const cal = info.event.extendedProps?.calendarEvent as CalendarEventView | undefined
      if (cal) openCalendarEvent(cal)
    },
    [openCalendarEvent, selectMessage]
  )

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-border px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
            title={t('mail.rightSidebar.dayPrev')}
            onClick={(): void => setDay((d) => addDays(d, -1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0 flex-1 text-center">
            <div className="truncate text-xs font-semibold text-foreground">
              {formatDayTitle(dayStart, dfLocale)}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {isToday(dayStart) ? t('mail.rightSidebar.dayToday') : format(dayStart, 'yyyy-MM-dd')}
            </div>
          </div>
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
            title={t('mail.rightSidebar.dayNext')}
            onClick={(): void => setDay((d) => addDays(d, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
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
              key={`${i18n.language}-${calSettings.defaultTimeGridSlotMinutes}-${calSettings.slotMinTime}-${calSettings.slotMaxTime}-${calSettings.scrollTime}`}
              ref={(inst): void => {
                calendarRef.current = inst
              }}
              plugins={[timeGridPlugin, interactionPlugin, luxonPlugin]}
              locale={fcLocale}
              height="100%"
              timeZone="local"
              headerToolbar={false}
              initialView="timeGridDay"
              initialDate={dayStart}
              slotMinTime={calSettings.slotMinTime}
              slotMaxTime={calSettings.slotMaxTime}
              scrollTime={calSettings.scrollTime}
              slotDuration={timeGridFcSlotOpts.slotDuration}
              snapDuration={timeGridFcSlotOpts.snapDuration}
              slotLabelInterval="01:00:00"
              nowIndicator
              editable={false}
              selectable={canInteractInTimeGrid}
              selectMirror={false}
              selectLongPressDelay={380}
              selectAllow={(): boolean => canInteractInTimeGrid}
              select={onSelect}
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

