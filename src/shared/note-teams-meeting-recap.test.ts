import { describe, expect, it } from 'vitest'
import {
  buildTeamsMeetingRecapUrlFromJoinUrl,
  resolveTeamsMeetingRecapUrl
} from './note-teams-meeting-recap'

const joinUrl =
  'https://teams.microsoft.com/l/meetup-join/19%3ameeting_abc%40thread.v2/0?context=%7B%22Tid%22%3A%22tenant-1%22%2C%22Oid%22%3A%22org-1%22%7D'

describe('buildTeamsMeetingRecapUrlFromJoinUrl', () => {
  it('baut Recap-URL aus Beitrittslink', () => {
    const recap = buildTeamsMeetingRecapUrlFromJoinUrl(joinUrl)
    expect(recap).toContain('https://teams.microsoft.com/l/meetingrecap?context=')
    expect(recap).toContain(encodeURIComponent(joinUrl))
  })
})

describe('resolveTeamsMeetingRecapUrl', () => {
  it('bevorzugt Recap aus dem Termin-Body', () => {
    const bodyRecap = 'https://teams.microsoft.com/l/meetingrecap?context=from-body'
    const resolved = resolveTeamsMeetingRecapUrl({
      bodyHtml: `<a href="${bodyRecap}">Recap</a>`,
      joinUrl
    })
    expect(resolved.url).toBe(bodyRecap)
    expect(resolved.source).toBe('body')
  })

  it('fällt auf Join-URL zurück', () => {
    const resolved = resolveTeamsMeetingRecapUrl({ bodyHtml: '<p>Kein Link</p>', joinUrl })
    expect(resolved.url).toContain('/l/meetingrecap?')
    expect(resolved.source).toBe('joinUrl')
  })
})
