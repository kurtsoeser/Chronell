import { describe, expect, it } from 'vitest'
import { buildOneNoteMailPageHtml, htmlToPlainForOneNote } from './onenote-page-html'

describe('htmlToPlainForOneNote', () => {
  it('entfernt Skripte und behält Absätze', () => {
    expect(htmlToPlainForOneNote('<p>Hallo</p><script>alert(1)</script><p>Welt</p>')).toBe(
      'Hallo\nWelt'
    )
  })
})

describe('buildOneNoteMailPageHtml', () => {
  it('setzt den Betreff als Titel und maskiert HTML', () => {
    const html = buildOneNoteMailPageHtml({
      subject: 'Vertrag <Wichtig>',
      fromName: 'Ada',
      fromAddr: 'ada@example.com',
      toAddrs: 'ich@example.com',
      ccAddrs: null,
      dateLabel: '25.11.2026, 10:00',
      webLink: 'https://outlook.office.com/mail/id',
      bodyText: 'Zeile 1\n\nZeile <2>',
      bodyHtml: null,
      hasAttachments: true
    })
    expect(html).toContain('<title>Vertrag &lt;Wichtig&gt;</title>')
    expect(html).toContain('Ada &lt;ada@example.com&gt;')
    expect(html).toContain('href="https://outlook.office.com/mail/id"')
    expect(html).toContain('Zeile &lt;2&gt;')
    expect(html).toContain('Anhänge bleiben in der Mail')
    expect(html).not.toContain('<script')
  })

  it('ignoriert Links, die keine http-URL sind', () => {
    const html = buildOneNoteMailPageHtml({
      subject: 'Test',
      fromName: null,
      fromAddr: null,
      toAddrs: null,
      ccAddrs: null,
      dateLabel: null,
      webLink: 'javascript:alert(1)',
      bodyText: null,
      bodyHtml: '<p>Nur HTML</p>',
      hasAttachments: false
    })
    expect(html).not.toContain('javascript:')
    expect(html).toContain('Nur HTML')
  })
})
