/** @vitest-environment node */
import { describe, expect, it } from 'vitest'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { buildWebinarInvitationHtml } from '../renderer/src/lib/build-webinar-invitation-html'
import {
  injectTeamsMeetingBlobIntoWebinarInvitation,
  mergeCalendarEventBodyPreservingTeamsMeetingBlob
} from './calendar-event-body-html'

/**
 * Simuliert: User speichert Webinar → Graph haengt Outlook-Teams-Dokument an → Merge.
 * Empfaenger-HTML muss Umfrage VOR Teams haben und Hinweise NACH dem injizierten Blob.
 */
describe('webinar recipient body regression', () => {
  const outlookAppended = [
    '<html><head><meta charset="utf-8"></head><body>',
    '<div class="me-email-text">',
    '<div style="margin-top:24px">',
    '<a href="https://teams.microsoft.com/l/meetup-join/19%3ameeting_abc">Microsoft Teams-Besprechung</a>',
    '</div>',
    '<div>Besprechungs-ID: 123 456 789</div>',
    '<div>_____________________________</div>',
    '</div></div></body></html>'
  ].join('')

  it('vollstaendige Einladung nach Graph-Append + Merge', () => {
    const userBody = buildWebinarInvitationHtml({
      title: 'Webinar PH OÖ: Zeit- und Selbstmanagement',
      heroImageSrc: null,
      surveyUrl: 'https://forms.office.com/r/abc',
      surveyLabel: 'Umfrage ausfüllen',
      websiteUrl: 'https://www.kurtrocks.com/event',
      websiteLabel: 'Veranstaltungsseite (www.kurtrocks.com)',
      scheduleLabel: 'Donnerstag, 1. Oktober 2026 | 13:30 – 18:00',
      teamsJoinUrl: null
    })

    // 1) Graph Create: User-Body + auto-append (wie Outlook)
    const afterGraphCreate = `${userBody}${outlookAppended}`

    // 2) Unser Post-Create-/Update-Merge
    const recipient = mergeCalendarEventBodyPreservingTeamsMeetingBlob(
      userBody,
      afterGraphCreate
    )

    const surveyAt = recipient.indexOf('Kurze Umfrage')
    const websiteAt = recipient.search(/🌐[\s\S]{0,40}Veranstaltungsseite|bgcolor="#242424"/i)
    const slotGone = !recipient.includes('chronell-webinar-teams-slot')
    const teamsMeetingAt = recipient.indexOf('Teams-Besprechung')
    const tipsAt = recipient.indexOf('Hinweise')
    const htmlCloseBeforeTips = (() => {
      const close = recipient.search(/<\/(?:html|body)\s*>/i)
      return close >= 0 && tipsAt >= 0 ? close < tipsAt : close >= 0
    })()

    expect(surveyAt).toBeGreaterThan(0)
    expect(websiteAt).toBeGreaterThan(0)
    expect(tipsAt).toBeGreaterThan(0)
    expect(slotGone).toBe(true)
    expect(recipient).toContain('forms.office.com/r/abc')
    expect(recipient).toContain('meetup-join')
    expect(htmlCloseBeforeTips).toBe(false)

    // Reihenfolge: Umfrage → Website → Teams-Meeting-Inhalt → Hinweise
    expect(surveyAt).toBeLessThan(teamsMeetingAt)
    expect(websiteAt).toBeLessThan(teamsMeetingAt)
    expect(teamsMeetingAt).toBeLessThan(tipsAt)

    // Debug-Artefakt fuer manuelle Inspektion
    try {
      const dir = join(process.cwd(), 'tmp')
      mkdirSync(dir, { recursive: true })
      writeFileSync(join(dir, 'webinar-recipient-body.html'), recipient, 'utf8')
    } catch {
      /* ignore */
    }
  })

  it('inject ohne Create-Append: Umfrage bleibt vor Teams-Slot-Inhalt', () => {
    const userBody = buildWebinarInvitationHtml({
      title: 'Test',
      heroImageSrc: null,
      surveyUrl: 'https://forms.office.com/r/abc',
      surveyLabel: 'Umfrage',
      websiteUrl: 'https://www.kurtrocks.com/e',
      websiteLabel: 'Seite',
      scheduleLabel: null
    })
    const blob =
      '<div><p>Microsoft Teams-Besprechung</p><p><a href="https://teams.microsoft.com/meet/1">Join</a></p></div>'
    const out = injectTeamsMeetingBlobIntoWebinarInvitation(userBody, blob)
    expect(out.indexOf('Kurze Umfrage')).toBeLessThan(out.indexOf('Teams-Besprechung'))
    expect(out.indexOf('Teams-Besprechung')).toBeLessThan(out.indexOf('Hinweise'))
    expect(out).not.toContain('</html>')
  })
})
