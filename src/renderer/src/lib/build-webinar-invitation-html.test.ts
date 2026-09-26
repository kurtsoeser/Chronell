/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest'
import {
  buildWebinarInvitationHtml,
  defaultKurtrocksWebinarSignatureHtml,
  defaultWebinarTipsHtml,
  ensureWebinarInvitationCtaSections,
  hardenWebinarInvitationLinksForOutlook,
  normalizeWebinarTipsHtmlInput,
  patchWebinarInvitationScheduleLabel,
  patchWebinarInvitationTitle
} from './build-webinar-invitation-html'
import { prepareWebinarInvitationSaveBundle } from './prepare-webinar-invitation-save'

describe('buildWebinarInvitationHtml', () => {
  it('setzt Titel, Hero, Umfrage, Website und #kurtrocks-Signatur', () => {
    const html = buildWebinarInvitationHtml({
      title: 'Microsoft Copilot im Unterricht',
      heroImageSrc: 'cid:hero@chronell.local',
      surveyUrl: 'https://forms.office.com/r/abc',
      surveyLabel: 'Umfrage',
      websiteUrl: 'https://www.kurtrocks.com/event',
      websiteLabel: 'Veranstaltungsseite',
      scheduleLabel: 'Mittwoch, 30. September 2026 | 14:30 – 17:30',
      teamsJoinUrl: 'https://teams.microsoft.com/meet/123?p=abc'
    })
    expect(html).toContain('Microsoft Copilot im Unterricht')
    expect(html).toContain('chronell-webinar-schedule')
    expect(html).toContain('🎓')
    expect(html).toContain('Liebe Webinarteilnehmerin!')
    expect(html).toContain('Lieber Webinarteilnehmer!')
    expect(html).toContain('cid:hero@chronell.local')
    expect(html).toContain('https://forms.office.com/r/abc')
    expect(html).toContain('https://www.kurtrocks.com/event')
    expect(html).toContain('14:30')
    expect(html).toContain('#kurtrocks')
    expect(html).toContain('mailto:kontakt@kurtrocks.com')
    expect(html).toContain('bgcolor=')
    expect(html).toContain('id="chronell-webinar-teams-slot"')
    expect(html).toContain('Teams-Besprechung beitreten')
    expect(html).toContain('https://teams.microsoft.com/meet/123?p=abc')
    // Umfrage/Website VOR Teams — Empfaenger sehen CTAs auch wenn Teams-Blob HTML bricht
    const surveyAt = html.indexOf('Kurze Umfrage')
    const websiteAt = html.search(/🌐[\s\S]*?Veranstaltungsseite|Veranstaltungsseite/i)
    const teamsAt = html.indexOf('chronell-webinar-teams-slot')
    expect(surveyAt).toBeGreaterThan(0)
    expect(teamsAt).toBeGreaterThan(surveyAt)
    expect(websiteAt).toBeGreaterThan(0)
    expect(teamsAt).toBeGreaterThan(websiteAt)
  })

  it('macht CTAs klickbar ohne nackte URL-Zeile', () => {
    const html = buildWebinarInvitationHtml({
      title: 'Test',
      heroImageSrc: null,
      surveyUrl: 'https://www.example.com/form',
      surveyLabel: 'Umfrage',
      websiteUrl: '',
      websiteLabel: 'Seite',
      scheduleLabel: null,
      teamsJoinUrl: null
    })
    expect(html).toContain('href="https://www.example.com/form"')
    expect(html).not.toContain('https://www.example.com/form</a></p>')
  })

  it('liefert Tipps als Tabellenzeilen', () => {
    expect(defaultWebinarTipsHtml()).toContain('<tr><td')
  })

  it('wandelt Plain-Text-Tipps in Bullet-Zeilen um', () => {
    const rows = normalizeWebinarTipsHtmlInput('Erster Tipp\nZweiter Tipp')
    expect(rows).toContain('Erster Tipp')
    expect(rows).toContain('Zweiter Tipp')
    expect(rows).toContain('<tr><td')
  })

  it('nutzt gespeicherte Hinweise aus der Vorlage', () => {
    const html = buildWebinarInvitationHtml({
      title: 'Test',
      heroImageSrc: null,
      surveyUrl: '',
      surveyLabel: '',
      websiteUrl: '',
      websiteLabel: '',
      scheduleLabel: null,
      tipsHtml: 'Neuer Hinweis eins\nNeuer Hinweis zwei'
    })
    expect(html).toContain('Neuer Hinweis eins')
    expect(html).toContain('Neuer Hinweis zwei')
  })

  it('fuegt Zusatztext und eigene Begruessung ein', () => {
    const html = buildWebinarInvitationHtml({
      title: 'Test',
      heroImageSrc: null,
      surveyUrl: '',
      surveyLabel: '',
      websiteUrl: '',
      websiteLabel: '',
      scheduleLabel: null,
      greetingHtml: 'Eigene Begruessung',
      supplementHtml: 'Zusatzinfo hier',
      signOffHtml: 'Viele Gruesse'
    })
    expect(html).toContain('Eigene Begruessung')
    expect(html).toContain('id="chronell-webinar-supplement"')
    expect(html).toContain('Zusatzinfo hier')
    expect(html).toContain('Viele Gruesse')
  })

  it('signatur-Links haben Outlook-sichere span-Huelle', () => {
    const sig = defaultKurtrocksWebinarSignatureHtml()
    expect(sig).toContain('kontakt@kurtrocks.com')
    expect(sig).toMatch(
      /<a[^>]+kontakt@kurtrocks\.com[^>]*>\s*<span style="color:#e8d5a3[^"]*">kontakt@kurtrocks\.com<\/span><\/a>/i
    )
  })
})

describe('patchWebinarInvitationTitle/Schedule', () => {
  it('patcht Titel und fuegt Terminzeile nach Titel-Karte ein', () => {
    const base = buildWebinarInvitationHtml({
      title: 'Alter Titel',
      heroImageSrc: null,
      surveyUrl: '',
      surveyLabel: '',
      websiteUrl: '',
      websiteLabel: '',
      scheduleLabel: null,
      teamsJoinUrl: null
    })
    expect(base).not.toContain('chronell-webinar-schedule')
    const withTitle = patchWebinarInvitationTitle(base, 'Neuer Webinar-Titel')
    expect(withTitle).toContain('Neuer Webinar-Titel')
    const withSchedule = patchWebinarInvitationScheduleLabel(withTitle, 'Sonntag | 10:00 – 11:00')
    expect(withSchedule).toContain('chronell-webinar-schedule')
    expect(withSchedule).toContain('Sonntag | 10:00 – 11:00')
  })
})

describe('hardenWebinarInvitationLinksForOutlook', () => {
  it('wrappt nackte Anker fuer dunkle Hintergruende', () => {
    const out = hardenWebinarInvitationLinksForOutlook(
      '<a href="https://example.com" style="color:#e8d5a3">Link</a>'
    )
    expect(out).toContain('<span style="color:#e8d5a3')
    expect(out).toContain('mso-style-priority:100')
  })
})

describe('ensureWebinarInvitationCtaSections', () => {
  it('fuegt fehlende Umfrage/Website vor dem Teams-Panel ein', () => {
    const base = buildWebinarInvitationHtml({
      title: 'Test',
      heroImageSrc: null,
      surveyUrl: '',
      surveyLabel: '',
      websiteUrl: '',
      websiteLabel: '',
      scheduleLabel: null
    })
    expect(base).not.toContain('Kurze Umfrage')
    const out = ensureWebinarInvitationCtaSections(base, {
      surveyUrl: 'https://forms.office.com/r/xyz',
      surveyLabel: 'Umfrage',
      websiteUrl: 'https://www.kurtrocks.com/e',
      websiteLabel: 'Seite'
    })
    expect(out).toContain('Kurze Umfrage')
    expect(out).toContain('forms.office.com/r/xyz')
    expect(out).toContain('www.kurtrocks.com/e')
    expect(out.indexOf('Kurze Umfrage')).toBeLessThan(out.indexOf('chronell-webinar-teams-slot'))
  })
})

describe('prepareWebinarInvitationSaveBundle', () => {
  it('wandelt data-URI in cid-Anhang um', () => {
    const b64 = 'iVBORw0KGgo='
    const html = buildWebinarInvitationHtml({
      title: 'Hero-Test',
      heroImageSrc: `data:image/png;base64,${b64}`,
      surveyUrl: '',
      surveyLabel: '',
      websiteUrl: '',
      websiteLabel: '',
      scheduleLabel: null
    })
    const bundle = prepareWebinarInvitationSaveBundle(html)
    expect(bundle.inlineAttachments).toHaveLength(1)
    expect(bundle.inlineAttachments[0].isInline).toBe(true)
    expect(bundle.bodyHtml).toContain('cid:')
    expect(bundle.bodyHtml).toContain('id="chronell-webinar-teams-slot"')
    expect(bundle.bodyHtml).not.toContain('data:image')
  })
})
