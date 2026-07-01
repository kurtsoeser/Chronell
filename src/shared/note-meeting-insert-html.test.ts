import { describe, expect, it } from 'vitest'
import {
  buildNoteMeetingInsertHtml,
  normalizeNoteMeetingJoinUrl,
  resolveNoteMeetingJoinUrl
} from './note-meeting-insert-html'

const labels = {
  date: 'Datum',
  location: 'Ort',
  organizer: 'Organisator',
  attendees: 'Teilnehmer',
  onlineMeeting: 'Online',
  joinMeeting: 'Beitreten',
  agenda: 'Agenda',
  notes: 'Notizen',
  nextSteps: 'Nächste Schritte'
}

const baseEvent = {
  title: 'Projekt-Review',
  startIso: '2026-07-01T10:00:00.000Z',
  endIso: '2026-07-01T11:00:00.000Z',
  isAllDay: false,
  location: null,
  organizer: null,
  joinUrl: null,
  webLink: null
}

describe('normalizeNoteMeetingJoinUrl', () => {
  it('lehnt Platzhalter ab', () => {
    expect(normalizeNoteMeetingJoinUrl('#')).toBeNull()
    expect(normalizeNoteMeetingJoinUrl('  #  ')).toBeNull()
  })

  it('akzeptiert https Teams-Links', () => {
    const url = 'https://teams.microsoft.com/l/meetup-join/abc'
    expect(normalizeNoteMeetingJoinUrl(url)).toBe(url)
  })
})

describe('resolveNoteMeetingJoinUrl', () => {
  it('bevorzugt joinUrl aus Event-Details', () => {
    const url = 'https://teams.microsoft.com/l/meetup-join/from-details'
    expect(
      resolveNoteMeetingJoinUrl(
        { joinUrl: 'https://teams.microsoft.com/l/meetup-join/from-list', webLink: null, location: null },
        { joinUrl: url, bodyHtml: null, location: null, isOnlineMeeting: true }
      )
    ).toBe(url)
  })

  it('nutzt joinUrl aus der Terminliste', () => {
    const url = 'https://teams.microsoft.com/l/meetup-join/from-list'
    expect(resolveNoteMeetingJoinUrl({ joinUrl: url, webLink: null, location: null }, null)).toBe(url)
  })

  it('extrahiert Link aus dem Termin-Body', () => {
    const url = 'https://teams.microsoft.com/l/meetup-join/from-body'
    expect(
      resolveNoteMeetingJoinUrl(
        { joinUrl: null, webLink: null, location: null },
        {
          joinUrl: null,
          bodyHtml: `<p>Bitte teilnehmen: ${url}</p>`,
          location: null,
          isOnlineMeeting: true
        }
      )
    ).toBe(url)
  })

  it('nutzt webLink bei Online-Terminen', () => {
    const url = 'https://teams.microsoft.com/l/meetup-join/from-weblink'
    expect(
      resolveNoteMeetingJoinUrl(
        { joinUrl: null, webLink: url, location: null },
        { joinUrl: null, bodyHtml: null, location: null, isOnlineMeeting: true }
      )
    ).toBe(url)
  })
})

describe('buildNoteMeetingInsertHtml', () => {
  it('rendert Kernfelder und Checkliste', () => {
    const html = buildNoteMeetingInsertHtml({
      event: baseEvent,
      whenLabel: 'Di., 1. Juli 2026 · 12:00 – 13:00',
      labels,
      details: {
        attendeeEmails: ['a@example.com', 'b@example.com'],
        joinUrl: 'https://teams.microsoft.com/l/meetup-join/abc',
        location: 'Raum A',
        organizer: 'Max Mustermann',
        bodyHtml: null,
        isOnlineMeeting: true
      }
    })

    expect(html).toContain('<h2>Projekt-Review</h2>')
    expect(html).toContain('Raum A')
    expect(html).toContain('Max Mustermann')
    expect(html).toContain('a@example.com, b@example.com')
    expect(html).toContain('href="https://teams.microsoft.com/l/meetup-join/abc"')
    expect(html).not.toContain('href="#"')
    expect(html).toContain('data-type="taskList"')
    expect(html).toContain('<h3>Agenda</h3>')
  })

  it('escaped gefährliche Zeichen im Titel', () => {
    const html = buildNoteMeetingInsertHtml({
      event: { ...baseEvent, title: '<script>alert(1)</script>' },
      whenLabel: 'Heute',
      labels,
      details: null
    })
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })
})
