import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { addDays, parseISO, startOfDay } from 'date-fns'
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import luxonPlugin from '@fullcalendar/luxon'
import { useCalendarFcLocale } from '@/hooks/use-calendar-fc-locale'
import type { EventInput } from '@fullcalendar/core'
import { useTranslation } from 'react-i18next'
import type { CalendarEventView, MeetingInvitationView } from '@shared/types'
import { useAccountsStore } from '@/stores/accounts'
import { buildCalendarIncludeCalendars } from '@/lib/build-calendar-include-calendars'
import {
  buildCalendarDisplayHexByKey,
  buildDefaultGraphCalendarIdByAccount,
  resolveGraphEventDisplayHex
} from '@/lib/calendar-event-display-hex'
import { useCalendarListByAccount } from '@/lib/use-calendar-list-by-account'
import { applyCalendarEventDomColors } from '@/lib/calendar-event-chip-style'
import { useCalendarSettingsPrefs } from '@/lib/use-calendar-settings-prefs'
import { timeGridFcSnapOptions } from '@/app/calendar/calendar-shell-storage'
import '@/app/calendar/notion-calendar.css'

export const MEETING_INVITATION_PREVIEW_EVENT_ID = 'meeting-invitation-preview'

export function MeetingInvitationDayPreview({
  invitation,
  dayEvents,
  loading
}: {
  invitation: MeetingInvitationView
  dayEvents: CalendarEventView[]
  loading?: boolean
}): JSX.Element | null {
  const { i18n } = useTranslation()
  const startIso = invitation.startIso
  const endIso = invitation.endIso
  const calSettings = useCalendarSettingsPrefs()
  const calendarRef = useRef<FullCalendar | null>(null)
  const hostRef = useRef<HTMLDivElement | null>(null)

  const accounts = useAccountsStore((s) => s.accounts)
  const calendarLinkedAccounts = useMemo(
    () => accounts.filter((a) => a.provider === 'microsoft' || a.provider === 'google'),
    [accounts]
  )
  const calendarLinkedAccountIds = useMemo(
    () => calendarLinkedAccounts.map((a) => a.id),
    [calendarLinkedAccounts]
  )
  const calendarsByAccount = useCalendarListByAccount(calendarLinkedAccounts)
  const defaultGraphCalendarIdByAccount = useMemo(
    () => buildDefaultGraphCalendarIdByAccount(calendarLinkedAccountIds, calendarsByAccount),
    [calendarLinkedAccountIds, calendarsByAccount]
  )
  const calendarDisplayHexByKey = useMemo(
    () => buildCalendarDisplayHexByKey(calendarLinkedAccountIds, calendarsByAccount),
    [calendarLinkedAccountIds, calendarsByAccount]
  )

  const dayStart = useMemo(() => {
    if (!startIso) return startOfDay(new Date())
    const d = parseISO(startIso)
    return startOfDay(Number.isNaN(d.getTime()) ? new Date() : d)
  }, [startIso])
  const dayEndExcl = useMemo(() => addDays(dayStart, 1), [dayStart])

  useEffect(() => {
    calendarRef.current?.getApi()?.gotoDate(dayStart)
  }, [dayStart])

  useEffect(() => {
    const host = hostRef.current
    if (!host || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => calendarRef.current?.getApi()?.updateSize())
    ro.observe(host)
    return (): void => ro.disconnect()
  }, [])

  const existingEvents = useMemo((): EventInput[] => {
    const startMs = dayStart.getTime()
    const endMs = dayEndExcl.getTime()
    const invStart = startIso ? Date.parse(startIso) : Number.NaN
    const invEnd = endIso ? Date.parse(endIso) : Number.NaN
    const out: EventInput[] = []
    for (const ev of dayEvents) {
      const s = Date.parse(ev.startIso)
      const e = Date.parse(ev.endIso)
      if (!Number.isFinite(s) || !Number.isFinite(e)) continue
      if (s >= endMs || e <= startMs) continue
      if (
        Number.isFinite(invStart) &&
        Number.isFinite(invEnd) &&
        Math.abs(s - invStart) < 60_000 &&
        Math.abs(e - invEnd) < 60_000
      ) {
        continue
      }
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
    dayEvents,
    dayStart,
    dayEndExcl,
    endIso,
    startIso,
    defaultGraphCalendarIdByAccount,
    calendarDisplayHexByKey
  ])

  const invitationEvent = useMemo((): EventInput | null => {
    if (!startIso || !endIso) return null
    return {
      id: MEETING_INVITATION_PREVIEW_EVENT_ID,
      title: invitation.summary,
      start: startIso,
      end: endIso,
      allDay: invitation.isAllDay,
      classNames: ['meeting-invitation-preview-event'],
      extendedProps: { isMeetingInvitation: true },
      editable: false
    }
  }, [endIso, invitation.isAllDay, invitation.summary, startIso])

  const fcEvents = useMemo(
    () => (invitationEvent ? [...existingEvents, invitationEvent] : existingEvents),
    [existingEvents, invitationEvent]
  )

  const eventDidMount = useCallback(
    (info: {
      el: HTMLElement
      event: { id: string; extendedProps: Record<string, unknown> }
    }): void => {
      if (info.event.id === MEETING_INVITATION_PREVIEW_EVENT_ID) return
      applyCalendarEventDomColors(info.el, {
        displayColorHex: info.event.extendedProps.displayColorHex as string | null | undefined,
        accountTailwindBgClass: info.event.extendedProps.accountColor as string | null | undefined
      })
    },
    []
  )

  const timeGridFcSlotOpts = useMemo(
    () => timeGridFcSnapOptions(calSettings.defaultTimeGridSlotMinutes),
    [calSettings.defaultTimeGridSlotMinutes]
  )

  const fcLocale = useCalendarFcLocale()

  if (!startIso || !endIso) return null

  return (
    <div
      ref={hostRef}
      className={[
        'meeting-invitation-day-preview relative overflow-hidden rounded-lg border border-border/80 bg-background/40',
        loading ? 'opacity-70' : ''
      ].join(' ')}
    >
      <div className="h-[220px] min-h-[180px]">
        <FullCalendar
          ref={calendarRef}
          plugins={[timeGridPlugin, luxonPlugin]}
          initialView="timeGridDay"
          initialDate={dayStart}
          headerToolbar={false}
          allDaySlot
          slotMinTime="06:00:00"
          slotMaxTime="22:00:00"
          scrollTime={
            invitation.isAllDay
              ? '08:00:00'
              : `${String(new Date(startIso).getHours()).padStart(2, '0')}:${String(Math.max(0, new Date(startIso).getMinutes() - 30)).padStart(2, '0')}:00`
          }
          height="100%"
          locale={fcLocale}
          events={fcEvents}
          eventDidMount={eventDidMount}
          nowIndicator
          editable={false}
          selectable={false}
          dayHeaders={false}
          slotLabelFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
          {...timeGridFcSlotOpts}
        />
      </div>
    </div>
  )
}

export function useMeetingInvitationDayEvents(
  invitation: MeetingInvitationView | null
): { events: CalendarEventView[]; loading: boolean } {
  const accounts = useAccountsStore((s) => s.accounts)
  const calendarLinkedAccounts = useMemo(
    () => accounts.filter((a) => a.provider === 'microsoft' || a.provider === 'google'),
    [accounts]
  )
  const [events, setEvents] = useState<CalendarEventView[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!invitation?.startIso) {
      setEvents([])
      return
    }
    let cancelled = false
    setLoading(true)
    void (async (): Promise<void> => {
      try {
        const dayStart = startOfDay(parseISO(invitation.startIso!))
        const dayEnd = addDays(dayStart, 1)
        const includeCalendars = await buildCalendarIncludeCalendars(calendarLinkedAccounts)
        const rows = await window.mailClient.calendar.listEvents({
          startIso: dayStart.toISOString(),
          endIso: dayEnd.toISOString(),
          focusCalendar: null,
          includeCalendars
        })
        if (!cancelled) setEvents(rows)
      } catch {
        if (!cancelled) setEvents([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return (): void => {
      cancelled = true
    }
  }, [invitation, calendarLinkedAccounts])

  return { events, loading }
}

export function meetingInvitationHasConflict(
  invitation: MeetingInvitationView,
  dayEvents: CalendarEventView[]
): boolean {
  if (!invitation.startIso || !invitation.endIso) return false
  const invStart = Date.parse(invitation.startIso)
  const invEnd = Date.parse(invitation.endIso)
  if (!Number.isFinite(invStart) || !Number.isFinite(invEnd)) return false
  for (const ev of dayEvents) {
    const s = Date.parse(ev.startIso)
    const e = Date.parse(ev.endIso)
    if (!Number.isFinite(s) || !Number.isFinite(e)) continue
    if (Math.abs(s - invStart) < 60_000 && Math.abs(e - invEnd) < 60_000) continue
    if (s < invEnd && e > invStart) return true
  }
  return false
}
