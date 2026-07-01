import { describe, expect, it } from 'vitest'
import { resolveFullCalendarLocale, deLocale, enGbLocale } from '@/lib/fullcalendar-locale'

describe('resolveFullCalendarLocale', () => {
  it('liefert de-Locale fuer deutsche Sprachen', () => {
    expect(resolveFullCalendarLocale('de')).toBe(deLocale)
    expect(resolveFullCalendarLocale('de-AT')).toBe(deLocale)
  })

  it('liefert en-gb fuer englische Sprachen', () => {
    expect(resolveFullCalendarLocale('en')).toBe(enGbLocale)
    expect(resolveFullCalendarLocale('en-US')).toBe(enGbLocale)
  })
})
