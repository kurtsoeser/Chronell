import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type Ref
} from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import listPlugin from '@fullcalendar/list'
import interactionPlugin from '@fullcalendar/interaction'
import luxonPlugin from '@fullcalendar/luxon'
import { resolveFullCalendarLocale, deLocale, enGbLocale } from '@/lib/fullcalendar-locale'
import type { EventDropArg } from '@fullcalendar/core'
import type { EventResizeDoneArg } from '@fullcalendar/interaction'
import { useTranslation } from 'react-i18next'
import type { UserNoteListItem } from '@shared/types'
import { notesForNavSelection, type NotesNavSelection } from '@/lib/notes-nav-selection'
import { notesForMiniCalendarRange } from '@/app/notes/shell/notes-shell-date-range'
import type { MiniMonthSelectedRange } from '@/app/calendar/MiniMonthGrid'
import { cn } from '@/lib/utils'
import {
  CALENDAR_KIND_USER_NOTE,
  computePersistTargetForUserNote,
  type NotesCalendarDateMode,
  notesToFullCalendarEvents,
  userNoteEventId
} from '@/app/calendar/notes-calendar'
import { scheduleRemoveDuplicateFullCalendarEventsById } from '@/app/calendar/calendar-fc-event-source'
import { MAX_TIME_GRID_SPAN_DAYS } from '@/app/calendar/calendar-shell-view-helpers'
import { useCalendarFcEventContent } from '@/app/calendar/use-calendar-fc-event-content'
import { timeGridFcSnapOptions } from '@/app/calendar/calendar-shell-storage'
import { useNotesSettingsPrefs } from '@/lib/use-notes-settings-prefs'
import { resolveNotesCalendarDisplayPrefs } from '@/lib/notes-calendar-display'
import { NotesCalendarEventHoverPreview } from '@/app/notes/NotesCalendarEventHoverPreview'
import '@/app/calendar/notion-calendar.css'

const HOVER_PREVIEW_DELAY_MS = 220

function assignMergedFullCalendarRef(
  inst: FullCalendar | null,
  inner: MutableRefObject<FullCalendar | null>,
  outer?: Ref<FullCalendar | null>
): void {
  inner.current = inst
  if (!outer) return
  if (typeof outer === 'function') {
    outer(inst)
    return
  }
  ;(outer as MutableRefObject<FullCalendar | null>).current = inst
}

export function NotesCalendarPane({
  onPreviewNote,
  onOpenNoteInList,
  fcView,
  fullCalendarRef,
  onViewMeta,
  previewNoteId,
  dateMode,
  navSelection,
  miniCalendarRange,
  className
}: {
  onPreviewNote: (note: UserNoteListItem) => void
  onOpenNoteInList: (note: UserNoteListItem) => void
  fcView: string
  fullCalendarRef?: Ref<FullCalendar | null>
  onViewMeta?: (meta: { title: string; viewType: string; currentStart: Date }) => void
  previewNoteId?: number | null
  dateMode: NotesCalendarDateMode
  navSelection: NotesNavSelection
  miniCalendarRange: MiniMonthSelectedRange | null
  className?: string
}): JSX.Element {
  const { t, i18n } = useTranslation()
  const notesSettings = useNotesSettingsPrefs()
  const calDisplay = useMemo(
    () => resolveNotesCalendarDisplayPrefs(notesSettings),
    [notesSettings]
  )
  const timeGridFcSlotOpts = useMemo(
    () => timeGridFcSnapOptions(calDisplay.defaultTimeGridSlotMinutes),
    [calDisplay.defaultTimeGridSlotMinutes]
  )
  const calendarFcEventContentRender = useCalendarFcEventContent()
  const fcLocale = resolveFullCalendarLocale(i18n.language)
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const calendarRef = useRef<FullCalendar | null>(null)
  const lastRangeRef = useRef<{ start: Date; end: Date }>({ start: new Date(), end: new Date() })
  const noteByIdRef = useRef<Map<number, UserNoteListItem>>(new Map())

  const [rangeNotes, setRangeNotes] = useState<UserNoteListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [hoverPreview, setHoverPreview] = useState<{
    note: UserNoteListItem
    x: number
    y: number
  } | null>(null)
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearHoverTimer = useCallback((): void => {
    if (hoverTimerRef.current != null) {
      clearTimeout(hoverTimerRef.current)
      hoverTimerRef.current = null
    }
  }, [])

  useEffect(() => (): void => clearHoverTimer(), [clearHoverTimer])

  const filteredRangeNotes = useMemo(() => {
    const byNav = notesForNavSelection(rangeNotes, navSelection)
    return notesForMiniCalendarRange(byNav, miniCalendarRange, dateMode)
  }, [rangeNotes, navSelection, miniCalendarRange, dateMode])

  const fcEvents = useMemo(
    () =>
      notesToFullCalendarEvents(filteredRangeNotes, {
        defaultTitle: t('notes.shell.untitled'),
        dateMode
      }),
    [filteredRangeNotes, t, dateMode]
  )

  const multiDayViews = useMemo(() => {
    const o: Record<
      string,
      {
        type: 'timeGrid'
        duration: { days: number }
        buttonText: string
        slotDuration: string
        snapDuration: string
      }
    > = {}
    for (let n = 2; n <= MAX_TIME_GRID_SPAN_DAYS; n++) {
      o[`timeGrid${n}Day`] = {
        type: 'timeGrid',
        duration: { days: n },
        buttonText: `${n} Tage`,
        ...timeGridFcSlotOpts
      }
    }
    return o
  }, [timeGridFcSlotOpts])

  const loadRange = useCallback(async (start: Date, end: Date): Promise<void> => {
    lastRangeRef.current = { start, end }
    setLoading(true)
    try {
      const list = await window.mailClient.notes.listInRange({
        startIso: start.toISOString(),
        endIso: end.toISOString(),
        dateMode,
        limit: 500
      })
      setRangeNotes(list)
      const map = new Map<number, UserNoteListItem>()
      for (const n of list) map.set(n.id, n)
      noteByIdRef.current = map
    } catch {
      setRangeNotes([])
      noteByIdRef.current = new Map()
    } finally {
      setLoading(false)
    }
  }, [dateMode])

  useEffect(() => {
    const { start, end } = lastRangeRef.current
    void loadRange(start, end)
    const off = window.mailClient.events.onNotesChanged(() => {
      void loadRange(lastRangeRef.current.start, lastRangeRef.current.end)
    })
    return off
  }, [loadRange])

  const persistEventChange = useCallback(
    async (info: EventDropArg | EventResizeDoneArg): Promise<void> => {
      const target = computePersistTargetForUserNote(info.event, timeZone, dateMode)
      if (!target) {
        info.revert()
        return
      }
      try {
        await window.mailClient.notes.setSchedule({
          id: target.noteId,
          scheduledStartIso: target.scheduledStartIso,
          scheduledEndIso: target.scheduledEndIso,
          scheduledAllDay: target.scheduledAllDay
        })
        scheduleRemoveDuplicateFullCalendarEventsById(calendarRef.current?.getApi(), [
          userNoteEventId(target.noteId)
        ])
        const api = calendarRef.current?.getApi()
        if (api) {
          await loadRange(api.view.activeStart, api.view.activeEnd)
        }
      } catch {
        info.revert()
      }
    },
    [loadRange, timeZone, dateMode]
  )

  return (
    <div className={cn('calendar-notion-shell relative h-full min-h-0 flex-1', className)}>
      {loading ? (
        <div className="pointer-events-none absolute inset-0 z-[2] flex items-center justify-center bg-background/40">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : null}
      <FullCalendar
        key={`${timeZone}-${fcView}-${calDisplay.weekStartsOn}-${calDisplay.slotMinTime}-${calDisplay.slotMaxTime}-${calDisplay.hideWeekends}-${calDisplay.defaultTimeGridSlotMinutes}`}
        ref={(inst): void => {
          assignMergedFullCalendarRef(inst, calendarRef, fullCalendarRef)
        }}
        plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin, luxonPlugin]}
        locale={fcLocale}
        height="100%"
        timeZone={timeZone}
        headerToolbar={false}
        firstDay={calDisplay.weekStartsOn}
        weekends={!calDisplay.hideWeekends}
        views={{ timeGrid: timeGridFcSlotOpts, ...multiDayViews }}
        initialView={fcView}
        slotMinTime={calDisplay.slotMinTime}
        slotMaxTime={calDisplay.slotMaxTime}
        scrollTime={calDisplay.scrollTime}
        slotDuration={timeGridFcSlotOpts.slotDuration}
        snapDuration={timeGridFcSlotOpts.snapDuration}
        slotLabelInterval="01:00:00"
        defaultTimedEventDuration="00:30:00"
        nowIndicator
        editable={dateMode === 'scheduled'}
        eventResizableFromStart={dateMode === 'scheduled'}
        dayMaxEvents
        events={fcEvents}
        eventContent={calendarFcEventContentRender}
        eventClassNames={(arg): string[] => {
          if (arg.event.extendedProps.calendarKind !== CALENDAR_KIND_USER_NOTE) return []
          const noteId = (arg.event.extendedProps.userNote as UserNoteListItem | undefined)?.id
          return previewNoteId != null && noteId === previewNoteId ? ['ring-2', 'ring-primary'] : []
        }}
        eventDidMount={(info): void => {
          if (info.event.extendedProps.calendarKind !== CALENDAR_KIND_USER_NOTE) return
          const note = info.event.extendedProps.userNote as UserNoteListItem | undefined
          if (!note) return
          const el = info.el as HTMLElement & { _notesCalDblclick?: (ev: MouseEvent) => void }
          const onDblclick = (e: MouseEvent): void => {
            e.preventDefault()
            e.stopPropagation()
            clearHoverTimer()
            setHoverPreview(null)
            onOpenNoteInList(note)
          }
          el._notesCalDblclick = onDblclick
          info.el.addEventListener('dblclick', onDblclick)
        }}
        eventWillUnmount={(info): void => {
          const el = info.el as HTMLElement & { _notesCalDblclick?: (ev: MouseEvent) => void }
          if (el._notesCalDblclick) {
            info.el.removeEventListener('dblclick', el._notesCalDblclick)
            delete el._notesCalDblclick
          }
        }}
        datesSet={(arg): void => {
          void loadRange(arg.start, arg.end)
          onViewMeta?.({
            title: arg.view.title,
            viewType: arg.view.type,
            currentStart: arg.view.currentStart
          })
        }}
        eventClick={(info): void => {
          info.jsEvent.preventDefault()
          const note = info.event.extendedProps.userNote as UserNoteListItem | undefined
          if (note) onPreviewNote(note)
        }}
        eventMouseEnter={(info): void => {
          if (info.event.extendedProps.calendarKind !== CALENDAR_KIND_USER_NOTE) return
          const note = info.event.extendedProps.userNote as UserNoteListItem | undefined
          if (!note) return
          const { clientX, clientY } = info.jsEvent
          clearHoverTimer()
          hoverTimerRef.current = setTimeout(() => {
            setHoverPreview({ note, x: clientX, y: clientY })
          }, HOVER_PREVIEW_DELAY_MS)
        }}
        eventMouseLeave={(info): void => {
          if (info.event.extendedProps.calendarKind !== CALENDAR_KIND_USER_NOTE) return
          clearHoverTimer()
          setHoverPreview(null)
        }}
        eventDrop={(info): void => {
          void persistEventChange(info)
        }}
        eventResize={(info): void => {
          void persistEventChange(info)
        }}
      />
      <NotesCalendarEventHoverPreview
        note={hoverPreview?.note ?? null}
        anchorX={hoverPreview?.x ?? 0}
        anchorY={hoverPreview?.y ?? 0}
        visible={hoverPreview != null}
      />
    </div>
  )
}
