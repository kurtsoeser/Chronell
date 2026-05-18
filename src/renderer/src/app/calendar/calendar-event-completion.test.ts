// @vitest-environment jsdom

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import type { CalendarEventWorkItem } from '@shared/work-item'
import {
  applyCalendarCompletionState,
  isCalendarEventEffectivelyDone,
  syncAutoDismissedCalendarEvents
} from '@/app/calendar/calendar-event-completion'

const DISMISSED_KEY = 'mailclient.calendarEventDismissed.v1'
const AUTO_KEY = 'mailclient.timelineAutoDismissEndedEvents.v1'

function sampleEvent(stableKey: string, endIso: string): CalendarEventWorkItem {
  return {
    kind: 'calendar_event',
    stableKey,
    accountId: 'a1',
    completed: false,
    title: 'Termin',
    dueAtIso: null,
    planned: { plannedStartIso: null, plannedEndIso: null },
    event: {
      id: stableKey,
      source: 'microsoft',
      accountId: 'a1',
      accountEmail: 'u@test.de',
      accountColorClass: 'blue',
      graphCalendarId: 'cal1',
      graphEventId: stableKey,
      title: 'Termin',
      startIso: '2026-05-18T08:00:00.000Z',
      endIso,
      isAllDay: false,
      location: null,
      webLink: null,
      joinUrl: null,
      organizer: null
    }
  }
}

describe('calendar event auto-completion', () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.localStorage.setItem(AUTO_KEY, '1')
  })

  afterEach(() => {
    vi.restoreAllMocks()
    window.localStorage.clear()
  })

  it('markiert vergangene Termine als erledigt und speichert den Zustand', () => {
    const nowMs = Date.parse('2026-05-18T12:00:00.000Z')
    const item = sampleEvent('ev-past', '2026-05-18T09:00:00.000Z')
    syncAutoDismissedCalendarEvents([item], nowMs)
    const raw = window.localStorage.getItem(DISMISSED_KEY)
    expect(raw).toContain('ev-past')
    const [out] = applyCalendarCompletionState([item], nowMs)
    expect(out?.completed).toBe(true)
    expect(isCalendarEventEffectivelyDone(item, nowMs)).toBe(true)
  })

  it('lässt Mail-ToDos und Cloud-Aufgaben unverändert', () => {
    const nowMs = Date.parse('2026-05-18T12:00:00.000Z')
    const mail = {
      kind: 'mail_todo',
      stableKey: 'mail:1',
      completed: false,
      title: 'Mail'
    } as const
    const [out] = applyCalendarCompletionState([mail as never], nowMs)
    expect(out?.completed).toBe(false)
  })
})
