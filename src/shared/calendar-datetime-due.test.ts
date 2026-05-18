import { describe, expect, it } from 'vitest'
import { dueCalendarDateFromIso, dueIsoFromClientInput } from './calendar-datetime'
import { graphDueToIso } from '../main/graph/tasks-graph'

describe('dueCalendarDateFromIso', () => {
  it('liest Storage-Konvention T12:00Z als Kalendertag', () => {
    expect(dueCalendarDateFromIso('2026-05-17T12:00:00.000Z', 'Europe/Berlin')).toBe('2026-05-17')
  })

  it('nutzt lokale Zone statt UTC-Slice bei Mitternacht UTC', () => {
    expect(dueCalendarDateFromIso('2026-05-16T22:00:00.000Z', 'Europe/Berlin')).toBe('2026-05-17')
  })
})

describe('dueIsoFromClientInput', () => {
  it('wandelt UI-Datum in Storage-ISO', () => {
    expect(dueIsoFromClientInput('2026-05-21')).toBe('2026-05-21T12:00:00.000Z')
  })
})

describe('graphDueToIso', () => {
  it('behält Wanddatum bei Mitternacht in Kontozone', () => {
    expect(
      graphDueToIso({
        dateTime: '2026-05-17T00:00:00.0000000',
        timeZone: 'W. Europe Standard Time'
      })
    ).toBe('2026-05-17T12:00:00.000Z')
  })

  it('normalisiert reines Datum', () => {
    expect(graphDueToIso({ dateTime: '2026-05-17', timeZone: 'W. Europe Standard Time' })).toBe(
      '2026-05-17T12:00:00.000Z'
    )
  })
})
