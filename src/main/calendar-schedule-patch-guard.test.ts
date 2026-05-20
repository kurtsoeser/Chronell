import { describe, expect, it, vi, afterEach } from 'vitest'
import {
  getActiveSchedulePatchGuard,
  registerSchedulePatchGuard
} from './calendar-schedule-patch-guard'

describe('calendar-schedule-patch-guard', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('liefert den registrierten Patch fuer 90 Sekunden', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-20T10:00:00.000Z'))

    registerSchedulePatchGuard({
      accountId: 'acc-1',
      graphEventId: 'ev-1',
      graphCalendarId: 'cal-1',
      startIso: '2026-05-21T06:30:00.000Z',
      endIso: '2026-05-21T09:30:00.000Z',
      isAllDay: false
    })

    const active = getActiveSchedulePatchGuard('acc-1', 'ev-1')
    expect(active).toEqual({
      startIso: '2026-05-21T06:30:00.000Z',
      endIso: '2026-05-21T09:30:00.000Z',
      isAllDay: false,
      patchedAt: Date.parse('2026-05-20T10:00:00.000Z')
    })

    vi.setSystemTime(new Date('2026-05-20T10:01:29.000Z'))
    expect(getActiveSchedulePatchGuard('acc-1', 'ev-1')).not.toBeNull()

    vi.setSystemTime(new Date('2026-05-20T10:01:31.000Z'))
    expect(getActiveSchedulePatchGuard('acc-1', 'ev-1')).toBeNull()
  })
})
