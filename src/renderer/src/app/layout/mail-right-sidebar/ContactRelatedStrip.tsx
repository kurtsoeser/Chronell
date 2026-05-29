import { useEffect, useMemo, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { de, enUS } from 'date-fns/locale'
import { useTranslation } from 'react-i18next'
import { Calendar, ChevronRight, Loader2 } from 'lucide-react'
import type { CalendarEventView } from '@shared/types'
import { previewDetailPanelClass } from '@/lib/chronell-ui-classes'
import { cn } from '@/lib/utils'
import { useAppModeStore } from '@/stores/app-mode'
import { useCalendarPendingFocusStore } from '@/stores/calendar-pending-focus'

const MAX_EVENTS = 3
const PAST_DAYS = 14
const FUTURE_DAYS = 120

function formatEventWhen(ev: CalendarEventView, locale: typeof de): string {
  const start = parseISO(ev.startIso)
  const end = parseISO(ev.endIso)
  if (Number.isNaN(start.getTime())) return ''
  if (ev.isAllDay) {
    return format(start, 'EEE d. MMM', { locale })
  }
  if (!Number.isNaN(end.getTime()) && format(start, 'yyyy-MM-dd') === format(end, 'yyyy-MM-dd')) {
    return `${format(start, 'EEE d. MMM · HH:mm', { locale })}`
  }
  return format(start, 'Pp', { locale })
}

interface Props {
  contactEmails: string[]
}

export function ContactRelatedStrip({ contactEmails }: Props): JSX.Element | null {
  const { t, i18n } = useTranslation()
  const dfLocale = i18n.language.startsWith('de') ? de : enUS
  const setAppMode = useAppModeStore((s) => s.setMode)
  const queueFocusEvent = useCalendarPendingFocusStore((s) => s.queueFocusEvent)

  const [events, setEvents] = useState<CalendarEventView[]>([])
  const [loading, setLoading] = useState(false)

  const emailKey = useMemo(() => contactEmails.map((e) => e.toLowerCase()).sort().join('|'), [contactEmails])

  useEffect(() => {
    if (!emailKey) {
      setEvents([])
      return
    }
    let cancelled = false
    setLoading(true)
    const now = new Date()
    const start = new Date(now)
    start.setDate(start.getDate() - PAST_DAYS)
    const end = new Date(now)
    end.setDate(end.getDate() + FUTURE_DAYS)
    void (async (): Promise<void> => {
      try {
        const rows = await window.mailClient.calendar.listEventsForContact({
          emails: contactEmails,
          startIso: start.toISOString(),
          endIso: end.toISOString(),
          limit: 12
        })
        if (cancelled) return
        const nowMs = Date.now()
        const upcoming = rows
          .filter((ev) => {
            const endMs = Date.parse(ev.endIso)
            return !Number.isNaN(endMs) && endMs >= nowMs - 60 * 60 * 1000
          })
          .sort((a, b) => Date.parse(a.startIso) - Date.parse(b.startIso))
        setEvents(upcoming.slice(0, MAX_EVENTS))
      } catch {
        if (!cancelled) setEvents([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [contactEmails, emailKey])

  if (!emailKey) return null
  if (!loading && events.length === 0) return null

  return (
    <div className={cn('mx-3 mb-1.5 shrink-0', previewDetailPanelClass)}>
      <div className="chronell-type-section-label flex items-center gap-1 px-2 py-1 text-muted-foreground">
        <Calendar className="h-2.5 w-2.5 shrink-0" aria-hidden />
        {t('mail.rightSidebar.contactRelatedCalendar')}
      </div>
      {loading ? (
        <div className="flex items-center gap-1.5 px-2 py-1.5 text-2xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
          {t('mail.rightSidebar.contactRelatedLoading')}
        </div>
      ) : (
        <ul className="divide-y divide-white/[0.04] dark:divide-white/[0.04]">
          {events.map((ev) => (
            <li key={ev.id}>
              <button
                type="button"
                className="flex w-full items-start gap-1.5 px-2 py-1.5 text-left hover:bg-secondary/40"
                onClick={(): void => {
                  queueFocusEvent(ev)
                  setAppMode('calendar')
                }}
              >
                <span
                  className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{
                    backgroundColor: ev.displayColorHex ?? 'var(--primary)'
                  }}
                  aria-hidden
                />
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-1 text-2xs font-medium leading-tight text-foreground">
                    {ev.title?.trim() || t('mail.inboxCal.noTitle')}
                  </span>
                  <span className="text-3xs text-muted-foreground">
                    {formatEventWhen(ev, dfLocale)}
                  </span>
                </span>
                <ChevronRight className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        className="w-full border-t border-white/[0.04] px-2 py-1 text-left text-3xs font-medium text-primary hover:bg-secondary/30 dark:border-white/[0.04]"
        onClick={(): void => setAppMode('calendar')}
      >
        {t('mail.rightSidebar.contactRelatedOpenCalendar')}
      </button>
    </div>
  )
}
