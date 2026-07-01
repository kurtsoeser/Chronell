import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type Database from 'better-sqlite3'
import type { CalendarEventView } from '@shared/types'
import { createInMemoryTestDb, isInMemorySqliteAvailable } from '../../test-fixtures/db'

const { testDbRef } = vi.hoisted(() => ({
  testDbRef: { current: null as Database.Database | null }
}))

vi.mock('./index', () => ({
  getDb: () => {
    if (!testDbRef.current) throw new Error('test db not initialized')
    return testDbRef.current
  }
}))

vi.mock('../calendar-created-event-guard', () => ({
  isCreatedCalendarEventGuarded: () => false
}))

import {
  deleteCalendarDataForAccount,
  getCalendarEventByGraphEventId,
  isCalendarRangeCoveredBySync,
  listCalendarEventsInRange,
  mergeCalendarSyncWindow,
  patchCalendarEventIcon,
  pruneCalendarEventsInRange,
  upsertCalendarEvents
} from './calendar-events-repo'

function makeEvent(overrides: Partial<CalendarEventView> = {}): CalendarEventView {
  return {
    id: 'microsoft:acc-1:evt-1',
    source: 'microsoft',
    accountId: 'acc-1',
    accountEmail: 'user@example.com',
    accountColorClass: 'blue',
    graphCalendarId: 'cal-1',
    graphEventId: 'evt-1',
    title: 'Team Meeting',
    startIso: '2026-06-01T10:00:00.000Z',
    endIso: '2026-06-01T11:00:00.000Z',
    isAllDay: false,
    location: null,
    webLink: null,
    joinUrl: null,
    organizer: null,
    ...overrides
  }
}

describe.skipIf(!isInMemorySqliteAvailable())('calendar-events-repo', () => {
  beforeEach(() => {
    testDbRef.current = createInMemoryTestDb()
  })

  afterEach(() => {
    testDbRef.current?.close()
    testDbRef.current = null
  })

  it('upsertCalendarEvents ist idempotent', () => {
    const ev = makeEvent()
    upsertCalendarEvents([ev])
    upsertCalendarEvents([{ ...ev, title: 'Updated Title' }])

    const row = getCalendarEventByGraphEventId('acc-1', 'evt-1')
    expect(row?.title).toBe('Updated Title')
    expect(
      (
        testDbRef.current!.prepare('SELECT COUNT(*) as c FROM calendar_events').get() as {
          c: number
        }
      ).c
    ).toBe(1)
  })

  it('listCalendarEventsInRange filtert ueberlappende Termine', () => {
    upsertCalendarEvents([
      makeEvent({ graphEventId: 'in-range', title: 'In Range' }),
      makeEvent({
        id: 'microsoft:acc-1:evt-2',
        graphEventId: 'out-range',
        title: 'Out Range',
        startIso: '2026-07-01T10:00:00.000Z',
        endIso: '2026-07-01T11:00:00.000Z'
      })
    ])

    const hits = listCalendarEventsInRange('2026-06-01T00:00:00.000Z', '2026-06-02T00:00:00.000Z')
    expect(hits.map((e) => e.title)).toEqual(['In Range'])
  })

  it('mergeCalendarSyncWindow erweitert Fenster und isCalendarRangeCoveredBySync', () => {
    mergeCalendarSyncWindow('acc-1', '2026-06-01T00:00:00.000Z', '2026-06-10T00:00:00.000Z')
    mergeCalendarSyncWindow('acc-1', '2026-05-01T00:00:00.000Z', '2026-07-01T00:00:00.000Z')

    expect(
      isCalendarRangeCoveredBySync(['acc-1'], '2026-06-02T00:00:00.000Z', '2026-06-08T00:00:00.000Z')
    ).toBe(true)
    expect(
      isCalendarRangeCoveredBySync(['acc-1'], '2026-04-01T00:00:00.000Z', '2026-05-15T00:00:00.000Z')
    ).toBe(false)
  })

  it('pruneCalendarEventsInRange loescht nur im Fenster', () => {
    upsertCalendarEvents([
      makeEvent({ graphEventId: 'prune-me' }),
      makeEvent({
        id: 'microsoft:acc-1:keep',
        graphEventId: 'keep-me',
        startIso: '2026-08-01T10:00:00.000Z',
        endIso: '2026-08-01T11:00:00.000Z'
      })
    ])

    pruneCalendarEventsInRange(
      'acc-1',
      '2026-06-01T00:00:00.000Z',
      '2026-06-02T00:00:00.000Z',
      ['cal-1'],
      new Set(['keep-me'])
    )

    expect(getCalendarEventByGraphEventId('acc-1', 'evt-1')).toBeNull()
    expect(getCalendarEventByGraphEventId('acc-1', 'keep-me')).not.toBeNull()
  })

  it('patchCalendarEventIcon setzt icon_id', () => {
    upsertCalendarEvents([makeEvent()])
    patchCalendarEventIcon('acc-1', 'evt-1', 'star')

    const row = testDbRef.current!
      .prepare('SELECT icon_id FROM calendar_events WHERE account_id = ? AND graph_event_id = ?')
      .get('acc-1', 'evt-1') as { icon_id: string | null }
    expect(row.icon_id).toBe('star')
  })

  it('deleteCalendarDataForAccount raeumt konto-spezifisch auf', () => {
    upsertCalendarEvents([
      makeEvent(),
      makeEvent({
        id: 'microsoft:acc-2:evt-2',
        accountId: 'acc-2',
        graphEventId: 'evt-2'
      })
    ])
    mergeCalendarSyncWindow('acc-1', '2026-06-01T00:00:00.000Z', '2026-06-10T00:00:00.000Z')

    deleteCalendarDataForAccount('acc-1')

    expect(getCalendarEventByGraphEventId('acc-1', 'evt-1')).toBeNull()
    expect(getCalendarEventByGraphEventId('acc-2', 'evt-2')).not.toBeNull()
    expect(isCalendarRangeCoveredBySync(['acc-1'], '2026-06-01T00:00:00.000Z', '2026-06-02T00:00:00.000Z')).toBe(
      false
    )
  })
})
