import { describe, expect, it } from 'vitest'
import type { CalendarEventView } from '@shared/types'
import type { WorkItem } from '@shared/work-item'
import { calendarEventToWorkItem } from '@/app/work-items/work-item-mapper'
import { layoutGanttBars, workItemGanttInterval } from '@/app/calendar/calendar-gantt-layout'
import { localDayStartMsFromIso } from '@/app/calendar/gantt-all-day-ms'

function sampleEvent(partial: Partial<CalendarEventView>): CalendarEventView {
  return {
    id: '1',
    source: 'microsoft',
    accountId: 'a1',
    accountEmail: 'u@test.com',
    accountColorClass: 'bg-blue-500',
    title: 'Test',
    startIso: '2026-05-18T10:00:00.000Z',
    endIso: '2026-05-18T11:00:00.000Z',
    isAllDay: false,
    location: null,
    webLink: null,
    joinUrl: null,
    organizer: null,
    graphEventId: 'ev1',
    graphCalendarId: 'cal1',
    calendarCanEdit: true,
    ...partial
  }
}

describe('workItemGanttInterval', () => {
  it('liest Kalendertermin mit Start/Ende', () => {
    const item = calendarEventToWorkItem(sampleEvent({}))
    const iv = workItemGanttInterval(item)
    expect(iv).not.toBeNull()
    expect(iv!.endMs).toBeGreaterThan(iv!.startMs)
  })
})

describe('calendarEventGanttInterval all-day', () => {
  it('nutzt lokalen Tagesbeginn statt UTC-Mitternacht', () => {
    const item = calendarEventToWorkItem(
      sampleEvent({
        startIso: '2026-05-18',
        endIso: '2026-05-19',
        isAllDay: true
      })
    )
    const iv = workItemGanttInterval(item)
    expect(iv?.allDay).toBe(true)
    expect(iv!.startMs).toBe(localDayStartMsFromIso('2026-05-18'))
    const start = new Date(iv!.startMs)
    expect(start.getHours()).toBe(0)
  })
})

describe('layoutGanttBars', () => {
  it('trennt Ganztags- und Zeitbalken in eigene Zeilen', () => {
    const allDay = calendarEventToWorkItem(
      sampleEvent({
        id: 'ad',
        graphEventId: 'ad',
        title: 'Ganztägig',
        startIso: '2026-05-18',
        endIso: '2026-05-19',
        isAllDay: true
      })
    )
    const timed = calendarEventToWorkItem(
      sampleEvent({
        id: 'tm',
        graphEventId: 'tm',
        title: 'Termin',
        startIso: '2026-05-18T10:00:00.000Z',
        endIso: '2026-05-18T11:00:00.000Z',
        isAllDay: false
      })
    )
    const rangeStart = localDayStartMsFromIso('2026-05-17')!
    const rangeEnd = localDayStartMsFromIso('2026-05-20')!
    const { bars, allDayRowCount, timedRowCount } = layoutGanttBars(
      [allDay, timed] as WorkItem[],
      rangeStart,
      rangeEnd,
      1200
    )
    expect(allDayRowCount).toBeGreaterThan(0)
    expect(timedRowCount).toBeGreaterThan(0)
    const adBar = bars.find((b) => b.item.stableKey === allDay.stableKey)
    const tmBar = bars.find((b) => b.item.stableKey === timed.stableKey)
    expect(adBar?.lane).toBe('allDay')
    expect(tmBar?.lane).toBe('timed')
    expect(adBar!.row).toBe(tmBar!.row)
  })

  it('platziert überlappende Balken in verschiedenen Zeilen', () => {
    const a = calendarEventToWorkItem(
      sampleEvent({
        id: 'a',
        graphEventId: 'a',
        startIso: '2026-05-18T10:00:00.000Z',
        endIso: '2026-05-18T12:00:00.000Z'
      })
    )
    const b = calendarEventToWorkItem(
      sampleEvent({
        id: 'b',
        graphEventId: 'b',
        title: 'B',
        startIso: '2026-05-18T11:00:00.000Z',
        endIso: '2026-05-18T13:00:00.000Z'
      })
    )
    const rangeStart = new Date('2026-05-17T00:00:00.000Z').getTime()
    const rangeEnd = new Date('2026-05-20T00:00:00.000Z').getTime()
    const { bars: placed } = layoutGanttBars([a, b] as WorkItem[], rangeStart, rangeEnd, 800)
    expect(placed).toHaveLength(2)
    expect(placed[0]!.row).not.toBe(placed[1]!.row)
  })
})
