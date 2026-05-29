import { describe, expect, it, vi, afterEach } from 'vitest'
import { contactHistoryDateBucket } from './contact-history-date-bucket'

const labels = {
  unknown: 'Unbekannt',
  today: 'Heute',
  yesterday: 'Gestern',
  lastWeek: 'Letzte Woche',
  thisMonth: 'Diesen Monat',
  older: 'Ältere'
}

describe('contactHistoryDateBucket', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns today for same calendar day', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-28T14:00:00'))
    const bucket = contactHistoryDateBucket('2026-05-28T09:00:00Z', labels, 'de-DE')
    expect(bucket.key).toBe('today')
    expect(bucket.label).toBe('Heute')
  })

  it('returns yesterday for previous day', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-28T14:00:00'))
    const bucket = contactHistoryDateBucket('2026-05-27T09:00:00', labels, 'de-DE')
    expect(bucket.key).toBe('yesterday')
  })

  it('returns weekday label for 3 days ago', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-28T14:00:00'))
    const bucket = contactHistoryDateBucket('2026-05-25T09:00:00', labels, 'de-DE')
    expect(bucket.key).toMatch(/^weekday:/)
    expect(bucket.label.length).toBeGreaterThan(2)
  })

  it('returns last week for 10 days ago', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-28T14:00:00'))
    const bucket = contactHistoryDateBucket('2026-05-18T09:00:00', labels, 'de-DE')
    expect(bucket.key).toBe('last-week')
    expect(bucket.label).toBe('Letzte Woche')
  })
})
