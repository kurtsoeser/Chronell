import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Locale } from 'date-fns'
import { addDays, format, parseISO, startOfDay } from 'date-fns'
import { CalendarDays, Loader2, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { CalendarEventView, ConnectedAccount } from '@shared/types'
import { buildNoteMeetingInsertHtml, resolveNoteMeetingJoinUrl } from '@shared/note-meeting-insert-html'
import { ChronellDateField } from '@/components/ChronellDateField'
import { ModalPanel, ModalRoot } from '@/components/motion/Modal'
import { useDateFnsLocale } from '@/lib/date-fns-locale'
import { cn } from '@/lib/utils'

function formatEventRangeLabel(
  ev: CalendarEventView,
  locale: Locale,
  allDaySuffix: string
): string {
  const start = parseISO(ev.startIso)
  const end = parseISO(ev.endIso)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return `${ev.startIso} – ${ev.endIso}`
  }
  if (ev.isAllDay) {
    const a = format(start, 'PPP', { locale })
    const b = format(addDays(end, -1), 'PPP', { locale })
    if (a === b) return `${a} ${allDaySuffix}`
    return `${a} – ${b} ${allDaySuffix}`
  }
  if (format(start, 'yyyy-MM-dd') === format(end, 'yyyy-MM-dd')) {
    return `${format(start, 'EEE, d. MMM yyyy', { locale })} · ${format(start, 'HH:mm')} – ${format(end, 'HH:mm')}`
  }
  return `${format(start, 'Pp', { locale })} – ${format(end, 'Pp', { locale })}`
}

function formatEventTimeShort(ev: CalendarEventView, locale: Locale, allDaySuffix: string): string {
  const start = parseISO(ev.startIso)
  if (Number.isNaN(start.getTime())) return ''
  if (ev.isAllDay) return allDaySuffix
  return format(start, 'HH:mm', { locale })
}

function calendarLinkedAccounts(accounts: ConnectedAccount[]): ConnectedAccount[] {
  return accounts.filter((a) => a.provider === 'microsoft' || a.provider === 'google')
}

export interface NoteMeetingInsertResult {
  event: CalendarEventView
  linkToEvent: boolean
  scheduleNote: boolean
}

export function NoteMeetingInsertDialog({
  open,
  accounts,
  onClose,
  onInsert
}: {
  open: boolean
  accounts: ConnectedAccount[]
  onClose: () => void
  onInsert: (result: NoteMeetingInsertResult, html: string) => void | Promise<void>
}): JSX.Element | null {
  const { t } = useTranslation()
  const dfLocale = useDateFnsLocale()
  const linkedAccounts = useMemo(() => calendarLinkedAccounts(accounts), [accounts])

  const [accountId, setAccountId] = useState('')
  const [dayYmd, setDayYmd] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [events, setEvents] = useState<CalendarEventView[]>([])
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [loadingEvents, setLoadingEvents] = useState(false)
  const [inserting, setInserting] = useState(false)
  const [linkToEvent, setLinkToEvent] = useState(true)
  const [scheduleNote, setScheduleNote] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    const first = linkedAccounts[0]?.id ?? ''
    setAccountId(first)
    setDayYmd(format(new Date(), 'yyyy-MM-dd'))
    setSelectedEventId(null)
    setEvents([])
    setLinkToEvent(true)
    setScheduleNote(false)
    setLoadError(null)
  }, [open, linkedAccounts])

  const selectedDay = useMemo(() => {
    const d = parseISO(`${dayYmd}T12:00:00`)
    return Number.isNaN(d.getTime()) ? startOfDay(new Date()) : startOfDay(d)
  }, [dayYmd])

  const loadEvents = useCallback(async (): Promise<void> => {
    if (!accountId) {
      setEvents([])
      return
    }
    setLoadingEvents(true)
    setLoadError(null)
    try {
      const dayStart = startOfDay(selectedDay)
      const dayEndExcl = addDays(dayStart, 1)
      const rows = await window.mailClient.calendar.listEvents({
        startIso: dayStart.toISOString(),
        endIso: dayEndExcl.toISOString()
      })
      const filtered = rows
        .filter((ev) => ev.accountId === accountId)
        .sort((a, b) => Date.parse(a.startIso) - Date.parse(b.startIso))
      setEvents(filtered)
      setSelectedEventId((prev) =>
        prev && filtered.some((ev) => ev.id === prev) ? prev : (filtered[0]?.id ?? null)
      )
    } catch {
      setEvents([])
      setLoadError(t('notes.meetingInsert.loadFailed'))
    } finally {
      setLoadingEvents(false)
    }
  }, [accountId, selectedDay, t])

  useEffect(() => {
    if (!open || !accountId) return
    void loadEvents()
  }, [open, accountId, dayYmd, loadEvents])

  const selectedEvent = useMemo(
    () => events.find((ev) => ev.id === selectedEventId) ?? null,
    [events, selectedEventId]
  )

  async function fetchEventDetails(forceRefresh = false) {
    return window.mailClient.calendar.getEvent({
      accountId: selectedEvent!.accountId,
      graphEventId: selectedEvent!.graphEventId!,
      graphCalendarId: selectedEvent!.graphCalendarId ?? null,
      forceRefresh
    })
  }

  async function handleInsert(): Promise<void> {
    if (!selectedEvent?.graphEventId?.trim()) return
    setInserting(true)
    try {
      let details = null
      try {
        details = await fetchEventDetails(false)
      } catch {
        details = null
      }

      if (!resolveNoteMeetingJoinUrl(selectedEvent, details)) {
        try {
          details = await fetchEventDetails(true)
        } catch {
          // behalten was wir haben
        }
      }

      const whenLabel = formatEventRangeLabel(
        selectedEvent,
        dfLocale,
        t('notes.meetingInsert.allDay')
      )
      const html = buildNoteMeetingInsertHtml({
        event: selectedEvent,
        details,
        whenLabel,
        labels: {
          date: t('notes.meetingInsert.fieldDate'),
          location: t('notes.meetingInsert.fieldLocation'),
          organizer: t('notes.meetingInsert.fieldOrganizer'),
          attendees: t('notes.meetingInsert.fieldAttendees'),
          onlineMeeting: t('notes.meetingInsert.fieldOnlineMeeting'),
          joinMeeting: t('notes.meetingInsert.joinMeeting'),
          agenda: t('notes.meetingInsert.agenda'),
          notes: t('notes.meetingInsert.notes'),
          nextSteps: t('notes.meetingInsert.nextSteps')
        }
      })

      await onInsert(
        { event: selectedEvent, linkToEvent, scheduleNote },
        html
      )
      onClose()
    } finally {
      setInserting(false)
    }
  }

  if (!open) return null

  const noAccounts = linkedAccounts.length === 0

  return (
    <ModalRoot open={open} zIndex={320} overlayClassName="p-4" onBackdropClick={onClose}>
      <ModalPanel
        aria-labelledby="note-meeting-insert-title"
        className="chronell-dialog-panel flex max-h-[min(560px,92vh)] w-full max-w-lg flex-col overflow-hidden text-popover-foreground"
      >
        <header className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-3">
          <h2 id="note-meeting-insert-title" className="flex items-center gap-2 text-sm font-semibold">
            <CalendarDays className="h-4 w-4 text-primary" aria-hidden />
            {t('notes.meetingInsert.title')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
            aria-label={t('common.close')}
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          {noAccounts ? (
            <p className="text-sm text-muted-foreground">{t('notes.meetingInsert.noAccounts')}</p>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-xs">
                  <span className="font-medium text-muted-foreground">
                    {t('notes.meetingInsert.account')}
                  </span>
                  <select
                    value={accountId}
                    onChange={(e): void => setAccountId(e.target.value)}
                    className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                    disabled={inserting}
                  >
                    {linkedAccounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.email}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-xs">
                  <span className="font-medium text-muted-foreground">
                    {t('notes.meetingInsert.day')}
                  </span>
                  <ChronellDateField
                    value={dayYmd}
                    onChange={setDayYmd}
                    disabled={inserting}
                  />
                </label>
              </div>

              <div className="space-y-1">
                <div className="text-xs font-medium text-muted-foreground">
                  {t('notes.meetingInsert.eventsHeading')}
                </div>
                {loadingEvents ? (
                  <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    {t('notes.meetingInsert.loadingEvents')}
                  </div>
                ) : loadError ? (
                  <p className="text-sm text-destructive">{loadError}</p>
                ) : events.length === 0 ? (
                  <p className="py-4 text-sm text-muted-foreground">
                    {t('notes.meetingInsert.noEvents')}
                  </p>
                ) : (
                  <ul className="max-h-52 space-y-1 overflow-y-auto rounded-md border border-border p-1">
                    {events.map((ev) => {
                      const selected = ev.id === selectedEventId
                      return (
                        <li key={ev.id}>
                          <button
                            type="button"
                            onClick={(): void => setSelectedEventId(ev.id)}
                            className={cn(
                              'flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors',
                              selected
                                ? 'bg-primary/10 text-foreground ring-1 ring-primary/30'
                                : 'hover:bg-secondary/80'
                            )}
                          >
                            <span className="w-12 shrink-0 tabular-nums text-muted-foreground">
                              {formatEventTimeShort(ev, dfLocale, t('notes.meetingInsert.allDay'))}
                            </span>
                            <span className="min-w-0 flex-1 truncate font-medium">{ev.title}</span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>

              <div className="space-y-2 border-t border-border/60 pt-3 text-sm">
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={linkToEvent}
                    onChange={(e): void => setLinkToEvent(e.target.checked)}
                    disabled={inserting}
                    className="rounded border-border"
                  />
                  <span>{t('notes.meetingInsert.linkToEvent')}</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={scheduleNote}
                    onChange={(e): void => setScheduleNote(e.target.checked)}
                    disabled={inserting}
                    className="rounded border-border"
                  />
                  <span>{t('notes.meetingInsert.scheduleNote')}</span>
                </label>
              </div>
            </>
          )}
        </div>

        <footer className="flex shrink-0 justify-end gap-2 border-t border-border px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            disabled={inserting}
            className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-secondary disabled:opacity-50"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={(): void => void handleInsert()}
            disabled={inserting || noAccounts || !selectedEvent}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {inserting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            {t('notes.meetingInsert.insert')}
          </button>
        </footer>
      </ModalPanel>
    </ModalRoot>
  )
}
