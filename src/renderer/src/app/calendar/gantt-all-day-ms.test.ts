import { describe, expect, it } from 'vitest'
import {
  localDayEndMsExclusiveFromIso,
  localDayStartMsFromIso
} from '@/app/calendar/gantt-all-day-ms'

describe('gantt-all-day-ms', () => {
  it('parst reines Datum als lokalen Tagesbeginn (nicht UTC 02:00)', () => {
    const ms = localDayStartMsFromIso('2026-05-18')!
    const d = new Date(ms)
    expect(d.getHours()).toBe(0)
    expect(d.getMinutes()).toBe(0)
    expect(d.getDate()).toBe(18)
    expect(d.getMonth()).toBe(4)
  })

  it('nutzt exklusives Enddatum', () => {
    const start = localDayStartMsFromIso('2026-05-18')!
    const end = localDayEndMsExclusiveFromIso('2026-05-19', start)
    expect(end - start).toBe(24 * 60 * 60 * 1000)
  })
})
