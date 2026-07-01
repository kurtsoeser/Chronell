import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import luxonPlugin from '@fullcalendar/luxon'
import { resolveFullCalendarLocale, deLocale, enGbLocale } from '@/lib/fullcalendar-locale'
import type { DatesSetArg, EventInput } from '@fullcalendar/core'
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { BookingsAppointmentRow } from '@shared/types'
import { viewIdToLabel } from '@/app/calendar/calendar-shell-view-helpers'
import { useLocaleStore } from '@/stores/locale'
import { moduleColumnHeaderDockBarRowClass } from '@/components/ModuleColumnHeader'
import { cn } from '@/lib/utils'
import '@/app/calendar/notion-calendar.css'

/** Standard-Körperhöhe in scrollbarem Detail-Panel (kein height:100%). */
const DEFAULT_CALENDAR_BODY_HEIGHT_PX = 400

const BOOKINGS_FC_VIEWS = ['timeGridWeek', 'dayGridMonth'] as const
type BookingsFcView = (typeof BOOKINGS_FC_VIEWS)[number]

export interface BookingsWeekCalendarProps {
  appointments: BookingsAppointmentRow[]
  selectedAppointmentId?: string | null
  onSelectAppointment?: (appointment: BookingsAppointmentRow) => void
  /** Körperhöhe in px (Shell: ~800 für 2-Spalten-Layout). */
  bodyHeightPx?: number
  className?: string
}

function BookingsCalendarToolbar({
  calendarRef,
  calendarTitle,
  activeFcView,
  onActiveFcViewChange
}: {
  calendarRef: React.RefObject<FullCalendar | null>
  calendarTitle: string
  activeFcView: BookingsFcView
  onActiveFcViewChange: (viewId: BookingsFcView) => void
}): JSX.Element {
  const { t } = useTranslation()
  const [viewMenuOpen, setViewMenuOpen] = useState(false)
  const viewMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!viewMenuOpen) return
    function onDown(e: MouseEvent): void {
      if (viewMenuRef.current?.contains(e.target as Node)) return
      setViewMenuOpen(false)
    }
    window.addEventListener('mousedown', onDown)
    return (): void => window.removeEventListener('mousedown', onDown)
  }, [viewMenuOpen])

  const changeView = (viewId: BookingsFcView): void => {
    onActiveFcViewChange(viewId)
    const api = calendarRef.current?.getApi()
    api?.changeView(viewId)
    window.requestAnimationFrame(() => api?.updateSize())
    setViewMenuOpen(false)
  }

  return (
    <div className={cn(moduleColumnHeaderDockBarRowClass, 'shrink-0 border-b border-border bg-card')}>
      <div className="flex min-w-0 flex-1 items-center gap-0.5">
        <button
          type="button"
          onClick={(): void => {
            const api = calendarRef.current?.getApi()
            api?.prev()
            window.requestAnimationFrame(() => api?.updateSize())
          }}
          className="rounded p-1 text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
          aria-label={t('tasks.shell.calendarPrev')}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={(): void => {
            const api = calendarRef.current?.getApi()
            api?.today()
            window.requestAnimationFrame(() => api?.updateSize())
          }}
          className="rounded px-2 py-0.5 text-[10px] font-medium text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
        >
          {t('tasks.shell.calendarToday')}
        </button>
        <button
          type="button"
          onClick={(): void => {
            const api = calendarRef.current?.getApi()
            api?.next()
            window.requestAnimationFrame(() => api?.updateSize())
          }}
          className="rounded p-1 text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
          aria-label={t('tasks.shell.calendarNext')}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <span className="min-w-0 truncate font-semibold text-foreground">{calendarTitle}</span>
      </div>
      <div className="relative shrink-0" ref={viewMenuRef}>
        <button
          type="button"
          onClick={(): void => setViewMenuOpen((o) => !o)}
          className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[10px] font-medium hover:bg-secondary/60"
        >
          {viewIdToLabel(activeFcView, t)}
          <ChevronDown className={cn('h-3 w-3', viewMenuOpen && 'rotate-180')} />
        </button>
        {viewMenuOpen ? (
          <div className="absolute right-0 top-full z-30 mt-1 min-w-[9rem] chronell-acrylic-popover py-1">
            {BOOKINGS_FC_VIEWS.map((id) => (
              <button
                key={id}
                type="button"
                onClick={(): void => changeView(id)}
                className={cn(
                  'block w-full px-3 py-1.5 text-left text-xs hover:bg-secondary/70',
                  id === activeFcView && 'bg-secondary font-medium'
                )}
              >
                {viewIdToLabel(id, t)}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}

export function BookingsWeekCalendar({
  appointments,
  selectedAppointmentId = null,
  onSelectAppointment,
  bodyHeightPx = DEFAULT_CALENDAR_BODY_HEIGHT_PX,
  className
}: BookingsWeekCalendarProps): JSX.Element {
  const { i18n } = useTranslation()
  const appLocale = useLocaleStore((s) => s.locale)
  const fcLocale = resolveFullCalendarLocale(appLocale)
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone

  const calendarRef = useRef<FullCalendar | null>(null)
  const shellRef = useRef<HTMLDivElement>(null)
  const [activeFcView, setActiveFcView] = useState<BookingsFcView>('timeGridWeek')
  const [calendarTitle, setCalendarTitle] = useState('')

  const appointmentById = useMemo(() => new Map(appointments.map((a) => [a.id, a])), [appointments])

  const events = useMemo((): EventInput[] => {
    return appointments.map((a) => ({
      id: a.id,
      title: [a.serviceName, a.customerName].filter(Boolean).join(' · ') || 'Termin',
      start: a.startIso,
      end: a.endIso,
      classNames: ['fc-booking-appointment'],
      extendedProps: { bookingAppointmentId: a.id }
    }))
  }, [appointments])

  const refreshCalendarSize = useCallback((): void => {
    calendarRef.current?.getApi()?.updateSize()
  }, [])

  useLayoutEffect(() => {
    const el = shellRef.current
    if (!el) return
    refreshCalendarSize()
    const ro = new ResizeObserver(() => {
      refreshCalendarSize()
    })
    ro.observe(el)
    return (): void => ro.disconnect()
  }, [refreshCalendarSize])

  useEffect(() => {
    refreshCalendarSize()
  }, [appointments, activeFcView, bodyHeightPx, refreshCalendarSize])

  const onDatesSet = useCallback((arg: DatesSetArg): void => {
    setCalendarTitle(arg.view.title)
    window.requestAnimationFrame(() => arg.view.calendar.updateSize())
  }, [])

  const styleBookingEvent = useCallback((el: HTMLElement): void => {
    el.style.backgroundColor = 'hsl(var(--primary))'
    el.style.borderColor = 'transparent'
    el.style.color = 'hsl(var(--primary-foreground))'
  }, [])

  return (
    <div
      className={cn(
        'flex flex-col overflow-hidden rounded-md border border-border bg-card',
        className
      )}
    >
      <BookingsCalendarToolbar
        calendarRef={calendarRef}
        calendarTitle={calendarTitle}
        activeFcView={activeFcView}
        onActiveFcViewChange={setActiveFcView}
      />
      <div
        ref={shellRef}
        className="calendar-notion-shell bookings-embedded-calendar cal-slot-30 w-full shrink-0 bg-background text-foreground"
        style={{ height: bodyHeightPx }}
      >
        <FullCalendar
          key={`${timeZone}-${i18n.language}`}
          ref={calendarRef}
          plugins={[timeGridPlugin, dayGridPlugin, interactionPlugin, luxonPlugin]}
          locales={[deLocale, enGbLocale]}
          locale={fcLocale}
          timeZone={timeZone}
          height={bodyHeightPx}
          headerToolbar={false}
          initialView={activeFcView}
          firstDay={1}
          slotMinTime="00:00:00"
          slotMaxTime="24:00:00"
          scrollTime="07:00:00"
          slotDuration="00:30:00"
          slotLabelInterval="01:00:00"
          allDaySlot={false}
          nowIndicator
          editable={false}
          selectable={false}
          dayMaxEvents
          events={events}
          datesSet={onDatesSet}
          eventClick={(info): void => {
            info.jsEvent.preventDefault()
            const id =
              typeof info.event.extendedProps.bookingAppointmentId === 'string'
                ? info.event.extendedProps.bookingAppointmentId
                : info.event.id
            const row = appointmentById.get(id)
            if (row) onSelectAppointment?.(row)
          }}
          eventDidMount={(info): void => {
            if (!info.event.classNames.includes('fc-booking-appointment')) return
            styleBookingEvent(info.el)
            const id =
              typeof info.event.extendedProps.bookingAppointmentId === 'string'
                ? info.event.extendedProps.bookingAppointmentId
                : info.event.id
            if (selectedAppointmentId && id === selectedAppointmentId) {
              info.el.classList.add('ring-2', 'ring-primary')
            }
          }}
        />
      </div>
    </div>
  )
}
