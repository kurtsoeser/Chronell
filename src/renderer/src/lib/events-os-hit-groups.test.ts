import { describe, expect, it } from 'vitest'
import type { EventsOsEventHit } from '@shared/types/events-os'
import {
  extractOrganization,
  groupEventsOsHits,
  sortHitsByDate,
  startOfWeekMonday
} from './events-os-hit-groups'

function hit(
  id: string,
  title: string,
  date?: string
): EventsOsEventHit {
  return {
    id,
    title,
    date,
    category: ['Webinar'],
    studioAkteUrl: `http://127.0.0.1:7733/events/${id}`
  }
}

describe('events-os-hit-groups', () => {
  it('sortiert Treffer aufsteigend nach Datum', () => {
    const sorted = sortHitsByDate([
      hit('b', 'B', '2026-11-04T14:00:00'),
      hit('a', 'A', '2026-10-07T14:00:00'),
      hit('c', 'C')
    ])
    expect(sorted.map((h) => h.id)).toEqual(['a', 'b', 'c'])
  })

  it('gruppiert nach Zeitraum (Heute / Morgen / …)', () => {
    // Mittwoch, 15.10.2026
    const now = new Date(2026, 9, 15, 12, 0, 0)
    const groups = groupEventsOsHits(
      [
        hit('today', 'Heute', '2026-10-15T14:00:00'),
        hit('tomorrow', 'Morgen', '2026-10-16T14:00:00'),
        hit('thisWeek', 'Freitag', '2026-10-17T14:00:00'),
        hit('nextWeek', 'Nächste Woche', '2026-10-22T14:00:00'),
        hit('later', 'Später', '2027-03-02T14:00:00'),
        hit('past', 'Vergangen', '2025-10-03T14:00:00'),
        hit('nodate', 'Ohne')
      ],
      'zeitraum',
      now
    )
    expect(groups.map((g) => g.key)).toEqual([
      'heute',
      'morgen',
      'dieseWoche',
      'naechsteWoche',
      'spaeter',
      'vergangen',
      'ohneDatum'
    ])
    expect(startOfWeekMonday(now).getDate()).toBe(12)
  })

  it('gruppiert nach Monat', () => {
    const groups = groupEventsOsHits(
      [
        hit('a', 'A', '2026-10-07T14:00:00'),
        hit('b', 'B', '2026-11-04T14:00:00'),
        hit('c', 'C', '2026-10-15T14:00:00')
      ],
      'monat',
      new Date(2026, 9, 15)
    )
    expect(groups.map((g) => g.key)).toEqual(['2026-10', '2026-11'])
    expect(groups[0]?.items.map((h) => h.id)).toEqual(['a', 'c'])
  })

  it('erkennt Organisationen aus Titeln', () => {
    expect(extractOrganization('Webinar PH OÖ: KI im Unterricht')).toBe('PH OÖ')
    expect(extractOrganization('Webinar PH Salzburg: Teams')).toBe('PH Salzburg')
    expect(extractOrganization('PHT: Mathematik')).toBe('PHT')
    expect(extractOrganization('Allgemeines Webinar ohne Org')).toBe('Sonstige')
  })

  it('gruppiert nach Organisation', () => {
    const groups = groupEventsOsHits(
      [
        hit('1', 'Webinar PH OÖ: A', '2026-10-07T14:00:00'),
        hit('2', 'Webinar PH Salzburg: B', '2026-10-08T14:00:00'),
        hit('3', 'Webinar PH OÖ: C', '2026-11-01T14:00:00')
      ],
      'organisation'
    )
    const oo = groups.find((g) => g.key.includes('ph oö') || g.label === 'PH OÖ')
    expect(oo?.items).toHaveLength(2)
    expect(oo?.items.map((h) => h.id)).toEqual(['1', '3'])
  })
})
