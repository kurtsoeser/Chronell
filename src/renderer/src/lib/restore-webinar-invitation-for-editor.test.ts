import { describe, expect, it } from 'vitest'
import { buildWebinarInvitationHtml } from '@/lib/build-webinar-invitation-html'
import { injectTeamsMeetingBlobIntoWebinarInvitation } from '@shared/calendar-event-body-html'
import { restoreWebinarTeamsSlotForEditor } from '@/lib/restore-webinar-invitation-for-editor'

describe('restoreWebinarTeamsSlotForEditor', () => {
  it('restores protected slot after Graph saved the meeting blob', () => {
    const template = buildWebinarInvitationHtml({
      title: 'Copilot Webinar',
      heroImageSrc: 'cid:hero@chronell.local',
      surveyUrl: 'https://forms.office.com/example',
      surveyLabel: 'Umfrage',
      websiteUrl: 'https://www.kurtrocks.com',
      websiteLabel: 'Veranstaltungsseite',
      scheduleLabel: 'Mo 1.1.2026 | 10:00 – 11:00',
      teamsJoinUrl: 'https://teams.microsoft.com/l/meetup-join/example'
    })
    const blob =
      '<div><p>Microsoft Teams meeting</p><p><a href="https://teams.microsoft.com/l/meetup-join/example">Join</a></p></div>'
    const saved = injectTeamsMeetingBlobIntoWebinarInvitation(template, blob)

    expect(saved).not.toContain('chronell-webinar-teams-slot')

    const restored = restoreWebinarTeamsSlotForEditor(
      saved,
      'https://teams.microsoft.com/l/meetup-join/example'
    )

    expect(restored).toContain('id="chronell-webinar-teams-slot"')
    expect(restored).not.toContain('meetup-join/example">Join</a></p></div>')
    expect(restored).toContain('Teams-Besprechung beitreten')
  })

  it('leaves existing slot untouched', () => {
    const html = buildWebinarInvitationHtml({
      title: 'Test',
      heroImageSrc: null,
      surveyUrl: '',
      surveyLabel: '',
      websiteUrl: '',
      websiteLabel: '',
      scheduleLabel: null
    })
    const once = restoreWebinarTeamsSlotForEditor(html)
    const twice = restoreWebinarTeamsSlotForEditor(once)
    expect(twice).toBe(once)
    expect(twice.match(/Beim Speichern wird hier der offizielle Microsoft-Zugangsblock/g)).toHaveLength(
      1
    )
  })

  it('dedupliziert mehrfach angehaengte Platzhalter', () => {
    const base = buildWebinarInvitationHtml({
      title: 'Test',
      heroImageSrc: null,
      surveyUrl: '',
      surveyLabel: '',
      websiteUrl: '',
      websiteLabel: '',
      scheduleLabel: null
    })
    const placeholder =
      '<p style="margin:10px 0 0">Der Beitritt erfolgt über die <strong>Teams-Besprechung</strong> dieses Termins. Beim Speichern wird hier der offizielle Microsoft-Zugangsblock eingefügt.</p>'
    const gutted = `${base}${placeholder}${placeholder}`
    const restored = restoreWebinarTeamsSlotForEditor(gutted)
    expect(
      restored.match(/Beim Speichern wird hier der offizielle Microsoft-Zugangsblock/g)
    ).toHaveLength(1)
    expect(restored.match(/id="chronell-webinar-teams-slot"/g)).toHaveLength(1)
  })
})
