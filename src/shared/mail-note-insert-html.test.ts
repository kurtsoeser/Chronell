import { describe, expect, it } from 'vitest'
import { buildMailNoteInsertHtml, formatMailFromLine } from './mail-note-insert-html'
import type { MailFull } from './types'
import { makeMailListItem } from '../test-fixtures/mail'

const labels = {
  from: 'Von',
  to: 'An',
  date: 'Datum',
  subject: 'Betreff',
  excerpt: 'E-Mail'
}

function sampleMail(overrides: Partial<MailFull> = {}): MailFull {
  return {
    ...makeMailListItem(42, {
      subject: 'Projekt-Update',
      fromName: 'Max Mustermann',
      fromAddr: 'max@example.com',
      toAddrs: 'team@example.com',
      receivedAt: '2026-07-01T10:30:00.000Z',
      isRead: true,
      snippet: 'Kurzinfo'
    }),
    bodyHtml: '<p>Hallo Team,</p><p>bitte prüfen.</p>',
    bodyText: null,
    ccAddrs: null,
    openTodoId: null,
    openTodoDueKind: null,
    openTodoDueAt: null,
    openTodoStartAt: null,
    openTodoEndAt: null,
    categories: [],
    ...overrides
  }
}

describe('formatMailFromLine', () => {
  it('formatiert Name und Adresse', () => {
    expect(
      formatMailFromLine({ fromName: 'Anna', fromAddr: 'a@b.de' })
    ).toBe('Anna <a@b.de>')
  })
})

describe('buildMailNoteInsertHtml', () => {
  it('enthält Metadaten und Mail-Body', () => {
    const html = buildMailNoteInsertHtml(sampleMail(), labels, { locale: 'de-DE' })
    expect(html).toContain('Projekt-Update')
    expect(html).toContain('Max Mustermann')
    expect(html).toContain('team@example.com')
    expect(html).toContain('Hallo Team')
    expect(html).toContain('bitte prüfen')
  })

  it('nutzt Auswahltext statt ganzer Mail', () => {
    const html = buildMailNoteInsertHtml(sampleMail(), labels, {
      selectionText: 'Nur dieser Satz.'
    })
    expect(html).toContain('Nur dieser Satz.')
    expect(html).not.toContain('bitte prüfen')
  })

  it('escaped gefährliches HTML in Auswahl', () => {
    const html = buildMailNoteInsertHtml(sampleMail(), labels, {
      selectionText: '<script>alert(1)</script>'
    })
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })
})
