import { describe, expect, it } from 'vitest'
import {
  extractTeamsLongMeetupJoinUrl,
  extractTeamsShortMeetUrl,
  isTeamsLongMeetupJoinUrl,
  preferTeamsJoinUrl
} from './teams-join-url'

describe('preferTeamsJoinUrl', () => {
  const long =
    'https://teams.microsoft.com/l/meetup-join/19%3ameeting_MDkwYjJl/0?context=%7B%22Tid%22%3A%22x%22%7D'
  const short = 'https://teams.microsoft.com/meet/387543508953475?p=GkP2U5hnhxYwad5Rkn'

  it('erkennt lange meetup-join-URLs', () => {
    expect(isTeamsLongMeetupJoinUrl(long)).toBe(true)
    expect(isTeamsLongMeetupJoinUrl(short)).toBe(false)
  })

  it('extrahiert kurzen Meet-Link aus joinInformation-HTML', () => {
    const html = `<p>Teilnehmen: <a href="${short}">${short}</a></p>`
    expect(extractTeamsShortMeetUrl(html)).toBe(short)
  })

  it('bevorzugt kurzen Link aus joinInformation gegenueber langer joinUrl', () => {
    expect(
      preferTeamsJoinUrl({
        joinUrl: long,
        joinInformationHtml: `<p>Teilnehmen: ${short}</p>`
      })
    ).toBe(short)
  })

  it('bevorzugt kurzen Link aus Body', () => {
    expect(
      preferTeamsJoinUrl({
        joinUrl: long,
        bodyHtml: `<div>Microsoft Teams-Besprechung<br/>Teilnehmen: ${short}</div>`
      })
    ).toBe(short)
  })

  it('faellt auf joinUrl zurueck wenn kein kurzer Link da ist', () => {
    expect(preferTeamsJoinUrl({ joinUrl: long })).toBe(long)
  })

  it('findet langen meetup-join-Link im Body wenn Graph-joinUrl fehlt', () => {
    expect(extractTeamsLongMeetupJoinUrl(`<a href="${long}">Join</a>`)).toBe(long)
    expect(
      preferTeamsJoinUrl({
        joinUrl: null,
        bodyHtml: `<span id="chronell-webinar-teams-slot"><a href="${long}">Teams</a></span>`
      })
    ).toBe(long)
  })
})
