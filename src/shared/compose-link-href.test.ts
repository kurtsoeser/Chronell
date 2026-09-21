import { describe, expect, it } from 'vitest'
import {
  normalizeAnchorHrefsInHtmlFragment,
  normalizeComposeLinkHref
} from './compose-link-href'

describe('normalizeComposeLinkHref', () => {
  it('laesst absolute https-URLs unveraendert (normalisiert)', () => {
    expect(normalizeComposeLinkHref('https://example.com/path')).toBe('https://example.com/path')
  })

  it('ergaenzt https fuer www. und bare Domains', () => {
    expect(normalizeComposeLinkHref('www.example.com')).toBe('https://www.example.com/')
    expect(normalizeComposeLinkHref('example.com/foo')).toBe('https://example.com/foo')
  })

  it('lehnt leere und nur-Protokoll-Eingaben ab', () => {
    expect(normalizeComposeLinkHref('')).toBeNull()
    expect(normalizeComposeLinkHref('https://')).toBeNull()
    expect(normalizeComposeLinkHref('http://')).toBeNull()
  })

  it('lehnt unsichere Schemas ab', () => {
    expect(normalizeComposeLinkHref('javascript:alert(1)')).toBeNull()
    expect(normalizeComposeLinkHref('data:text/html,hi')).toBeNull()
  })

  it('behaelt mailto und tel', () => {
    expect(normalizeComposeLinkHref('mailto:a@b.test')).toBe('mailto:a@b.test')
    expect(normalizeComposeLinkHref('tel:+491234')).toBe('tel:+491234')
  })
})

describe('normalizeAnchorHrefsInHtmlFragment', () => {
  it('macht relative hrefs absolut', () => {
    const out = normalizeAnchorHrefsInHtmlFragment(
      '<p><a href="www.example.com">Beispiel</a></p>'
    )
    expect(out).toContain('href="https://www.example.com/"')
    expect(out).toContain('>Beispiel</a>')
  })

  it('laesst absolute hrefs unveraendert', () => {
    const html = '<p><a href="https://example.com">X</a></p>'
    expect(normalizeAnchorHrefsInHtmlFragment(html)).toBe(html)
  })
})
