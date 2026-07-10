import { describe, expect, it } from 'vitest'
import {
  isEffectivelyEmptyCalendarBodyHtml,
  linkifyBareUrlsInHtmlFragment,
  prepareCalendarEventBodyHtml,
  prepareCalendarEventDescriptionFromEditorHtml,
  promoteIframeSourcesToLinksInHtml
} from './calendar-event-body-html'

describe('prepareCalendarEventBodyHtml', () => {
  it('gibt null fuer leere Beschreibung zurueck', () => {
    expect(prepareCalendarEventBodyHtml(null)).toBeNull()
    expect(prepareCalendarEventBodyHtml('   ')).toBeNull()
    expect(prepareCalendarEventBodyHtml('<p>&nbsp;</p>')).toBeNull()
  })

  it('linkifiziert nackte URLs in HTML-Absaetzen', () => {
    expect(prepareCalendarEventBodyHtml('<p>https://example.com/path</p>')).toBe(
      '<p><a href="https://example.com/path">https://example.com/path</a></p>'
    )
  })

  it('laesst bestehende Anker unveraendert', () => {
    const html = '<p>Mehr unter <a href="https://example.com">Beispiel</a></p>'
    expect(prepareCalendarEventBodyHtml(html)).toBe(html)
  })

  it('wandelt Plain-Text in HTML mit Link um', () => {
    expect(prepareCalendarEventBodyHtml('Infos: https://example.com')).toBe(
      '<p>Infos: <a href="https://example.com">https://example.com</a></p>'
    )
  })
})

describe('promoteIframeSourcesToLinksInHtml', () => {
  const FORM_ID = 'abc123'
  const FORMS_URL = `https://forms.office.com/Pages/ResponsePage.aspx?id=${FORM_ID}`

  it('ersetzt Microsoft-Forms-iframes durch klickbare Links', () => {
    const html = `<p>Bitte ausfüllen:</p><iframe src="${FORMS_URL}&amp;embed=true" width="640"></iframe>`
    const promoted = promoteIframeSourcesToLinksInHtml(html)
    expect(promoted).toContain(`<a href="${FORMS_URL}"`)
    expect(promoted).not.toContain('<iframe')
  })

  it('ersetzt generische https-iframes durch Links', () => {
    const html = '<iframe src="https://example.com/form"></iframe>'
    expect(promoteIframeSourcesToLinksInHtml(html)).toContain(
      '<a href="https://example.com/form"'
    )
  })
})

describe('prepareCalendarEventDescriptionFromEditorHtml', () => {
  const FORM_ID = 'abc123'
  const FORMS_URL = `https://forms.office.com/Pages/ResponsePage.aspx?id=${FORM_ID}`

  it('erhaelt Forms-Links auch nach Sanitizing ohne iframe', () => {
    const html = `<iframe src="${FORMS_URL}&embed=true"></iframe>`
    const result = prepareCalendarEventDescriptionFromEditorHtml(html, (input) =>
      input.replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    )
    expect(result).toContain(`<a href="${FORMS_URL}"`)
    expect(result).not.toContain('<iframe')
  })
})

describe('linkifyBareUrlsInHtmlFragment', () => {
  it('linkifiziert nur ausserhalb bestehender Anker', () => {
    expect(
      linkifyBareUrlsInHtmlFragment(
        '<p>https://a.test</p><p><a href="https://b.test">B</a> https://c.test</p>'
      )
    ).toBe(
      '<p><a href="https://a.test">https://a.test</a></p><p><a href="https://b.test">B</a> <a href="https://c.test">https://c.test</a></p>'
    )
  })
})

describe('isEffectivelyEmptyCalendarBodyHtml', () => {
  it('erkennt leere Editor-Fragmente', () => {
    expect(isEffectivelyEmptyCalendarBodyHtml('<p><br></p>')).toBe(true)
    expect(isEffectivelyEmptyCalendarBodyHtml('<p>Link</p>')).toBe(false)
  })
})
