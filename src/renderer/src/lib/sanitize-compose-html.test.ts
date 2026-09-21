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

  it('linkifiziert www.-URLs und normalisiert href', () => {
    const out = prepareComposeOutgoingHtmlFragment('<p>Siehe www.example.com</p>')
    expect(out).toContain('href="https://www.example.com/"')
    expect(out).toContain('>www.example.com</a>')
  })

  it('normalisiert relative Anker-hrefs', () => {
    const out = prepareComposeOutgoingHtmlFragment(
      '<p><a href="www.example.com/path">Beispiel</a></p>'
    )
    expect(out).toContain('href="https://www.example.com/path"')
  })

  it('ersetzt Dark-Theme-Weiss durch lesbare Textfarbe', () => {
    const out = prepareComposeOutgoingHtmlFragment(
      '<p><span style="color:#ffffff">Hallo <a href="https://example.com">Link</a></span></p>'
    )
    expect(out).not.toMatch(/color\s*:\s*#ffffff/i)
    expect(out).toContain('href="https://example.com"')
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
