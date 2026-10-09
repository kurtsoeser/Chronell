import { describe, expect, it } from 'vitest'
import { classifyTimelinePeriodFromIso } from '@shared/timeline-period-group'

const TZ = 'Europe/Berlin'

describe('classifyTimelinePeriodFromIso', () => {
  const now = Date.parse('2026-05-15T12:00:00.000Z') // Friday

  it('ordnet Kalendertermin am gleichen Tag wie now', () => {
    expect(classifyTimelinePeriodFromIso('2026-05-15T10:00:00.000Z', TZ, now)).toBe('today')
  })

  it('ordnet heute, morgen und Rest der Woche', () => {
    expect(classifyTimelinePeriodFromIso('2026-05-15T08:00:00.000Z', TZ, now)).toBe('today')
    expect(classifyTimelinePeriodFromIso('2026-05-16T08:00:00.000Z', TZ, now)).toBe('tomorrow')
    expect(classifyTimelinePeriodFromIso('2026-05-17T10:00:00.000Z', TZ, now)).toBe('this_week')
  })

  it('ordnet vor heute als earlier und nach dieser Woche', () => {
    expect(classifyTimelinePeriodFromIso('2026-05-10T08:00:00.000Z', TZ, now)).toBe('earlier')
    expect(classifyTimelinePeriodFromIso('2026-05-25T08:00:00.000Z', TZ, now)).toBe('later')
  })
})
