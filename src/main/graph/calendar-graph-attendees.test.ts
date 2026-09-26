import { describe, expect, it } from 'vitest'
import {
  applyGraphMeetingInviteToPayload,
  buildGraphAttendees,
  buildGraphAttendeesMixed,
  graphTeamsMeetingPatchFields,
  resolveGraphAttendeeWritePlan,
  resolveGraphEventBodyForTeamsUpdate
} from './calendar-graph'

describe('buildGraphAttendees', () => {
  it('dedupliziert und normalisiert E-Mail-Adressen', () => {
    expect(
      buildGraphAttendees(['A@Example.com', 'a@example.com', 'b@test.org'])
    ).toEqual([
      {
        emailAddress: { address: 'a@example.com', name: 'a@example.com' },
        type: 'required'
      },
      {
        emailAddress: { address: 'b@test.org', name: 'b@test.org' },
        type: 'required'
      }
    ])
  })

  it('filtert ungueltige Adressen', () => {
    expect(buildGraphAttendees(['kein-email', 'valid@x.org'])).toEqual([
      {
        emailAddress: { address: 'valid@x.org', name: 'valid@x.org' },
        type: 'required'
      }
    ])
  })

  it('wirft bei mehr als 500 Teilnehmern statt still abzuschneiden', () => {
    const emails = Array.from({ length: 501 }, (_, i) => `u${i}@example.com`)
    expect(() => buildGraphAttendees(emails)).toThrow(/Zu viele Teilnehmer/)
  })

  it('akzeptiert 50 Teilnehmer (ueber dem alten Soft-Cap 40)', () => {
    const emails = Array.from({ length: 50 }, (_, i) => `u${i}@example.com`)
    expect(buildGraphAttendees(emails)).toHaveLength(50)
  })
})

describe('buildGraphAttendeesMixed', () => {
  it('setzt required und optional; required hat Vorrang', () => {
    expect(
      buildGraphAttendeesMixed(
        ['a@x.org', 'both@x.org'],
        ['both@x.org', 'opt@x.org']
      )
    ).toEqual([
      {
        emailAddress: { address: 'a@x.org', name: 'a@x.org' },
        type: 'required'
      },
      {
        emailAddress: { address: 'both@x.org', name: 'both@x.org' },
        type: 'required'
      },
      {
        emailAddress: { address: 'opt@x.org', name: 'opt@x.org' },
        type: 'optional'
      }
    ])
  })
})

describe('applyGraphMeetingInviteToPayload', () => {
  it('setzt attendees und responseRequested bei Teilnehmern', () => {
    const payload: Record<string, unknown> = {}
    applyGraphMeetingInviteToPayload(payload, ['teilnehmer@example.com'])
    expect(payload.attendees).toHaveLength(1)
    expect(payload.responseRequested).toBe(true)
  })

  it('respektiert responseRequested=false', () => {
    const payload: Record<string, unknown> = {}
    applyGraphMeetingInviteToPayload(payload, ['a@x.org'], {
      responseRequested: false
    })
    expect(payload.responseRequested).toBe(false)
  })

  it('nimmt optionale Teilnehmer auf', () => {
    const payload: Record<string, unknown> = {}
    applyGraphMeetingInviteToPayload(payload, ['req@x.org'], {
      optionalAttendeeEmails: ['opt@x.org']
    })
    expect(payload.attendees).toEqual([
      {
        emailAddress: { address: 'req@x.org', name: 'req@x.org' },
        type: 'required'
      },
      {
        emailAddress: { address: 'opt@x.org', name: 'opt@x.org' },
        type: 'optional'
      }
    ])
  })

  it('laesst Payload unveraendert ohne Teilnehmer', () => {
    const payload: Record<string, unknown> = { subject: 'Test' }
    applyGraphMeetingInviteToPayload(payload, [])
    expect(payload.attendees).toBeUndefined()
    expect(payload.responseRequested).toBeUndefined()
  })
})

describe('graphTeamsMeetingPatchFields', () => {
  it('setzt Teams an, auch wenn bereits online (Body-PATCH darf Status nicht verlieren)', () => {
    expect(graphTeamsMeetingPatchFields(true, false)).toEqual({
      isOnlineMeeting: true,
      onlineMeetingProvider: 'teamsForBusiness'
    })
    expect(graphTeamsMeetingPatchFields(true, true)).toEqual({
      isOnlineMeeting: true,
      onlineMeetingProvider: 'teamsForBusiness'
    })
  })

  it('deaktiviert Teams nur wenn aktuell online', () => {
    expect(graphTeamsMeetingPatchFields(false, true)).toEqual({
      isOnlineMeeting: false,
      onlineMeetingProvider: 'unknown'
    })
    expect(graphTeamsMeetingPatchFields(false, false)).toBeNull()
  })
})

describe('resolveGraphAttendeeWritePlan', () => {
  const base = {
    subject: 'Test',
    startIso: '2026-01-01T10:00:00.000Z',
    endIso: '2026-01-01T11:00:00.000Z',
    isAllDay: false
  }

  it('speichert Entwurf ohne Graph-Teilnehmer bei notifyAttendees=false', () => {
    const plan = resolveGraphAttendeeWritePlan({
      ...base,
      attendeeEmails: ['a@x.org'],
      optionalAttendeeEmails: ['opt@x.org'],
      notifyAttendees: false
    })
    expect(plan.patchAttendees).toBe(false)
    expect(plan.draftAttendeesJson).toContain('a@x.org')
    expect(plan.draftAttendeesJson).toContain('opt@x.org')
  })

  it('sendet Teilnehmer und loescht Entwurf bei notifyAttendees=true', () => {
    const plan = resolveGraphAttendeeWritePlan({
      ...base,
      attendeeEmails: ['a@x.org'],
      notifyAttendees: true
    })
    expect(plan.patchAttendees).toBe(true)
    expect(plan.draftAttendeesJson).toBe('')
  })
})

describe('resolveGraphEventBodyForTeamsUpdate', () => {
  const blob = [
    '<div>',
    '<p>Microsoft Teams-Besprechung</p>',
    '<p><a href="https://teams.microsoft.com/meet/123">Join</a></p>',
    '</div>'
  ].join('')

  it('verschiebt Body-PATCH wenn Teams gewuenscht aber kein Graph-Blob im Body', () => {
    const out = resolveGraphEventBodyForTeamsUpdate({
      wantTeams: true,
      isOnlineMeeting: true,
      onlineMeetingJoinUrl: 'https://teams.microsoft.com/meet/123',
      existingBodyRaw: '<p></p>',
      userBodyHtml: '<p>Webinar-Einladung</p>',
      defaultBodyContent: '<p>Webinar-Einladung</p>'
    })
    expect(out.omitBodyFromPrimaryPatch).toBe(true)
  })

  it('merged User-HTML mit vorhandenem Blob', () => {
    const out = resolveGraphEventBodyForTeamsUpdate({
      wantTeams: true,
      isOnlineMeeting: true,
      onlineMeetingJoinUrl: 'https://teams.microsoft.com/meet/123',
      existingBodyRaw: blob,
      userBodyHtml: '<p>Webinar-Einladung</p>',
      defaultBodyContent: '<p>Webinar-Einladung</p>'
    })
    expect(out.omitBodyFromPrimaryPatch).toBe(false)
    expect(out.bodyContent).toContain('Webinar-Einladung')
    expect(out.bodyContent).toContain('https://teams.microsoft.com/meet/123')
  })
})
