import { describe, expect, it } from 'vitest'
import {
  cleanTeamsMeetingJoinInformationHtml,
  dedupeRepeatedWebinarTailSections,
  extractTeamsMeetingJoinBlockHtml,
  htmlAlreadyHasTeamsMeetingJoinBlock,
  injectTeamsMeetingBlobIntoWebinarInvitation,
  isEffectivelyEmptyCalendarBodyHtml,
  lightenEmbeddedTeamsMeetingBlobInWebinarHtml,
  lightenTeamsMeetingBlobForDarkPanel,
  linkifyBareUrlsInHtmlFragment,
  mergeCalendarEventBodyPreservingTeamsMeetingBlob,
  prepareCalendarEventBodyHtml,
  prepareCalendarEventDescriptionFromEditorHtml,
  promoteIframeSourcesToLinksInHtml,
  stripTeamsMeetingJoinBlockHtml
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

  it('zerstoert Teams-Firmenlogo-img-src nicht und entfernt asyncgw-Logos', () => {
    const logoSrc =
      'https://eu-prod.asyncgw.teams.microsoft.com/v1/objects/0-neu-d3-abc/views/imgt2?amsauth=token.with.dots'
    const html = [
      '<div>',
      `<img src="${logoSrc}" alt="Company Logo" style="height:32px">`,
      '<p>Microsoft Teams-Besprechung</p>',
      '<p><a href="https://teams.microsoft.com/meet/123">Teilnehmen</a></p>',
      '</div>'
    ].join('')
    const out = prepareCalendarEventBodyHtml(html)
    expect(out).toContain('Microsoft Teams-Besprechung')
    expect(out).toContain('https://teams.microsoft.com/meet/123')
    expect(out).not.toContain('asyncgw.teams.microsoft.com')
    expect(out).not.toContain('amsauth=')
    expect(out).not.toContain('alt="Company Logo"')
  })

  it('laesst Webinar-Hero-Bilder bei asyncgw im Teams-Blob unveraendert', () => {
    const logoSrc =
      'https://eu-prod.asyncgw.teams.microsoft.com/v1/objects/0-neu-d3-abc/views/imgt2?amsauth=token.with.dots'
    const webinar = [
      '<table id="kurtrocks" bgcolor="#121212"><tr><td>',
      '<img src="cid:hero-image" alt="Hero" style="width:100%;display:block" width="640" border="0">',
      '<p>Microsoft Teams-Besprechung</p>',
      `<img src="${logoSrc}" alt="Company Logo" style="height:32px">`,
      '<p><a href="https://teams.microsoft.com/meet/123">Teilnehmen</a></p>',
      '</td></tr></table>'
    ].join('')
    const out = prepareCalendarEventBodyHtml(webinar)
    expect(out).toContain('cid:hero-image')
    expect(out).toContain('alt="Hero"')
    expect(out).toContain('width="640"')
    expect(out).toContain('https://teams.microsoft.com/meet/123')
    expect(out).toContain('asyncgw.teams.microsoft.com')
  })
})

describe('cleanTeamsMeetingJoinInformationHtml', () => {
  it('entfernt zerschossene asyncgw-URL-Reste', () => {
    const broken =
      'https://eu-prod.asyncgw.teams.microsoft.com/v1/objects/x/views/imgt2?amsauth=tok " alt="Company Logo" style="height:32px; display:block; margin-bottom:6px">'
    expect(cleanTeamsMeetingJoinInformationHtml(broken)).toBe('')
  })
})

describe('dedupeRepeatedWebinarTailSections', () => {
  it('entfernt doppelt angehaengte Hinweise/Signatur-Bloecke', () => {
    const tail = [
      '<p>Hinweise &amp; Hilfen</p>',
      '<p>Mit lieben Grüßen</p>',
      '<p><strong>#kurtrocks</strong></p>'
    ].join('')
    const html = `<table bgcolor="#121212"><tr><td><p>Titel</p>${tail}${tail}${tail}</td></tr></table>`
    const out = dedupeRepeatedWebinarTailSections(html)
    expect(out.match(/Hinweise/gi)?.length).toBe(1)
    expect(out).toContain('#kurtrocks')
  })
})

describe('injectTeamsMeetingBlobIntoWebinarInvitation idempotent', () => {
  it('haengt Teams-Blob bei Webinar nicht mehr blind ans Ende an', () => {
    const webinar = [
      '<table bgcolor="#121212"><tr><td>',
      '<p style="margin:0 0 6px;font:700 24px">Demo</p>',
      '<p>Microsoft Teams</p>',
      '<p>Hinweise &amp; Hilfen</p>',
      '</td></tr></table>'
    ].join('')
    const blob = '<p>Microsoft Teams-Besprechung</p><p>https://teams.microsoft.com/meet/123</p>'
    const out = injectTeamsMeetingBlobIntoWebinarInvitation(`${webinar}${blob}`, blob)
    expect(out.match(/Hinweise/gi)?.length).toBe(1)
    expect(out.match(/Microsoft Teams-Besprechung/g)?.length).toBe(1)
  })
})

describe('extractTeamsMeetingJoinBlockHtml', () => {
  it('schneidet den Teams-Block ab der Ueberschrift heraus', () => {
    const html = [
      '<p>Agenda: Kickoff</p>',
      '<p>Microsoft Teams-Besprechung</p>',
      '<p><a href="https://teams.microsoft.com/meet/123">Teilnehmen</a></p>'
    ].join('')
    const out = extractTeamsMeetingJoinBlockHtml(html)
    expect(out).toContain('Microsoft Teams-Besprechung')
    expect(out).toContain('https://teams.microsoft.com/meet/123')
    expect(out).not.toContain('Agenda')
  })

  it('erkennt vorhandenen Join-Block', () => {
    const html =
      '<p>Microsoft Teams-Besprechung</p><p>https://teams.microsoft.com/meet/abc</p>'
    expect(htmlAlreadyHasTeamsMeetingJoinBlock(html)).toBe(true)
    expect(htmlAlreadyHasTeamsMeetingJoinBlock('<p>Nur Text</p>')).toBe(false)
  })

  it('schneidet Webinar-Teams-Blob vor Umfrage/Hinweisen ab', () => {
    const html = [
      '<table bgcolor="#121212"><tr><td>',
      '<p style="margin:0 0 4px">🎥&nbsp; Microsoft Teams</p>',
      '<p>Live dabei sein — Link bzw. Microsoft-Zugangsblock:</p>',
      '<div>',
      '<p>Microsoft Teams-Besprechung</p>',
      '<p><a href="https://teams.microsoft.com/meet/123">Join</a></p>',
      '<p>Besprechungs-ID: 123</p>',
      '</div>',
      '<table><tr><td><span>📋&nbsp; Kurze Umfrage</span></td></tr></table>',
      '<p>Zur Vorbereitung</p>',
      '<table><tr><td><span>💡&nbsp; Hinweise &amp; Hilfen</span></td></tr></table>',
      '<p>#kurtrocks</p>',
      '</td></tr></table>'
    ].join('')
    const blob = extractTeamsMeetingJoinBlockHtml(html)
    expect(blob).toContain('Microsoft Teams-Besprechung')
    expect(blob).toContain('Besprechungs-ID')
    expect(blob).not.toContain('Kurze Umfrage')
    expect(blob).not.toContain('Hinweise')
    expect(blob).not.toContain('Live dabei sein')

    const stripped = stripTeamsMeetingJoinBlockHtml(html)
    expect(stripped).toContain('Kurze Umfrage')
    expect(stripped).toContain('Hinweise &amp; Hilfen')
    expect(stripped).toContain('Microsoft Teams')
    expect(stripped).not.toContain('Besprechungs-ID')
    expect(stripped).not.toContain('teams.microsoft.com/meet/123')
  })
})

describe('mergeCalendarEventBodyPreservingTeamsMeetingBlob', () => {
  const blob = [
    '<div>',
    '<p>Microsoft Teams-Besprechung</p>',
    '<p><a href="https://teams.microsoft.com/meet/123?p=abc">Join</a></p>',
    '<p>Besprechungs-ID: 123</p>',
    '</div>'
  ].join('')

  it('haengt den Graph-Blob an die User-Beschreibung an', () => {
    const out = mergeCalendarEventBodyPreservingTeamsMeetingBlob(
      '<p>Agenda und Banner</p>',
      `<p>alt</p>${blob}`
    )
    expect(out).toContain('Agenda und Banner')
    expect(out).toContain('https://teams.microsoft.com/meet/123?p=abc')
    expect(out).toContain('Besprechungs-ID')
  })

  it('ersetzt nicht den Blob durch leeren User-Body', () => {
    const out = mergeCalendarEventBodyPreservingTeamsMeetingBlob('<p></p>', blob)
    expect(out).toContain('https://teams.microsoft.com/meet/123?p=abc')
  })

  it('entfernt doppelten Teams-Block aus dem User-HTML', () => {
    const out = mergeCalendarEventBodyPreservingTeamsMeetingBlob(
      `<p>Hallo</p>${blob}`,
      blob
    )
    expect(out.match(/teams\.microsoft\.com\/meet\/123/gi)?.length).toBe(1)
    expect(out).toContain('Hallo')
  })

  it('entfernt Webinar-Teams-Zugangsdaten-Duplikat und behaelt Graph-Blob', () => {
    const webinar = [
      '<p>Demo-Webinar</p>',
      '<table><tr><td>Teams-Zugangsdaten</td></tr>',
      '<tr><td><a href="https://teams.microsoft.com/meet/999">Link</a></td></tr></table>'
    ].join('')
    const out = mergeCalendarEventBodyPreservingTeamsMeetingBlob(webinar, blob)
    expect(out).toContain('Demo-Webinar')
    expect(out).toContain('Besprechungs-ID')
    expect(out).toContain('https://teams.microsoft.com/meet/123?p=abc')
    expect(out).not.toContain('teams.microsoft.com/meet/999')
  })

  it('setzt den Graph-Blob in den Webinar-Teams-Slot statt ans Ende', () => {
    const webinar = [
      '<table><tr><td>',
      '<span id="chronell-webinar-teams-slot"><p>Vorschau</p></span>',
      '</td></tr></table>'
    ].join('')
    const out = mergeCalendarEventBodyPreservingTeamsMeetingBlob('<p>Agenda</p>' + webinar, blob)
    expect(out).toContain('Agenda')
    expect(out).toContain('Microsoft Teams-Besprechung')
    expect(out).not.toContain('Vorschau')
    expect(out).not.toContain('chronell-webinar-teams-slot')
  })

  it('behält volles Kurtrocks-Layout wenn Graph-Body nur Teams-Blob ist', () => {
    const webinar = [
      '<table bgcolor="#121212"><tr><td>',
      '<p style="margin:0 0 6px;font:700 24px/1.25 Segoe UI">Demo-Webinar</p>',
      '<span id="chronell-webinar-teams-slot"><p>Platzhalter</p></span>',
      '<p>Hinweise &amp; Hilfen</p>',
      '</td></tr></table>'
    ].join('')
    const out = mergeCalendarEventBodyPreservingTeamsMeetingBlob(webinar, blob)
    expect(out).toContain('Demo-Webinar')
    expect(out).toContain('Hinweise &amp; Hilfen')
    expect(out).toContain('Besprechungs-ID')
    expect(out).not.toContain('chronell-webinar-teams-slot')
  })

  it('behaelt Umfrage/Hinweise wenn Graph-Body bereits Blob+Layout enthaelt', () => {
    const graphBody = [
      '<table bgcolor="#121212"><tr><td>',
      '<p>🎥&nbsp; Microsoft Teams</p>',
      '<p>Live dabei sein</p>',
      blob,
      '<table><tr><td>Kurze Umfrage</td></tr></table>',
      '<p>Hinweise &amp; Hilfen</p>',
      '<p>#kurtrocks</p>',
      '</td></tr></table>'
    ].join('')
    const editor = [
      '<table bgcolor="#121212"><tr><td>',
      '<p>🎥&nbsp; Microsoft Teams</p>',
      '<p>Live dabei sein</p>',
      '<span id="chronell-webinar-teams-slot"><p>Platzhalter</p></span>',
      '<table><tr><td>Kurze Umfrage</td></tr></table>',
      '<p>Hinweise &amp; Hilfen</p>',
      '<p>#kurtrocks</p>',
      '</td></tr></table>'
    ].join('')
    const out = mergeCalendarEventBodyPreservingTeamsMeetingBlob(editor, graphBody)
    expect(out).toContain('Kurze Umfrage')
    expect(out).toContain('Hinweise &amp; Hilfen')
    expect(out).toContain('Besprechungs-ID')
    expect(out.match(/Kurze Umfrage/g)?.length).toBe(1)
  })

  it('Outlook-Dokument-Closer duerfen nicht vor Umfrage/Hinweise landen', () => {
    const outlookBody = [
      '<html><head><meta charset="utf-8"></head><body>',
      '<div>',
      '<div class="me-email-text">',
      '<div style="margin:0">',
      '<a href="https://teams.microsoft.com/l/meetup-join/19%3ameeting_x">Microsoft Teams-Besprechung</a>',
      '</div>',
      '<div>Besprechungs-ID: 123 456</div>',
      '</div>',
      '</div>',
      '</body></html>'
    ].join('')
    const webinar = [
      '<table bgcolor="#121212"><tr><td>',
      '<p>#kurtrocks</p>',
      '<p>Microsoft Teams</p>',
      '<span id="chronell-webinar-teams-slot"><p>Platzhalter</p></span>',
      '<table><tr><td><span>Kurze Umfrage</span></td></tr></table>',
      '<p>Hinweise &amp; Hilfen</p>',
      '</td></tr></table>'
    ].join('')
    const out = mergeCalendarEventBodyPreservingTeamsMeetingBlob(webinar, outlookBody)
    const umfrage = out.indexOf('Kurze Umfrage')
    const hinweise = out.indexOf('Hinweise')
    expect(umfrage).toBeGreaterThan(0)
    expect(hinweise).toBeGreaterThan(umfrage)
    expect(out).toContain('Besprechungs-ID')
    expect(out).toContain('meetup-join')
    // Kein Dokument-Closer vor den Post-Teams-Sektionen
    const htmlClose = out.search(/<\/(?:html|body)\s*>/i)
    expect(htmlClose).toBe(-1)
    // Auch kein orphan </div> unmittelbar vor Umfrage durch abgeschnittenen Blob:
    // Umfrage muss NACH dem Join-Inhalt stehen und gerendert werden koennen.
    expect(umfrage).toBeGreaterThan(out.indexOf('Besprechungs-ID'))
  })
})

describe('lightenTeamsMeetingBlobForDarkPanel', () => {
  it('setzt alle Nicht-Link-Textfarben auf Weiss und laesst Linkfarben', () => {
    const blob = [
      '<div>',
      '<p><span style="font-size:18px;color:#252424"><b>Microsoft Teams-Besprechung</b></span></p>',
      '<p><span style="color:#323130">Teilnehmen:</span> ',
      '<a href="https://teams.microsoft.com/meet/1" style="color:#5B5FC7">https://teams.microsoft.com/meet/1</a></p>',
      '<div style="color:#605e5c">Besprechungs-ID: 332 670 119 805 430</div>',
      '<div style="color:rgb(37,36,36)">Passcode: Gy3aK6gZ</div>',
      '<span style="color:#b3b0ad !important">Passcode:</span>',
      '</div>'
    ].join('')
    const out = lightenTeamsMeetingBlobForDarkPanel(blob)
    expect(out).toContain('color:#ffffff')
    expect(out).toContain('data-chronell-teams-light="1"')
    expect(out).not.toMatch(/color:#252424/i)
    expect(out).not.toMatch(/color:#323130/i)
    expect(out).not.toMatch(/color:#605e5c/i)
    expect(out).not.toMatch(/color:#b3b0ad/i)
    expect(out).toContain('color:#5B5FC7')
    expect(out).toContain('Besprechungs-ID: 332 670 119 805 430')
  })

  it('hellt eingebetteten Teams-Blob in Webinar-HTML nach', () => {
    const html = [
      '<table bgcolor="#0f0f0f"><tr><td>',
      '<p>#kurtrocks</p>',
      '<td bgcolor="#151b28">',
      '<p style="color:#252424">Microsoft Teams-Besprechung</p>',
      '<p><a href="https://teams.microsoft.com/meet/xyz">Join</a></p>',
      '<p style="color:#605e5c">Besprechungs-ID: 123</p>',
      '</td></tr></table>'
    ].join('')
    const out = lightenEmbeddedTeamsMeetingBlobInWebinarHtml(html)
    expect(out).toContain('color:#ffffff')
    expect(out).not.toMatch(/color:#252424/i)
    expect(out).toContain('https://teams.microsoft.com/meet/xyz')
  })
})

describe('injectTeamsMeetingBlobIntoWebinarInvitation', () => {
  const blob = '<p>Microsoft Teams-Besprechung</p><p>https://teams.microsoft.com/meet/xyz</p>'

  it('ersetzt den Teams-Slot durch den Graph-Blob', () => {
    const html =
      '<span id="chronell-webinar-teams-slot"><p>Platzhalter</p></span>'
    const out = injectTeamsMeetingBlobIntoWebinarInvitation(html, blob)
    expect(out).toContain('Microsoft Teams-Besprechung')
    expect(out).not.toContain('chronell-webinar-teams-slot')
    expect(out).not.toContain('Platzhalter')
  })

  it('hellt dunkle Teams-Textfarben im Webinar-Slot auf', () => {
    const darkBlob = [
      '<p><span style="color:#252424">Microsoft Teams-Besprechung</span></p>',
      '<p><span style="color:#323130">Teilnehmen:</span></p>',
      '<p><a href="https://teams.microsoft.com/meet/xyz" style="color:#467886">Join</a></p>',
      '<p style="color:#605e5c">Besprechungs-ID: 123</p>',
      '<p style="color:#605e5c">Passcode: Abc</p>'
    ].join('')
    const html = [
      '<table bgcolor="#0f0f0f"><tr><td bgcolor="#151b28" style="background-color:#151b28">',
      '<span id="chronell-webinar-teams-slot"><p>Platzhalter</p></span>',
      '<p>#kurtrocks</p>',
      '</td></tr></table>'
    ].join('')
    const out = injectTeamsMeetingBlobIntoWebinarInvitation(html, darkBlob)
    expect(out).toContain('Microsoft Teams-Besprechung')
    expect(out).toContain('color:#ffffff')
    expect(out).not.toMatch(/color:#252424/i)
    expect(out).toContain('color:#467886')
  })

  it('hellt Teams-Text bei heller Vorlage nicht auf', () => {
    const darkBlob =
      '<p style="color:#252424">Microsoft Teams-Besprechung</p><p><a href="https://teams.microsoft.com/meet/xyz">Join</a></p>'
    const html = [
      '<table bgcolor="#f5f2eb"><tr><td bgcolor="#e8eef8" style="background-color:#e8eef8">',
      '<span id="chronell-webinar-teams-slot"><p>Platzhalter</p></span>',
      '<p>#kurtrocks</p>',
      '</td></tr></table>'
    ].join('')
    const out = injectTeamsMeetingBlobIntoWebinarInvitation(html, darkBlob)
    expect(out).toContain('color:#252424')
    expect(out).not.toContain('data-chronell-teams-light')
  })

  it('ersetzt den Slot auch bei verschachteltem Join-Link-span', () => {
    const html = [
      '<p>Microsoft Teams</p>',
      '<span id="chronell-webinar-teams-slot">',
      '<p><a href="https://teams.microsoft.com/l/meetup-join/x">',
      '<span style="color:#4ea1ff">▶ Teams-Besprechung beitreten</span>',
      '</a></p>',
      '</span>',
      '<p>Hinweise &amp; Hilfen</p>'
    ].join('')
    const out = injectTeamsMeetingBlobIntoWebinarInvitation(html, blob)
    expect(out).toContain('Microsoft Teams-Besprechung')
    expect(out).toContain('Hinweise &amp; Hilfen')
    expect(out).not.toContain('chronell-webinar-teams-slot')
    expect(out).not.toContain('Teams-Besprechung beitreten')
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

  it('linkifiziert www.-URLs mit https-href', () => {
    expect(linkifyBareUrlsInHtmlFragment('<p>www.example.com</p>')).toBe(
      '<p><a href="https://www.example.com/">www.example.com</a></p>'
    )
  })

  it('normalisiert relative hrefs in bestehenden Ankern', () => {
    expect(linkifyBareUrlsInHtmlFragment('<p><a href="www.x.test">X</a></p>')).toBe(
      '<p><a href="https://www.x.test/">X</a></p>'
    )
  })

  it('laesst URLs in img-src-Attributen unveraendert', () => {
    const html =
      '<p><img src="https://cdn.example.com/logo.png?x=1" alt="Logo"> siehe https://example.com</p>'
    expect(linkifyBareUrlsInHtmlFragment(html)).toBe(
      '<p><img src="https://cdn.example.com/logo.png?x=1" alt="Logo"> siehe <a href="https://example.com">https://example.com</a></p>'
    )
  })
})

describe('isEffectivelyEmptyCalendarBodyHtml', () => {
  it('erkennt leere Editor-Fragmente', () => {
    expect(isEffectivelyEmptyCalendarBodyHtml('<p><br></p>')).toBe(true)
    expect(isEffectivelyEmptyCalendarBodyHtml('<p>Link</p>')).toBe(false)
  })
})
