// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import {
  extractNoteMeetingBlocksFromHtml,
  noteMeetingBlockKey,
  refreshNoteMeetingHeadersInHtml
} from './note-meeting-sync'
import {
  NOTE_MEETING_ACCOUNT_ID_ATTR,
  NOTE_MEETING_BLOCK_ATTR,
  NOTE_MEETING_GRAPH_EVENT_ID_ATTR,
  NOTE_MEETING_HEADER_ATTR,
  buildNoteMeetingInsertHtml
} from './note-meeting-insert-html'

const labels = {
  date: 'Zeit',
  location: 'Ort',
  organizer: 'Organisator',
  attendees: 'Teilnehmer',
  onlineMeeting: 'Online',
  joinMeeting: 'Beitreten',
  meetingRecap: 'Zusammenfassung',
  viewRecap: 'In Teams öffnen',
  meetingRecording: 'Aufzeichnung',
  viewRecording: 'Aufzeichnung öffnen',
  agenda: 'Agenda',
  notes: 'Notizen',
  nextSteps: 'Nächste Schritte'
}

describe('note-meeting-sync', () => {
  it('erkennt markierte Besprechungsblöcke', () => {
    const html = buildNoteMeetingInsertHtml({
      event: {
        title: 'Review',
        startIso: '2026-07-01T10:00:00.000Z',
        endIso: '2026-07-01T11:00:00.000Z',
        isAllDay: false,
        location: null,
        organizer: null,
        joinUrl: null,
        webLink: null
      },
      whenLabel: 'Heute',
      labels,
      metadata: { accountId: 'ms:abc', graphEventId: 'evt-1' }
    })
    const blocks = extractNoteMeetingBlocksFromHtml(html)
    expect(blocks).toHaveLength(1)
    expect(blocks[0]?.accountId).toBe('ms:abc')
    expect(blocks[0]?.graphEventId).toBe('evt-1')
    expect(blocks[0]?.headerHtml).toContain('<h2>Review</h2>')
  })

  it('aktualisiert nur den Kopfbereich und behält Nutzerinhalte', () => {
    const html = `${buildNoteMeetingInsertHtml({
      event: {
        title: 'Alt',
        startIso: '2026-07-01T10:00:00.000Z',
        endIso: '2026-07-01T11:00:00.000Z',
        isAllDay: false,
        location: 'Raum 1',
        organizer: null,
        joinUrl: null,
        webLink: null
      },
      whenLabel: 'Alt',
      labels,
      metadata: { accountId: 'ms:abc', graphEventId: 'evt-1' }
    })}`.replace('<ul><li></li></ul>', '<ul><li><p>Agenda-Punkt</p></li></ul>')

    const key = noteMeetingBlockKey({ accountId: 'ms:abc', graphEventId: 'evt-1' })
    const updates = new Map([
      [
        key,
        {
          metadata: { accountId: 'ms:abc', graphEventId: 'evt-1' },
          event: {
            title: 'Neu',
            startIso: '2026-07-02T10:00:00.000Z',
            endIso: '2026-07-02T11:00:00.000Z',
            isAllDay: false,
            location: 'Raum 2',
            organizer: 'Max',
            joinUrl: null,
            webLink: null
          },
          details: null,
          whenLabel: 'Morgen',
          labels
        }
      ]
    ])

    const { html: next, updatedCount } = refreshNoteMeetingHeadersInHtml(html, updates)
    expect(updatedCount).toBe(1)
    expect(next).toContain('<h2>Neu</h2>')
    expect(next).toContain('Raum 2')
    expect(next).toContain('Agenda-Punkt')
    expect(next).toContain(NOTE_MEETING_BLOCK_ATTR)
    expect(next).toContain(NOTE_MEETING_HEADER_ATTR)
    expect(next).toContain(NOTE_MEETING_ACCOUNT_ID_ATTR)
    expect(next).toContain(NOTE_MEETING_GRAPH_EVENT_ID_ATTR)
  })
})
