import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject, type RefObject } from 'react'
import { flushSync } from 'react-dom'
import type { EventInput } from '@fullcalendar/core'
import type FullCalendar from '@fullcalendar/react'
import type {
  CalendarEventView,
  CalendarGraphCalendarRow,
  ConnectedAccount
} from '@shared/types'
import {
  resolveCalendarDisplayHex
} from '@shared/graph-calendar-colors'
import { deduplicateCalendarEventsByGraphEventId, purgeDuplicateGraphCalendarEventsOnApi } from '@/app/calendar/calendar-graph-events'
import {
  capEventInputsForMultiMonthView,
  isMultiMonthFcView
} from '@/app/calendar/calendar-fc-multimonth'
import { SIDEBAR_DEFAULT_CAL_ID } from '@/app/calendar/calendar-shell-storage'
import {
  calendarVisibilityKey,
  parseCalendarVisibilityKey
} from '@/lib/calendar-visibility-storage'
import { buildCalendarIncludeCalendars } from '@/lib/build-calendar-include-calendars'

export interface UseCalendarShellGraphEventsParams {
  calendarRef: RefObject<FullCalendar | null>
  lastRangeRef: MutableRefObject<{ start: Date; end: Date }>
  calendarLinkedAccounts: ConnectedAccount[]
  calendarsByAccount: Record<string, CalendarGraphCalendarRow[] | undefined>
  hiddenCalendarKeys: Set<string>
  sidebarHiddenCalendarKeys: Set<string>
  activeViewId: string
  calendarEventSearchQuery: string
  graphCalendarPersistInFlightRef: MutableRefObject<number>
  skipCalendarReloadUntilRef: MutableRefObject<number>
  graphCalendarReconcilingRef: MutableRefObject<boolean>
  mailTodoOverlayRef: MutableRefObject<boolean>
  cloudTaskOverlayRef: MutableRefObject<boolean>
  userNoteOverlayRef: MutableRefObject<boolean>
  loadMailTodosForRange: (start: Date, end: Date) => void | Promise<void>
  loadCloudTasksForRange: (start: Date, end: Date) => void | Promise<void>
  loadUserNotesForRange: (start: Date, end: Date) => void | Promise<void>
}

export function useCalendarShellGraphEvents({
  calendarRef,
  lastRangeRef,
  calendarLinkedAccounts,
  calendarsByAccount,
  hiddenCalendarKeys,
  sidebarHiddenCalendarKeys,
  activeViewId,
  calendarEventSearchQuery,
  graphCalendarPersistInFlightRef,
  skipCalendarReloadUntilRef,
  graphCalendarReconcilingRef,
  mailTodoOverlayRef,
  cloudTaskOverlayRef,
  userNoteOverlayRef,
  loadMailTodosForRange,
  loadCloudTasksForRange,
  loadUserNotesForRange
}: UseCalendarShellGraphEventsParams) {
  const [events, setEvents] = useState<CalendarEventView[]>([])
  const [graphCalendarSourceRev, setGraphCalendarSourceRev] = useState(0)
  const eventsRef = useRef<CalendarEventView[]>([])
  eventsRef.current = events
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reloadCalendarEventsOnlyRef = useRef<
    (opts?: { silent?: boolean; forceRefresh?: boolean }) => void
  >(() => {})

  const defaultGraphCalendarIdByAccount = useMemo(() => {
    const m: Record<string, string | null> = {}
    for (const acc of calendarLinkedAccounts) {
      const rows = calendarsByAccount[acc.id]
      if (!rows?.length) {
        m[acc.id] = null
        continue
      }
      m[acc.id] = rows.find((r) => r.isDefaultCalendar)?.id ?? rows[0]?.id ?? null
    }
    return m
  }, [calendarLinkedAccounts, calendarsByAccount])

  const loadRange = useCallback(
    async (
      start: Date,
      end: Date,
      opts?: { silent?: boolean; forceRefresh?: boolean }
    ): Promise<void> => {
      const silent = opts?.silent === true
      if (!silent) setLoading(true)
      setError(null)
      try {
        const includeCalendars = await buildCalendarIncludeCalendars(
          calendarLinkedAccounts,
          calendarsByAccount as Record<string, CalendarGraphCalendarRow[]>,
          hiddenCalendarKeys,
          sidebarHiddenCalendarKeys
        )
        const list = await window.mailClient.calendar.listEvents({
          startIso: start.toISOString(),
          endIso: end.toISOString(),
          focusCalendar: null,
          includeCalendars,
          forceRefresh: opts?.forceRefresh === true
        })
        setEvents(deduplicateCalendarEventsByGraphEventId(list))
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
        if (!silent) setEvents([])
      } finally {
        if (!silent) setLoading(false)
      }
    },
    [calendarLinkedAccounts, calendarsByAccount, hiddenCalendarKeys, sidebarHiddenCalendarKeys]
  )

  const reloadVisibleRange = useCallback(
    (opts?: { silent?: boolean; forceRefresh?: boolean }): void => {
      const silent = opts?.silent ?? eventsRef.current.length > 0
      const api = calendarRef.current?.getApi()
      if (api) {
        const { activeStart, activeEnd } = api.view
        void loadRange(activeStart, activeEnd, { silent, forceRefresh: opts?.forceRefresh })
        if (mailTodoOverlayRef.current) void loadMailTodosForRange(activeStart, activeEnd)
        if (cloudTaskOverlayRef.current) void loadCloudTasksForRange(activeStart, activeEnd)
        if (userNoteOverlayRef.current) void loadUserNotesForRange(activeStart, activeEnd)
        return
      }
      const { start, end } = lastRangeRef.current
      void loadRange(start, end, { silent, forceRefresh: opts?.forceRefresh })
      if (mailTodoOverlayRef.current) void loadMailTodosForRange(start, end)
      if (cloudTaskOverlayRef.current) void loadCloudTasksForRange(start, end)
      if (userNoteOverlayRef.current) void loadUserNotesForRange(start, end)
    },
    [
      loadRange,
      loadMailTodosForRange,
      loadCloudTasksForRange,
      loadUserNotesForRange,
      calendarRef,
      lastRangeRef,
      mailTodoOverlayRef,
      cloudTaskOverlayRef,
      userNoteOverlayRef
    ]
  )

  const reloadCalendarEventsOnly = useCallback(
    (opts?: { silent?: boolean; forceRefresh?: boolean }): void => {
      const silent = opts?.silent ?? eventsRef.current.length > 0
      const api = calendarRef.current?.getApi()
      if (api) {
        const { activeStart, activeEnd } = api.view
        void loadRange(activeStart, activeEnd, { silent, forceRefresh: opts?.forceRefresh })
        if (mailTodoOverlayRef.current) void loadMailTodosForRange(activeStart, activeEnd)
        return
      }
      const { start, end } = lastRangeRef.current
      void loadRange(start, end, { silent, forceRefresh: opts?.forceRefresh })
      if (mailTodoOverlayRef.current) void loadMailTodosForRange(start, end)
    },
    [loadRange, loadMailTodosForRange, calendarRef, lastRangeRef, mailTodoOverlayRef]
  )
  reloadCalendarEventsOnlyRef.current = reloadCalendarEventsOnly

  const applyOptimisticGraphCalendarEvent = useCallback(
    (created: CalendarEventView): void => {
      graphCalendarReconcilingRef.current = true
      try {
        flushSync(() => {
          setEvents((prev) => {
            const without = prev.filter(
              (row) =>
                !(
                  row.accountId === created.accountId &&
                  row.graphEventId === created.graphEventId
                )
            )
            return deduplicateCalendarEventsByGraphEventId([...without, created])
          })
          setGraphCalendarSourceRev((rev) => rev + 1)
        })
        purgeDuplicateGraphCalendarEventsOnApi(calendarRef.current?.getApi())
      } finally {
        queueMicrotask(() => {
          graphCalendarReconcilingRef.current = false
        })
      }
    },
    [calendarRef, graphCalendarReconcilingRef]
  )

  useEffect(() => {
    if (calendarLinkedAccounts.length === 0) return
    const api = calendarRef.current?.getApi()
    if (api) {
      void loadRange(api.view.activeStart, api.view.activeEnd)
    } else {
      const { start, end } = lastRangeRef.current
      void loadRange(start, end)
    }
  }, [hiddenCalendarKeys, sidebarHiddenCalendarKeys, calendarLinkedAccounts, loadRange, calendarRef, lastRangeRef])

  useEffect(() => {
    const off = window.mailClient.events.onCalendarChanged(() => {
      if (graphCalendarPersistInFlightRef.current > 0) return
      if (Date.now() < skipCalendarReloadUntilRef.current) return
      reloadCalendarEventsOnly({ silent: true })
    })
    return off
  }, [reloadCalendarEventsOnly, graphCalendarPersistInFlightRef, skipCalendarReloadUntilRef])

  const calendarDisplayHexByKey = useMemo(() => {
    const m: Record<string, Record<string, string | null>> = {}
    for (const acc of calendarLinkedAccounts) {
      const inner: Record<string, string | null> = {}
      for (const row of calendarsByAccount[acc.id] ?? []) {
        inner[row.id] = resolveCalendarDisplayHex(row)
      }
      m[acc.id] = inner
    }
    return m
  }, [calendarLinkedAccounts, calendarsByAccount])

  const visibleGraphEvents = useMemo(() => {
    if (hiddenCalendarKeys.size === 0 && sidebarHiddenCalendarKeys.size === 0) return events
    return events.filter((ev) => {
      const defId = defaultGraphCalendarIdByAccount[ev.accountId]
      const calId = (ev.graphCalendarId?.trim() || defId || SIDEBAR_DEFAULT_CAL_ID).trim()
      const key = calendarVisibilityKey(ev.accountId, calId)
      if (hiddenCalendarKeys.has(key)) return false
      if (sidebarHiddenCalendarKeys.has(key)) return false
      return true
    })
  }, [events, hiddenCalendarKeys, sidebarHiddenCalendarKeys, defaultGraphCalendarIdByAccount])

  const graphFcEvents = useMemo(
    () =>
      visibleGraphEvents.map((ev) => {
        const defId = defaultGraphCalendarIdByAccount[ev.accountId]
        const calIdRaw = (ev.graphCalendarId?.trim() || defId || SIDEBAR_DEFAULT_CAL_ID).trim()
        const lookupId =
          calIdRaw === SIDEBAR_DEFAULT_CAL_ID && defId
            ? defId
            : calIdRaw !== SIDEBAR_DEFAULT_CAL_ID
              ? calIdRaw
              : null
        const fromCalList =
          lookupId && ev.source === 'microsoft'
            ? (calendarDisplayHexByKey[ev.accountId]?.[lookupId] ?? null)
            : null
        const resolvedDisplayHex = fromCalList ?? ev.displayColorHex ?? null
        return {
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
          editable: Boolean(
            ev.graphEventId &&
              ev.calendarCanEdit !== false &&
              (ev.source === 'microsoft' || ev.source === 'google')
          ),
          startEditable: Boolean(
            ev.graphEventId &&
              ev.calendarCanEdit !== false &&
              (ev.source === 'microsoft' || ev.source === 'google')
          ),
          durationEditable: Boolean(
            ev.graphEventId &&
              ev.calendarCanEdit !== false &&
              (ev.source === 'microsoft' || ev.source === 'google')
          )
        }
      }),
    [visibleGraphEvents, defaultGraphCalendarIdByAccount, calendarDisplayHexByKey]
  )

  const filterGraphFcEvents = useCallback(
    (evs: EventInput[]): EventInput[] => {
      const q = calendarEventSearchQuery.trim().toLowerCase()
      if (!q) return evs
      return evs.filter((ev) => {
        if (
          String(ev.title ?? '')
            .toLowerCase()
            .includes(q)
        )
          return true
        const cal = ev.extendedProps?.calendarEvent as CalendarEventView | undefined
        return (cal?.location ?? '').trim().toLowerCase().includes(q)
      })
    },
    [calendarEventSearchQuery]
  )

  const graphFcEventsDisplayed = useMemo(
    () => filterGraphFcEvents(graphFcEvents),
    [graphFcEvents, filterGraphFcEvents]
  )

  const graphFcEventsForFc = useMemo(() => {
    if (!isMultiMonthFcView(activeViewId)) return graphFcEventsDisplayed
    return capEventInputsForMultiMonthView(graphFcEventsDisplayed, activeViewId)
  }, [graphFcEventsDisplayed, activeViewId])

  return {
    events,
    setEvents,
    eventsRef,
    graphCalendarSourceRev,
    setGraphCalendarSourceRev,
    loading,
    error,
    setError,
    loadRange,
    reloadVisibleRange,
    reloadCalendarEventsOnly,
    reloadCalendarEventsOnlyRef,
    applyOptimisticGraphCalendarEvent,
    defaultGraphCalendarIdByAccount,
    visibleGraphEvents,
    graphFcEventsForFc,
    calendarDisplayHexByKey
  }
}
