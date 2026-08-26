/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest'
import { prepareComposeOutgoingHtmlFragment } from './sanitize-compose-html'

describe('prepareComposeOutgoingHtmlFragment', () => {
  it('linkifiziert nackte URLs in Signatur-HTML', () => {
    expect(prepareComposeOutgoingHtmlFragment('<p>https://example.com</p>')).toContain(
      '<a href="https://example.com">https://example.com</a>'
    )
  })

  it('laesst bestehende Anker unveraendert', () => {
    const html = '<p>Web: <a href="https://example.com">Beispiel</a></p>'
    expect(prepareComposeOutgoingHtmlFragment(html)).toBe(html)
  })

  it('wandelt eingebettete Forms-iframes in Links um', () => {
    const url = 'https://forms.office.com/Pages/ResponsePage.aspx?id=abc'
    const html = `<iframe src="${url}&embed=true"></iframe>`
    const out = prepareComposeOutgoingHtmlFragment(html)
    expect(out).toContain(`<a href="${url}"`)
    expect(out).not.toContain('<iframe')
  })
})
