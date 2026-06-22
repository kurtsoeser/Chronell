import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { addDays, format, isToday, parseISO, startOfDay, startOfWeek } from 'date-fns'
import { de as deFns, enUS as enUSFns } from 'date-fns/locale'
import type { Locale } from 'date-fns'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import luxonPlugin from '@fullcalendar/luxon'
import deLocale from '@fullcalendar/core/locales/de'
import enGbLocale from '@fullcalendar/core/locales/en-gb'
import type { DateSelectArg, EventChangeArg, EventInput } from '@fullcalendar/core'
import type { CalendarEventView, ConnectedAccount } from '@shared/types'
import {
  QUICK_CREATE_PLACEHOLDER_EVENT_ID,
  quickCreateRangeToFcPlaceholder
} from '@/app/calendar/calendar-quick-create-placeholder'
import { useCalendarFcEventContent } from '@/app/calendar/use-calendar-fc-event-content'
import {
  persistTimeGridSlotMinutes,
  readTimeGridSlotMinutesFromStorage,
  timeGridFcSnapOptions,
  type TimeGridSlotMinutes
} from '@/app/calendar/calendar-shell-storage'
import { useCalendarSettingsPrefs } from '@/lib/use-calendar-settings-prefs'
import { useTimeGridSlotZoom } from '@/hooks/use-time-grid-slot-zoom'
import { cn } from '@/lib/utils'
import { useCalendarListByAccount } from '@/lib/use-calendar-list-by-account'
import { buildCalendarIncludeCalendars } from '@/lib/build-calendar-include-calendars'
import { useInboxCalendarAgendaCacheStore } from '@/stores/inbox-calendar-agenda-cache'
import {
  buildCalendarDisplayHexByKey,
  buildDefaultGraphCalendarIdByAccount,
  resolveGraphEventDisplayHex
} from '@/lib/calendar-event-display-hex'
import { applyCalendarEventDomColors } from '@/lib/calendar-event-chip-style'
import {
  eventDatetimeLocalToMs,
  formatEventDatetimeLocal,
  parseEventDatetimeLocal,
  utcIsoToEventDatetimeLocal
} from '@/lib/calendar-event-timezone'
import '@/app/calendar/notion-calendar.css'

const K_PICKER_VIEW = 'mailclient.calendarEventDialog.pickerView'

type PickerViewMode = 'day' | 'week'

function readPickerView(): PickerViewMode {
  try {
    const v = window.localStorage.getItem(K_PICKER_VIEW)
    if (v === 'week') return 'week'
  } catch {
    // ignore
  }
  return 'day'
}

function writePickerView(mode: PickerViewMode): void {
  try {
    window.localStorage.setItem(K_PICKER_VIEW, mode)
  } catch {
    // ignore
  }
}

function formatDayTitle(d: Date, locale: Locale): string {
  return format(d, 'EEE, d. MMM yyyy', { locale })
}

function formatWeekTitle(weekStart: Date, weekEndExcl: Date, locale: Locale): string {
  const weekEnd = addDays(weekEndExcl, -1)
  const sameMonth = weekStart.getMonth() === weekEnd.getMonth()
  if (sameMonth) {
    return `${format(weekStart, 'd.', { locale })}–${format(weekEnd, 'd. MMM yyyy', { locale })}`
  }
  return `${format(weekStart, 'd. MMM', { locale })} – ${format(weekEnd, 'd. MMM yyyy', { locale })}`
}

function shiftEventDatetimeLocalByDays(dtLocal: string, deltaDays: number): string {
  const p = parseEventDatetimeLocal(dtLocal)
  if (!p) return dtLocal
  const nextYmd = format(addDays(parseISO(`${p.ymd}T12:00:00`), deltaDays), 'yyyy-MM-dd')
  return formatEventDatetimeLocal(nextYmd, p.hour, p.minute)
}

function filterEventsForRange(
  events: CalendarEventView[],
  accountId: string,
  rangeStartMs: Date,
  rangeEndExcl: Date
): CalendarEventView[] {
  const startMs = rangeStartMs.getTime()
  const endMs = rangeEndExcl.getTime()
  return events.filter((ev) => {
    if (ev.accountId !== accountId) return false
    const s = Date.parse(ev.startIso)
    const e = Date.parse(ev.endIso)
    if (!Number.isFinite(s) || !Number.isFinite(e)) return false
    return s < endMs && e > startMs
  })
}

export interface CalendarEventDialogDayPickerProps {
  accountId: string
  accounts: ConnectedAccount[]
  eventTimeZone: string
  isAllDay: boolean
  disabled: boolean
  editingEventId?: string | null
  dtStart: string
  dtEnd: string
  dayStart: string
  dayEnd: string
  onTimedRangeChange: (startLocal: string, endLocal: string) => void
  onAllDayRangeChange: (nextDayStart: string, nextDayEndExcl: string) => void
}

export function CalendarEventDialogDayPicker({
  accountId,
  accounts,
  eventTimeZone,
  isAllDay,
  disabled,
  editingEventId,
  dtStart,
  dtEnd,
  dayStart,
  dayEnd,
  onTimedRangeChange,
  onAllDayRangeChange
}: CalendarEventDialogDayPickerProps): JSX.Element {
  const { t, i18n } = useTranslation()
  const dfLocale: Locale = i18n.language.startsWith('de') ? deFns : enUSFns
  const calSettings = useCalendarSettingsPrefs()
  const calendarFcEventContentRender = useCalendarFcEventContent()
  const dayPickerRootRef = useRef<HTMLDivElement | null>(null)
  const calendarRef = useRef<FullCalendar | null>(null)
  const calendarHostRef = useRef<HTMLDivElement | null>(null)
  const fetchSeqRef = useRef(0)
  const [timeGridSlotMinutes, setTimeGridSlotMinutes] = useState<TimeGridSlotMinutes>(
    readTimeGridSlotMinutesFromStorage
  )
  const [pickerView, setPickerView] = useState<PickerViewMode>(() => readPickerView())

  useEffect(() => {
    persistTimeGridSlotMinutes(timeGridSlotMinutes)
  }, [timeGridSlotMinutes])

  useTimeGridSlotZoom(calendarHostRef, dayPickerRootRef, {
    slotMinutes: timeGridSlotMinutes,
    onSlotMinutesChange: setTimeGridSlotMinutes
  })

  const linkedAccount = useMemo(
    () => accounts.find((a) => a.id === accountId) ?? null,
    [accounts, accountId]
  )
  const calendarLinkedAccounts = useMemo(
    () => (linkedAccount ? [linkedAccount] : []),
    [linkedAccount?.id, linkedAccount]
  )
  const calendarsByAccount = useCalendarListByAccount(calendarLinkedAccounts)
  const previewRangeEvents = useInboxCalendarAgendaCacheStore((s) => s.previewRangeEvents)
  const loadAgendaFromCache = useInboxCalendarAgendaCacheStore((s) => s.loadAgenda)
  const calendarLinkedAccountIds = useMemo(
    () => (accountId ? [accountId] : []),
    [accountId]
  )
  const defaultGraphCalendarIdByAccount = useMemo(
    () => buildDefaultGraphCalendarIdByAccount(calendarLinkedAccountIds, calendarsByAccount),
    [calendarLinkedAccountIds, calendarsByAccount]
  )
  const calendarDisplayHexByKey = useMemo(
    () => buildCalendarDisplayHexByKey(calendarLinkedAccountIds, calendarsByAccount),
    [calendarLinkedAccountIds, calendarsByAccount]
  )

  const activeDay = useMemo(() => {
    if (isAllDay && dayStart) {
      try {
        return startOfDay(parseISO(`${dayStart}T12:00:00`))
      } catch {
        return startOfDay(new Date())
      }
    }
    const sp = parseEventDatetimeLocal(dtStart)
    if (sp) {
      try {
        return startOfDay(parseISO(`${sp.ymd}T12:00:00`))
      } catch {
        return startOfDay(new Date())
      }
    }
    return startOfDay(new Date())
  }, [isAllDay, dayStart, dtStart])

  const dayStartMs = useMemo(() => startOfDay(activeDay), [activeDay])
  const dayEndExcl = useMemo(() => addDays(dayStartMs, 1), [dayStartMs])
  const weekStartMs = useMemo(
    () => startOfWeek(dayStartMs, { weekStartsOn: calSettings.weekStartsOn }),
    [dayStartMs, calSettings.weekStartsOn]
  )
  const weekEndExcl = useMemo(() => addDays(weekStartMs, 7), [weekStartMs])
  const rangeStartMs = pickerView === 'week' ? weekStartMs : dayStartMs
  const rangeEndExcl = pickerView === 'week' ? weekEndExcl : dayEndExcl
  const rangeKey = `${rangeStartMs.toISOString()}\u001f${rangeEndExcl.toISOString()}`

  const calendarListKey = useMemo(() => {
    if (!accountId) return ''
    return (calendarsByAccount[accountId] ?? [])
      .map((c) => c.id)
      .sort()
      .join('\u001f')
  }, [accountId, calendarsByAccount])

  const cachedRangeEvents = useMemo(
    () =>
      accountId
        ? filterEventsForRange(previewRangeEvents, accountId, rangeStartMs, rangeEndExcl)
        : [],
    [accountId, previewRangeEvents, rangeStartMs, rangeEndExcl]
  )

  const [refreshedRangeEvents, setRefreshedRangeEvents] = useState<CalendarEventView[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const visibleRangeEvents = refreshedRangeEvents ?? cachedRangeEvents

  useEffect(() => {
    setRefreshedRangeEvents(null)
    setLoadError(null)
  }, [accountId, rangeKey, pickerView])

  useEffect(() => {
    if (!accountId) return
    const acc = accounts.find((a) => a.id === accountId)
    if (!acc || (acc.provider !== 'microsoft' && acc.provider !== 'google')) return
    void loadAgendaFromCache([acc])
  }, [accountId, accounts, loadAgendaFromCache])

  useEffect(() => {
    if (!accountId) return
    const acc = accounts.find((a) => a.id === accountId)
    if (!acc || (acc.provider !== 'microsoft' && acc.provider !== 'google')) return

    const seq = ++fetchSeqRef.current
    setLoadError(null)
    const rangeStart = rangeStartMs.toISOString()
    const rangeEnd = rangeEndExcl.toISOString()

    void (async (): Promise<void> => {
      try {
        const rows = calendarsByAccount[accountId] ?? []
        let includeCalendars =
          rows.length > 0
            ? rows.map((c) => ({ accountId, graphCalendarId: c.id }))
            : (await buildCalendarIncludeCalendars([acc])).filter((c) => c.accountId === accountId)
        if (includeCalendars.length === 0) {
          includeCalendars = [{ accountId, graphCalendarId: '' }]
        }
        const events = await window.mailClient.calendar.listEvents({
          startIso: rangeStart,
          endIso: rangeEnd,
          focusCalendar: null,
          includeCalendars
        })
        if (fetchSeqRef.current !== seq) return
        setRefreshedRangeEvents(
          filterEventsForRange(events, accountId, rangeStartMs, rangeEndExcl)
        )
      } catch (e) {
        if (fetchSeqRef.current !== seq) return
        setLoadError(e instanceof Error ? e.message : String(e))
      }
    })()
  }, [accountId, accounts, calendarListKey, rangeKey, calendarsByAccount, rangeStartMs, rangeEndExcl])

  useEffect(() => {
    calendarRef.current?.getApi()?.gotoDate(rangeStartMs)
  }, [rangeStartMs, pickerView])

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

  const draftPlaceholder = useMemo((): EventInput | null => {
    if (isAllDay || !dtStart || !dtEnd) return null
    const startMs = eventDatetimeLocalToMs(dtStart, eventTimeZone)
    const endMs = eventDatetimeLocalToMs(dtEnd, eventTimeZone)
    if (Number.isNaN(startMs) || Number.isNaN(endMs)) return null
    const base = quickCreateRangeToFcPlaceholder({
      start: new Date(startMs),
      end: new Date(endMs),
      allDay: false
    })
    return {
      ...base,
      editable: !disabled,
      startEditable: !disabled,
      durationEditable: !disabled
    }
  }, [isAllDay, dtStart, dtEnd, eventTimeZone, disabled])

  const graphFcEvents = useMemo((): EventInput[] => {
    const startMs = rangeStartMs.getTime()
    const endMs = rangeEndExcl.getTime()
    const out: EventInput[] = []
    for (const ev of visibleRangeEvents) {
      if (editingEventId && ev.id === editingEventId) continue
      const s = Date.parse(ev.startIso)
      const e = Date.parse(ev.endIso)
      if (!Number.isFinite(s) || !Number.isFinite(e)) continue
      if (s >= endMs || e <= startMs) continue
      if (ev.isAllDay) continue
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
        allDay: false,
        extendedProps: {
          accountColor: ev.accountColorClass,
          displayColorHex: resolvedDisplayHex,
          calendarEvent: ev
        },
        editable: false
      })
    }
    return out
  }, [
    visibleRangeEvents,
    rangeStartMs,
    rangeEndExcl,
    editingEventId,
    defaultGraphCalendarIdByAccount,
    calendarDisplayHexByKey
  ])

  const fcEvents = useMemo(() => {
    const out = [...graphFcEvents]
    if (draftPlaceholder) out.push(draftPlaceholder)
    return out
  }, [graphFcEvents, draftPlaceholder])

  const timeGridFcSlotOpts = useMemo(
    () => timeGridFcSnapOptions(timeGridSlotMinutes),
    [timeGridSlotMinutes]
  )

  const fcLocale = i18n.language.startsWith('de') ? deLocale : enGbLocale
  const canSelect = !disabled && !isAllDay && Boolean(linkedAccount)

  const applySelectionRange = useCallback(
    (start: Date, end: Date): void => {
      const startLocal = utcIsoToEventDatetimeLocal(start.toISOString(), eventTimeZone)
      const endLocal = utcIsoToEventDatetimeLocal(end.toISOString(), eventTimeZone)
      if (!startLocal || !endLocal) return
      onTimedRangeChange(startLocal, endLocal)
    },
    [eventTimeZone, onTimedRangeChange]
  )

  const onSelect = useCallback(
    (sel: DateSelectArg): void => {
      if (!canSelect) return
      applySelectionRange(sel.start, sel.end)
      queueMicrotask(() => calendarRef.current?.getApi()?.unselect())
    },
    [applySelectionRange, canSelect]
  )

  const onEventChange = useCallback(
    (info: EventChangeArg): void => {
      if (info.event.id !== QUICK_CREATE_PLACEHOLDER_EVENT_ID) return
      const start = info.event.start
      if (!start) return
      const end =
        info.event.end ??
        new Date(start.getTime() + Math.max(15, timeGridSlotMinutes) * 60_000)
      applySelectionRange(start, end)
    },
    [applySelectionRange, timeGridSlotMinutes]
  )

  const shiftRange = useCallback(
    (deltaDays: number): void => {
      if (deltaDays === 0) return
      const step = pickerView === 'week' ? deltaDays * 7 : deltaDays
      if (isAllDay) {
        if (!dayStart || !dayEnd) return
        const nextStart = format(addDays(parseISO(`${dayStart}T12:00:00`), step), 'yyyy-MM-dd')
        const nextEnd = format(addDays(parseISO(`${dayEnd}T12:00:00`), step), 'yyyy-MM-dd')
        onAllDayRangeChange(nextStart, nextEnd)
        return
      }
      if (!dtStart || !dtEnd) return
      onTimedRangeChange(
        shiftEventDatetimeLocalByDays(dtStart, step),
        shiftEventDatetimeLocalByDays(dtEnd, step)
      )
    },
    [pickerView, isAllDay, dayStart, dayEnd, dtStart, dtEnd, onAllDayRangeChange, onTimedRangeChange]
  )

  const setPickerViewMode = useCallback((mode: PickerViewMode): void => {
    setPickerView(mode)
    writePickerView(mode)
  }, [])

  useEffect(() => {
    if (isAllDay || !dtStart) return
    const sp = parseEventDatetimeLocal(dtStart)
    if (!sp) return
    const scroll = `${String(sp.hour).padStart(2, '0')}:${String(sp.minute).padStart(2, '0')}:00`
    requestAnimationFrame(() => {
      calendarRef.current?.getApi()?.scrollToTime(scroll)
    })
  }, [isAllDay, dtStart, dayStartMs])

  return (
    <div ref={dayPickerRootRef} className="flex h-full min-h-0 flex-col" tabIndex={-1}>
      <div className="shrink-0 border-b border-border px-2 py-2">
        <div className="mb-2 flex items-center justify-center gap-1">
          <button
            type="button"
            className={cn(
              'rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors',
              pickerView === 'day'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-secondary/70 hover:text-foreground'
            )}
            onClick={(): void => setPickerViewMode('day')}
          >
            {t('calendar.eventDialog.dayColumnViewDay')}
          </button>
          <button
            type="button"
            className={cn(
              'rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors',
              pickerView === 'week'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-secondary/70 hover:text-foreground'
            )}
            onClick={(): void => setPickerViewMode('week')}
          >
            {t('calendar.eventDialog.dayColumnViewWeek')}
          </button>
        </div>
        <div className="flex items-center justify-between gap-1">
          <button
            type="button"
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
            title={
              pickerView === 'week'
                ? t('calendar.eventDialog.dayColumnWeekPrev')
                : t('mail.rightSidebar.dayPrev')
            }
            disabled={disabled}
            onClick={(): void => shiftRange(-1)}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <div className="min-w-0 flex-1 text-center">
            <div className="truncate text-[11px] font-semibold text-foreground">
              {pickerView === 'week'
                ? formatWeekTitle(weekStartMs, weekEndExcl, dfLocale)
                : formatDayTitle(dayStartMs, dfLocale)}
            </div>
            {pickerView === 'day' && isToday(dayStartMs) ? (
              <div className="text-[10px] text-muted-foreground">{t('mail.rightSidebar.dayToday')}</div>
            ) : null}
          </div>
          <button
            type="button"
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
            title={
              pickerView === 'week'
                ? t('calendar.eventDialog.dayColumnWeekNext')
                : t('mail.rightSidebar.dayNext')
            }
            disabled={disabled}
            onClick={(): void => shiftRange(1)}
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        {loadError ? (
          <p className="px-2 py-2 text-[10px] leading-snug text-destructive">{loadError}</p>
        ) : null}
        {!linkedAccount ? (
          <p className="px-2 py-4 text-center text-[10px] text-muted-foreground">
            {t('calendar.eventDialog.dayColumnNoAccount')}
          </p>
        ) : (
          <div
            ref={calendarHostRef}
            className={cn(
              'calendar-notion-shell calendar-notion-shell--mail-day h-full min-h-0 flex-1',
              `cal-slot-${timeGridSlotMinutes}`
            )}
          >
            <FullCalendar
              key={`${i18n.language}-${eventTimeZone}-${timeGridSlotMinutes}-${calSettings.slotMinTime}-${calSettings.slotMaxTime}-${pickerView}-${rangeKey}`}
              ref={(inst): void => {
                calendarRef.current = inst
              }}
              plugins={[timeGridPlugin, interactionPlugin, luxonPlugin]}
              locale={fcLocale}
              height="100%"
              timeZone={eventTimeZone}
              headerToolbar={false}
              initialView={pickerView === 'week' ? 'timeGridWeek' : 'timeGridDay'}
              initialDate={rangeStartMs}
              firstDay={calSettings.weekStartsOn}
              weekends={!calSettings.hideWeekends}
              slotMinTime={calSettings.slotMinTime}
              slotMaxTime={calSettings.slotMaxTime}
              scrollTime={calSettings.scrollTime}
              slotDuration={timeGridFcSlotOpts.slotDuration}
              snapDuration={timeGridFcSlotOpts.snapDuration}
              slotLabelInterval="01:00:00"
              nowIndicator
              editable={canSelect}
              selectable={canSelect}
              selectMirror={false}
              events={fcEvents}
              eventContent={calendarFcEventContentRender}
              eventDidMount={(info): void => {
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
              select={onSelect}
              eventChange={onEventChange}
            />
          </div>
        )}
      </div>
    </div>
  )
}
