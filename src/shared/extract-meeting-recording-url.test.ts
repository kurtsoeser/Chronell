import { describe, expect, it } from 'vitest'
import {
  extractMeetingRecordingUrl,
  extractMeetingRecordingUrls,
  extractMeetingRecapUrl,
  extractMeetingStreamRecordingUrl
} from './extract-meeting-recording-url'

describe('extractMeetingRecordingUrl', () => {
  it('findet SharePoint stream.aspx im Termin-Body', () => {
    const url =
      'https://kurtrocks.sharepoint.com/sites/foo/_layouts/15/stream.aspx?id=abc123'
    const body = `<p>Aufzeichnung: <a href="${url}">Video ansehen</a></p>`
    expect(extractMeetingRecordingUrl(body)).toBe(url)
  })

  it('findet meetingrecap-Links', () => {
    const url = 'https://teams.microsoft.com/l/meetingrecap?context=abc'
    expect(extractMeetingRecordingUrl(`Besprechung: ${url}`)).toBe(url)
  })

  it('ignoriert normale Teams-Beitrittslinks', () => {
    const body =
      '<p>https://teams.microsoft.com/l/meetup-join/19%3ameeting_abc</p>'
    expect(extractMeetingRecordingUrl(body)).toBeNull()
  })

  it('sammelt mehrere Kandidaten ohne Duplikate', () => {
    const a = 'https://teams.microsoft.com/l/meetingrecap?context=1'
    const b =
      'https://contoso.sharepoint.com/sites/x/_layouts/15/stream.aspx?id=guid'
    const body = `${a} und ${b} sowie ${a}`
    expect(extractMeetingRecordingUrls(body).sort()).toEqual([a, b].sort())
  })

  it('trennt Recap und Stream-Aufzeichnung', () => {
    const recap = 'https://teams.microsoft.com/l/meetingrecap?context=1'
    const stream =
      'https://contoso.sharepoint.com/sites/x/_layouts/15/stream.aspx?id=guid'
    const body = `${recap} ${stream}`
    expect(extractMeetingRecapUrl(body)).toBe(recap)
    expect(extractMeetingStreamRecordingUrl(body)).toBe(stream)
    expect(extractMeetingRecordingUrl(body)).toBe(stream)
  })
})
