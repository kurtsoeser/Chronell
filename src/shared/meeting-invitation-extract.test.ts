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
})
