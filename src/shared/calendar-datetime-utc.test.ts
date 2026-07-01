import { describe, expect, it } from 'vitest'
import {
  calendarZonedPartsFromUtcIso,
  formatUtcIsoAsLocalDateTime,
  rruleUntilUtcFromDateOnly,
  trimFractionalSeconds,
  utcIsoFromWallDateTime
} from './calendar-datetime'

describe('trimFractionalSeconds', () => {
  it('kürzt Submillisekunden', () => {
    expect(trimFractionalSeconds('2026-05-01T10:00:00.1234567Z')).toBe('2026-05-01T10:00:00.123Z')
  })
})

describe('calendarZonedPartsFromUtcIso', () => {
  it('liefert Wochentag und Datum in Zone', () => {
    const parts = calendarZonedPartsFromUtcIso('2026-05-20T10:30:00.000Z', 'Europe/Vienna')
    expect(parts?.dateOnly).toBe('2026-05-20')
    expect(parts?.weekday).toBeGreaterThanOrEqual(1)
    expect(parts?.weekday).toBeLessThanOrEqual(7)
  })

  it('gibt null bei ungueltigem ISO', () => {
    expect(calendarZonedPartsFromUtcIso('invalid', 'UTC')).toBeNull()
  })
})

describe('utcIsoFromWallDateTime', () => {
  const resolveZone = (z: string | null | undefined): string => z ?? 'UTC'

  it('wandelt Wandzeit ohne Offset in UTC', () => {
    const iso = utcIsoFromWallDateTime(
      '2026-05-20T12:30:00',
      'Europe/Vienna',
      false,
      resolveZone
    )
    expect(iso).toMatch(/2026-05-20T10:30:00/)
  })

  it('liefert date-only bei Ganztag', () => {
    expect(utcIsoFromWallDateTime('2026-05-20', null, true, resolveZone)).toBe('2026-05-20')
  })

  it('akzeptiert ISO mit Z-Suffix', () => {
    const iso = utcIsoFromWallDateTime('2026-05-20T10:30:00Z', null, false, resolveZone)
    expect(iso).toBe('2026-05-20T10:30:00.000Z')
  })
})

describe('formatUtcIsoAsLocalDateTime', () => {
  it('formatiert lokale Wandzeit', () => {
    const local = formatUtcIsoAsLocalDateTime('2026-05-20T10:30:00.000Z', 'Europe/Vienna')
    expect(local).toBe('2026-05-20T12:30:00')
  })
})

describe('rruleUntilUtcFromDateOnly', () => {
  it('erzeugt RRULE-UNTIL in UTC', () => {
    const until = rruleUntilUtcFromDateOnly('2026-06-30', 'Europe/Berlin')
    expect(until).toMatch(/^\d{8}T\d{6}Z$/)
  })
})
