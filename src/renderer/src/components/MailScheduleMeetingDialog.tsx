import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  addDays,
  addMinutes,
  format,
  parseISO,
  startOfDay,
  startOfWeek
} from 'date-fns'
import { de as deFns, enUS as enUSFns } from 'date-fns/locale'
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import luxonPlugin from '@fullcalendar/luxon'
import deLocale from '@fullcalendar/core/locales/de'
import enGbLocale from '@fullcalendar/core/locales/en-gb'
import type { DateSelectArg, EventInput } from '@fullcalendar/core'
import {
  AlertTriangle,
  CalendarClock,
  Loader2,
  Send,
  Users,
  Video,
  X
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type {
  CalendarAttendeeScheduleView,
  CalendarEventView,
  CalendarFreeSlot,
  CalendarSuggestionFromMail,
  ConnectedAccount,
  MailFull
} from '@shared/types'
import { formatMeetingAttendeesForComposeInput } from '@shared/mail-meeting-attendees'
import {
  calendarSlotHasConflict
} from '@shared/calendar-free-slots'
import { ModalPanel, ModalRoot } from '@/components/motion/Modal'
import { RecipientTokenField } from '@/components/RecipientTokenField'
import { parseRecipients } from '@/lib/compose-helpers'
import { openExternalUrl } from '@/lib/open-external'
import {
  safeFindLocalFreeSlots,
  safeFindMeetingTimes,
  safeGetAttendeeSchedule
} from '@/lib/calendar-schedule-invoke'
import { buildCalendarIncludeCalendars } from '@/lib/build-calendar-include-calendars'
import {
  buildCalendarDisplayHexByKey,
  buildDefaultGraphCalendarIdByAccount,
  resolveGraphEventDisplayHex
} from '@/lib/calendar-event-display-hex'
import { applyCalendarEventDomColors } from '@/lib/calendar-event-chip-style'
import { useCalendarSettingsPrefs } from '@/lib/use-calendar-settings-prefs'
import { timeGridFcSnapOptions } from '@/app/calendar/calendar-shell-storage'
import { useCalendarListByAccount } from '@/lib/use-calendar-list-by-account'
import { useComposeStore } from '@/stores/compose'
import { useUndoStore } from '@/stores/undo'
import { cn } from '@/lib/utils'
import '@/app/calendar/notion-calendar.css'
import '@/app/layout/meeting-invitation/meeting-invitation.css'

export const MAIL_SCHEDULE_GHOST_EVENT_ID = '__mail-schedule-ghost__'

const DURATION_OPTIONS = [30, 45, 60, 90] as const

function slotDurationMinutes(start: Date, end: Date): number {
  return Math.max(15, Math.round((end.getTime() - start.getTime()) / 60_000))
}

function attendeeBusyAtSlot(
  schedules: CalendarAttendeeScheduleView[],
  startIso: string,
  endIso: string
): string[] {
  const startMs = Date.parse(startIso)
  const endMs = Date.parse(endIso)
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return []
  const busy: string[] = []
  for (const row of schedules) {
    for (const item of row.items) {
      if (item.status === 'free') continue
      const s = Date.parse(item.startIso)
      const e = Date.parse(item.endIso)
      if (!Number.isFinite(s) || !Number.isFinite(e)) continue
      if (s < endMs && e > startMs) {
        busy.push(row.email)
        break
      }
    }
  }
  return busy
}

function AttendeeAvailabilityStrip({
  schedules,
  slotStartIso,
  slotEndIso,
  loading
}: {
  schedules: CalendarAttendeeScheduleView[]
  slotStartIso: string
  slotEndIso: string
  loading?: boolean
}): JSX.Element | null {
  const { t } = useTranslation()
  if (schedules.length === 0 && !loading) return null

  const busyEmails = attendeeBusyAtSlot(schedules, slotStartIso, slotEndIso)

  return (
    <div className="space-y-1.5 rounded-lg border border-border/70 bg-secondary/20 px-3 py-2">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Users className="h-3.5 w-3.5" />
        {t('mail.scheduleMeeting.attendeeAvailability')}
        {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {schedules.map((row) => {
          const isBusy = busyEmails.includes(row.email)
          return (
            <span
              key={row.email}
              className={cn(
                'inline-flex max-w-full truncate rounded-full px-2 py-0.5 text-[10px] font-medium',
                isBusy
                  ? 'bg-destructive/15 text-destructive'
                  : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
              )}
              title={row.email}
            >
              {row.email.split('@')[0]}
              {isBusy ? ` · ${t('mail.scheduleMeeting.busy')}` : ` · ${t('mail.scheduleMeeting.free')}`}
            </span>
          )
        })}
      </div>
      {busyEmails.length > 0 ? (
        <p className="text-[11px] text-amber-600 dark:text-amber-400">
          {t('mail.scheduleMeeting.attendeeConflictHint', { count: busyEmails.length })}
        </p>
      ) : null}
    </div>
  )
}

export interface MailScheduleMeetingDialogProps {
  open: boolean
  suggestion: CalendarSuggestionFromMail
  accounts: ConnectedAccount[]
  onClose: () => void
}

export function MailScheduleMeetingDialog({
  open,
  suggestion,
  accounts,
  onClose
}: MailScheduleMeetingDialogProps): JSX.Element | null {
  const { t, i18n } = useTranslation()
  const dfLocale = i18n.language.startsWith('de') ? deFns : enUSFns
  const calSettings = useCalendarSettingsPrefs()
  const calendarRef = useRef<FullCalendar | null>(null)
  const calendarHostRef = useRef<HTMLDivElement | null>(null)

  const defaultAccountId = useMemo(() => {
    if (accounts.some((a) => a.id === suggestion.accountId)) return suggestion.accountId
    return accounts[0]?.id ?? suggestion.accountId
  }, [accounts, suggestion.accountId])

  const [accountId, setAccountId] = useState(defaultAccountId)
  const [subject, setSubject] = useState(suggestion.subject)
  const [attendeeInput, setAttendeeInput] = useState(() =>
    formatMeetingAttendeesForComposeInput(
      suggestion.attendeeEmails.map((address) => ({ address }))
    )
  )
  const [descriptionHtml, setDescriptionHtml] = useState(suggestion.bodyHtml)
  const [descriptionPlain, setDescriptionPlain] = useState(() =>
    suggestion.bodyHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  )
  const [teamsMeeting, setTeamsMeeting] = useState(true)
  const [durationMinutes, setDurationMinutes] = useState(() =>
    slotDurationMinutes(new Date(suggestion.startIso), new Date(suggestion.endIso))
  )
  const [slotStart, setSlotStart] = useState(() => new Date(suggestion.startIso))
  const [slotEnd, setSlotEnd] = useState(() => new Date(suggestion.endIso))
  const [weekEvents, setWeekEvents] = useState<CalendarEventView[]>([])
  const [eventsLoading, setEventsLoading] = useState(false)
  const [attendeeSchedules, setAttendeeSchedules] = useState<CalendarAttendeeScheduleView[]>([])
  const [schedulesLoading, setSchedulesLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [replyInThread, setReplyInThread] = useState(false)

  const selectedAccount = accounts.find((a) => a.id === accountId) ?? accounts[0]
  const isMicrosoft = selectedAccount?.provider === 'microsoft'

  const calendarsByAccount = useCalendarListByAccount(accounts)
  const calendarLinkedAccountIds = useMemo(() => accounts.map((a) => a.id), [accounts])
  const defaultGraphCalendarIdByAccount = useMemo(
    () => buildDefaultGraphCalendarIdByAccount(calendarLinkedAccountIds, calendarsByAccount),
    [calendarLinkedAccountIds, calendarsByAccount]
  )
  const calendarDisplayHexByKey = useMemo(
    () => buildCalendarDisplayHexByKey(calendarLinkedAccountIds, calendarsByAccount),
    [calendarLinkedAccountIds, calendarsByAccount]
  )

  const weekStart = useMemo(
    () => startOfWeek(slotStart, { weekStartsOn: 1 }),
    [slotStart]
  )
  const weekEnd = useMemo(() => addDays(weekStart, 7), [weekStart])

  const slotStartIso = slotStart.toISOString()
  const slotEndIso = slotEnd.toISOString()

  const hasConflict = useMemo(
    () => calendarSlotHasConflict(weekEvents, slotStartIso, slotEndIso),
    [weekEvents, slotStartIso, slotEndIso]
  )

  useEffect(() => {
    if (!open) return
    setAccountId(defaultAccountId)
    setSubject(suggestion.subject)
    setAttendeeInput(
      formatMeetingAttendeesForComposeInput(
        suggestion.attendeeEmails.map((address) => ({ address }))
      )
    )
    setDescriptionHtml(suggestion.bodyHtml)
    setDescriptionPlain(
      suggestion.bodyHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    )
    setTeamsMeeting(true)
    const start = new Date(suggestion.startIso)
    const end = new Date(suggestion.endIso)
    setSlotStart(start)
    setSlotEnd(end)
    setDurationMinutes(slotDurationMinutes(start, end))
    setError(null)
    setReplyInThread(false)
  }, [open, suggestion, defaultAccountId])

  useEffect(() => {
    if (!open || !accountId) return
    let cancelled = false
    setEventsLoading(true)
    void (async (): Promise<void> => {
      try {
        const linked = accounts.filter((a) => a.id === accountId)
        const includeCalendars = await buildCalendarIncludeCalendars(linked, calendarsByAccount)
        const events = await window.mailClient.calendar.listEvents({
          startIso: weekStart.toISOString(),
          endIso: weekEnd.toISOString(),
          focusCalendar: null,
          includeCalendars
        })
        if (!cancelled) setWeekEvents(events.filter((ev) => ev.accountId === accountId))
      } catch {
        if (!cancelled) setWeekEvents([])
      } finally {
        if (!cancelled) setEventsLoading(false)
      }
    })()
    return (): void => {
      cancelled = true
    }
  }, [open, accountId, accounts, calendarsByAccount, weekStart, weekEnd])

  const parsedAttendeeEmails = useMemo(
    () => parseRecipients(attendeeInput).map((r) => r.address),
    [attendeeInput]
  )

  useEffect(() => {
    if (!open || !isMicrosoft || parsedAttendeeEmails.length === 0) {
      setAttendeeSchedules([])
      return
    }
    let cancelled = false
    setSchedulesLoading(true)
    void safeGetAttendeeSchedule({
        accountId,
        attendeeEmails: parsedAttendeeEmails,
        startIso: weekStart.toISOString(),
        endIso: weekEnd.toISOString(),
        intervalMinutes: 30
      })
      .then((rows) => {
        if (!cancelled) setAttendeeSchedules(rows)
      })
      .catch(() => {
        if (!cancelled) setAttendeeSchedules([])
      })
      .finally(() => {
        if (!cancelled) setSchedulesLoading(false)
      })
    return (): void => {
      cancelled = true
    }
  }, [open, isMicrosoft, accountId, parsedAttendeeEmails, weekStart, weekEnd])

  const applySlot = useCallback((start: Date, end: Date): void => {
    setSlotStart(start)
    setSlotEnd(end)
    setDurationMinutes(slotDurationMinutes(start, end))
    queueMicrotask(() => calendarRef.current?.getApi()?.gotoDate(start))
  }, [])

  const applyDuration = useCallback(
    (minutes: number): void => {
      setDurationMinutes(minutes)
      setSlotEnd(addMinutes(slotStart, minutes))
    },
    [slotStart]
  )

  const loadFreeSlot = useCallback(
    async (picker: () => Promise<CalendarFreeSlot | null>): Promise<void> => {
      setError(null)
      try {
        const slot = await picker()
        if (!slot) {
          setError(t('mail.scheduleMeeting.noFreeSlot'))
          return
        }
        applySlot(new Date(slot.startIso), new Date(slot.endIso))
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      }
    },
    [applySlot, t]
  )

  const pickNextFree = useCallback(async (): Promise<void> => {
    await loadFreeSlot(async () => {
      const slots = await safeFindLocalFreeSlots({
        accountId,
        durationMinutes,
        rangeStartIso: new Date().toISOString(),
        rangeEndIso: addDays(new Date(), 14).toISOString(),
        maxResults: 1,
        notBeforeIso: new Date().toISOString()
      })
      return slots[0] ?? null
    })
  }, [accountId, durationMinutes, loadFreeSlot])

  const pickTodayAfternoon = useCallback(async (): Promise<void> => {
    await loadFreeSlot(async () => {
      const slots = await safeFindLocalFreeSlots({
        accountId,
        durationMinutes,
        rangeStartIso: startOfDay(new Date()).toISOString(),
        rangeEndIso: addDays(startOfDay(new Date()), 1).toISOString(),
        workingHoursStart: 12,
        workingHoursEnd: 18,
        maxResults: 1,
        notBeforeIso: new Date().toISOString()
      })
      return slots[0] ?? null
    })
  }, [accountId, durationMinutes, loadFreeSlot])

  const pickTomorrowMorning = useCallback(async (): Promise<void> => {
    await loadFreeSlot(async () => {
      const tomorrow = addDays(startOfDay(new Date()), 1)
      const slots = await safeFindLocalFreeSlots({
        accountId,
        durationMinutes,
        rangeStartIso: tomorrow.toISOString(),
        rangeEndIso: addDays(tomorrow, 1).toISOString(),
        workingHoursStart: 8,
        workingHoursEnd: 12,
        maxResults: 1
      })
      return slots[0] ?? null
    })
  }, [accountId, durationMinutes, loadFreeSlot])

  const pickForAllAttendees = useCallback(async (): Promise<void> => {
    if (!isMicrosoft) return
    setError(null)
    try {
      const slots = await safeFindMeetingTimes({
        accountId,
        attendeeEmails: parsedAttendeeEmails,
        durationMinutes,
        rangeStartIso: new Date().toISOString(),
        rangeEndIso: addDays(new Date(), 14).toISOString(),
        maxCandidates: 1
      })
      const slot = slots[0]
      if (!slot) {
        setError(t('mail.scheduleMeeting.noFreeSlotForAll'))
        return
      }
      applySlot(new Date(slot.startIso), new Date(slot.endIso))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [isMicrosoft, accountId, parsedAttendeeEmails, durationMinutes, applySlot, t])

  const existingFcEvents = useMemo((): EventInput[] => {
    const startMs = weekStart.getTime()
    const endMs = weekEnd.getTime()
    const ghostStart = slotStart.getTime()
    const ghostEnd = slotEnd.getTime()
    const out: EventInput[] = []
    for (const ev of weekEvents) {
      const s = Date.parse(ev.startIso)
      const e = Date.parse(ev.endIso)
      if (!Number.isFinite(s) || !Number.isFinite(e)) continue
      if (s >= endMs || e <= startMs) continue
      if (Math.abs(s - ghostStart) < 60_000 && Math.abs(e - ghostEnd) < 60_000) continue
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
    weekEvents,
    weekStart,
    weekEnd,
    slotStart,
    slotEnd,
    defaultGraphCalendarIdByAccount,
    calendarDisplayHexByKey
  ])

  const ghostEvent = useMemo((): EventInput => {
    return {
      id: MAIL_SCHEDULE_GHOST_EVENT_ID,
      title: subject.trim() || t('mail.scheduleMeeting.ghostTitle'),
      start: slotStart,
      end: slotEnd,
      classNames: ['meeting-invitation-preview-event', hasConflict ? 'mail-schedule-conflict' : ''],
      extendedProps: { isMailScheduleGhost: true },
      editable: true,
      durationEditable: true,
      startEditable: true
    }
  }, [subject, slotStart, slotEnd, hasConflict, t])

  const fcEvents = useMemo(
    () => [...existingFcEvents, ghostEvent],
    [existingFcEvents, ghostEvent]
  )

  const onSelect = useCallback(
    (sel: DateSelectArg): void => {
      if (sel.allDay) return
      applySlot(sel.start, sel.end)
      queueMicrotask(() => calendarRef.current?.getApi()?.unselect())
    },
    [applySlot]
  )

  const onEventChange = useCallback(
    (info: { event: { id: string; start: Date | null; end: Date | null } }): void => {
      if (info.event.id !== MAIL_SCHEDULE_GHOST_EVENT_ID) return
      if (!info.event.start || !info.event.end) return
      applySlot(info.event.start, info.event.end)
    },
    [applySlot]
  )

  const eventDidMount = useCallback(
    (info: {
      el: HTMLElement
      event: { id: string; extendedProps: Record<string, unknown> }
    }): void => {
      if (info.event.id === MAIL_SCHEDULE_GHOST_EVENT_ID) return
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

  const fcLocale = i18n.language.startsWith('de') ? deLocale : enGbLocale

  async function handleSend(): Promise<void> {
    if (!subject.trim()) {
      setError(t('mail.scheduleMeeting.subjectRequired'))
      return
    }
    const attendees = parseRecipients(attendeeInput).map((r) => r.address)
    setBusy(true)
    setError(null)
    try {
      const created = await window.mailClient.calendar.createEvent({
        accountId,
        graphCalendarId: null,
        subject: subject.trim(),
        startIso: slotStartIso,
        endIso: slotEndIso,
        isAllDay: false,
        bodyHtml: descriptionHtml.trim() || null,
        attendeeEmails: attendees.length > 0 ? attendees : null,
        teamsMeeting: isMicrosoft && teamsMeeting
      })

      const graphEventId = created.id?.trim()
      if (graphEventId) {
        try {
          await window.mailClient.entityLinks.add({
            a: { kind: 'mail', messageId: suggestion.messageId },
            b: { kind: 'calendar_event', accountId, graphEventId }
          })
        } catch {
          // Verknuepfung optional — Termin ist angelegt
        }
      }

      if (replyInThread) {
        const full = await window.mailClient.mail.getMessage(suggestion.messageId)
        if (full) {
          const openReply = useComposeStore.getState().openReply
          openReply('replyAll', full as MailFull)
          const activeId = useComposeStore.getState().activeId
          if (activeId) {
            const when = format(parseISO(slotStartIso), 'PPp', { locale: dfLocale })
            useComposeStore.getState().update(activeId, {
              prependRichHtml: `<p>${t('mail.scheduleMeeting.replyBody', {
                subject: subject.trim(),
                when
              })}</p>`
            })
          }
        }
      }

      useUndoStore.getState().pushToast({
        label: t('mail.scheduleMeeting.sent'),
        variant: 'success'
      })
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  if (!open) return null

  const bookWithMeUrl = selectedAccount?.bookWithMeUrl?.trim()

  return (
    <ModalRoot open={open} zIndex={320} centerClassName="items-center justify-center" onBackdropClick={onClose}>
      <ModalPanel
        className="flex max-h-[92vh] w-[min(960px,calc(100vw-24px))] flex-col overflow-hidden rounded-xl border border-border bg-card p-0 shadow-2xl"
        aria-labelledby="mail-schedule-meeting-title"
        onClick={(e): void => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <CalendarClock className="h-5 w-5 shrink-0 text-emerald-500" />
            <h2 id="mail-schedule-meeting-title" className="truncate text-sm font-semibold">
              {t('mail.scheduleMeeting.title')}
            </h2>
          </div>
          <button
            type="button"
            className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
            onClick={onClose}
            aria-label={t('common.close')}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="rounded-full border border-border px-2.5 py-1 text-[11px] font-medium hover:bg-secondary/70"
              onClick={(): void => void pickNextFree()}
            >
              {t('mail.scheduleMeeting.chipNextFree')}
            </button>
            <button
              type="button"
              className="rounded-full border border-border px-2.5 py-1 text-[11px] font-medium hover:bg-secondary/70"
              onClick={(): void => void pickTodayAfternoon()}
            >
              {t('mail.scheduleMeeting.chipTodayAfternoon')}
            </button>
            <button
              type="button"
              className="rounded-full border border-border px-2.5 py-1 text-[11px] font-medium hover:bg-secondary/70"
              onClick={(): void => void pickTomorrowMorning()}
            >
              {t('mail.scheduleMeeting.chipTomorrowMorning')}
            </button>
            {isMicrosoft && parsedAttendeeEmails.length > 0 ? (
              <button
                type="button"
                className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300"
                onClick={(): void => void pickForAllAttendees()}
              >
                {t('mail.scheduleMeeting.chipForAll')}
              </button>
            ) : null}
            <div className="ml-auto flex items-center gap-1">
              <span className="text-[10px] text-muted-foreground">{t('mail.scheduleMeeting.duration')}</span>
              {DURATION_OPTIONS.map((min) => (
                <button
                  key={min}
                  type="button"
                  className={cn(
                    'rounded-full px-2 py-0.5 text-[10px] font-medium',
                    durationMinutes === min
                      ? 'bg-primary text-primary-foreground'
                      : 'border border-border hover:bg-secondary/70'
                  )}
                  onClick={(): void => applyDuration(min)}
                >
                  {min} min
                </button>
              ))}
            </div>
          </div>

          <div
            ref={calendarHostRef}
            className={cn(
              'meeting-invitation-day-preview relative mb-3 overflow-hidden rounded-lg border border-border/80',
              eventsLoading ? 'opacity-70' : ''
            )}
          >
            <div className="h-[280px] min-h-[240px]">
              <FullCalendar
                ref={calendarRef}
                plugins={[timeGridPlugin, interactionPlugin, luxonPlugin]}
                initialView="timeGridWeek"
                initialDate={weekStart}
                headerToolbar={{
                  left: 'prev,next today',
                  center: 'title',
                  right: ''
                }}
                firstDay={1}
                allDaySlot
                slotMinTime="06:00:00"
                slotMaxTime="22:00:00"
                scrollTime={`${String(slotStart.getHours()).padStart(2, '0')}:${String(Math.max(0, slotStart.getMinutes() - 30)).padStart(2, '0')}:00`}
                height="100%"
                locale={fcLocale}
                events={fcEvents}
                selectable
                selectMirror
                select={onSelect}
                eventChange={onEventChange}
                eventDidMount={eventDidMount}
                nowIndicator
                editable
                eventStartEditable
                eventDurationEditable
                {...timeGridFcSlotOpts}
              />
            </div>
            {hasConflict ? (
              <div className="absolute bottom-2 left-2 flex items-center gap-1 rounded-md bg-amber-500/15 px-2 py-1 text-[11px] font-medium text-amber-700 dark:text-amber-300">
                <AlertTriangle className="h-3.5 w-3.5" />
                {t('mail.scheduleMeeting.conflict')}
              </div>
            ) : null}
          </div>

          <AttendeeAvailabilityStrip
            schedules={attendeeSchedules}
            slotStartIso={slotStartIso}
            slotEndIso={slotEndIso}
            loading={schedulesLoading}
          />

          <div className="mt-3 space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                {t('mail.scheduleMeeting.account')}
              </label>
              <select
                className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                value={accountId}
                onChange={(e): void => setAccountId(e.target.value)}
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.email ?? a.displayName ?? a.id}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">
                {t('mail.scheduleMeeting.subject')}
              </label>
              <input
                className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                value={subject}
                onChange={(e): void => setSubject(e.target.value)}
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">
                {t('mail.scheduleMeeting.attendees')}
              </label>
              <div className="mt-1">
                <RecipientTokenField
                  hideLabelColumn
                  label={t('mail.scheduleMeeting.attendees')}
                  value={attendeeInput}
                  onChange={setAttendeeInput}
                  accountId={accountId}
                />
              </div>
            </div>

            {isMicrosoft ? (
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={teamsMeeting}
                  onChange={(e): void => setTeamsMeeting(e.target.checked)}
                  className="rounded border-border"
                />
                <Video className="h-4 w-4 text-sky-500" />
                {t('mail.scheduleMeeting.teamsMeeting')}
              </label>
            ) : null}

            <div>
              <label className="text-xs font-medium text-muted-foreground">
                {t('mail.scheduleMeeting.description')}
              </label>
              <textarea
                className="mt-1 min-h-[72px] w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                value={descriptionPlain}
                onChange={(e): void => {
                  const plain = e.target.value
                  setDescriptionPlain(plain)
                  setDescriptionHtml(
                    `<p>${plain.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')}</p>`
                  )
                }}
              />
            </div>

            <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={replyInThread}
                onChange={(e): void => setReplyInThread(e.target.checked)}
                className="rounded border-border"
              />
              {t('mail.scheduleMeeting.replyInThread')}
            </label>

            {bookWithMeUrl ? (
              <p className="text-[11px] text-muted-foreground">
                {t('mail.scheduleMeeting.bookWithMeHint')}{' '}
                <a
                  href={bookWithMeUrl}
                  className="text-primary underline"
                  onClick={(e): void => {
                    e.preventDefault()
                    void openExternalUrl(bookWithMeUrl)
                  }}
                >
                  {t('mail.scheduleMeeting.bookWithMeLink')}
                </a>
              </p>
            ) : null}

            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border px-4 py-3">
          <button
            type="button"
            className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-secondary"
            onClick={onClose}
            disabled={busy}
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
            onClick={(): void => void handleSend()}
            disabled={busy}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {t('mail.scheduleMeeting.sendInvite')}
          </button>
        </div>
      </ModalPanel>
    </ModalRoot>
  )
}
