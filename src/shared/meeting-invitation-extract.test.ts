import { describe, expect, it } from 'vitest'
import {
  extractIcsBlockFromText,
  extractIcsFromMime,
  extractMeetingTimesFromText
} from './meeting-invitation-extract'

describe('extractIcsBlockFromText', () => {
  it('finds VCALENDAR in MIME text', () => {
    const mime = `Content-Type: text/calendar\n\nBEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nSUMMARY:Test\nEND:VEVENT\nEND:VCALENDAR`
    expect(extractIcsBlockFromText(mime)).toContain('BEGIN:VCALENDAR')
  })
})

describe('extractIcsFromMime', () => {
  it('decodes base64 calendar part', () => {
    const ics = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nDTSTART:20260827T103000\r\nEND:VEVENT\r\nEND:VCALENDAR'
    const b64 = Buffer.from(ics, 'utf8').toString('base64')
    const mime = [
      'Content-Type: multipart/mixed; boundary=abc',
      '',
      '--abc',
      'Content-Type: text/calendar; method=REQUEST',
      'Content-Transfer-Encoding: base64',
      '',
      b64,
      '--abc--'
    ].join('\r\n')
    const block = extractIcsFromMime(mime)
    expect(block).toContain('DTSTART:20260827T103000')
  })
})

describe('extractMeetingTimesFromText', () => {
  it('parses German date range', () => {
    const r = extractMeetingTimesFromText('Termin am 27.08.2026 10:30 - 11:00 in Teams')
    expect(r).not.toBeNull()
    expect(r!.startIso).toContain('2026-08-27')
  })

  it('parses German month name with time range', () => {
    const r = extractMeetingTimesFromText('Montag, 29. Juni 2026, 13:00 – 14:00 Uhr')
    expect(r).not.toBeNull()
    expect(r!.startIso).toContain('2026-06-29')
  })

  it('parses ISO date with time', () => {
    const r = extractMeetingTimesFromText('Start: 2026-06-29 09:15 to 10:45')
    expect(r).not.toBeNull()
    expect(r!.startIso).toContain('2026-06-29')
  })

  it('applies default duration for single start time', () => {
    const r = extractMeetingTimesFromText('Webinar am 29.06.2026 um 13:00 Uhr')
    expect(r).not.toBeNull()
    const start = new Date(r!.startIso)
    const end = new Date(r!.endIso)
    expect(end.getTime() - start.getTime()).toBe(60 * 60 * 1000)
  })

  it('does not mistake a date for a time', () => {
    const r = extractMeetingTimesFromText('Datum 29.06.2026 um 14:30 Uhr')
    expect(r).not.toBeNull()
    expect(new Date(r!.startIso).getHours()).toBe(14)
  })

  it('parses English month-first date with time range', () => {
    const r = extractMeetingTimesFromText('Meeting on June 29, 2026 from 9:00 to 9:30')
    expect(r).not.toBeNull()
    expect(r!.startIso).toContain('2026-06-29')
  })

  it('returns null when no date present', () => {
    expect(extractMeetingTimesFromText('Lass uns um 13:00 treffen')).toBeNull()
  })
})
