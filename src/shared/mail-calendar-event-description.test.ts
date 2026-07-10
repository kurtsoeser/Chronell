import { describe, expect, it } from 'vitest'
import { buildMailCalendarEventDescriptionHtml } from './mail-calendar-event-description'
import type { MailFull } from './types'
import { makeMailListItem } from '../test-fixtures/mail'

function sampleMail(overrides: Partial<MailFull> = {}): MailFull {
  return {
    ...makeMailListItem(42, {
      subject: 'Projekt-Update',
      fromName: 'Max Mustermann',
      fromAddr: 'max@example.com',
      receivedAt: '2026-07-01T10:30:00.000Z',
      isRead: true,
      snippet: 'Kurzinfo'
    }),
    bodyHtml: '<p>Hallo <strong>Team</strong>,</p><p>bitte prüfen.</p>',
    bodyText: null,
    ccAddrs: null,
    bccAddrs: null,
    openTodoId: null,
    openTodoDueKind: null,
    openTodoDueAt: null,
    openTodoStartAt: null,
    openTodoEndAt: null,
    categories: [],
    ...overrides
  }
}

describe('buildMailCalendarEventDescriptionHtml', () => {
  it('bindet HTML-Body unescaped ein', () => {
    const html = buildMailCalendarEventDescriptionHtml(sampleMail())
    expect(html).toContain('<strong>Team</strong>')
    expect(html).toContain('Projekt-Update')
    expect(html).toContain('Max Mustermann')
    expect(html).not.toContain('&lt;strong&gt;')
  })

  it('faellt auf Plain-Text zurueck', () => {
    const html = buildMailCalendarEventDescriptionHtml(
      sampleMail({ bodyHtml: null, bodyText: 'Zeile eins\n\nZeile zwei' })
    )
    expect(html).toContain('Zeile eins')
    expect(html).toContain('<p>Zeile zwei</p>')
  })

  it('entfernt Script-Tags aus dem Mail-HTML', () => {
    const html = buildMailCalendarEventDescriptionHtml(
      sampleMail({ bodyHtml: '<p>OK</p><script>alert(1)</script>' })
    )
    expect(html).toContain('OK')
    expect(html).not.toContain('<script')
  })
})
