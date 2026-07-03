import { describe, expect, it } from 'vitest'
import {
  buildGoogleMapsEmbedUrl,
  isAllowedGoogleMapsEmbedSrc,
  parseGoogleMapsEmbedSrc
} from './note-google-maps-embed'
import {
  buildTypeformEmbedUrl,
  isAllowedTypeformEmbedSrc,
  parseTypeformId
} from './note-typeform-embed'
import {
  buildTwitterEmbedUrl,
  isAllowedTwitterEmbedSrc,
  parseTwitterTweetId
} from './note-twitter-embed'
import {
  parseTeamsRecordingEmbedSrc,
  isAllowedTeamsRecordingEmbedSrc
} from './note-teams-recording-embed'
import { isEmbeddableNoteUrl } from './note-embed-registry'

describe('parseGoogleMapsEmbedSrc', () => {
  it('wandelt Koordinaten-URLs um', () => {
    const src = parseGoogleMapsEmbedSrc('https://www.google.com/maps/@48.2082,16.3738,14z')
    expect(src).toContain('48.2082,16.3738')
    expect(src).toContain('output=embed')
  })

  it('behält Embed-URLs bei', () => {
    const embed = 'https://www.google.com/maps/embed?pb=abc123'
    expect(parseGoogleMapsEmbedSrc(embed)).toBe(embed)
  })

  it('extrahiert Koordinaten aus pb=-Place-Links', () => {
    const src = parseGoogleMapsEmbedSrc(
      'https://www.google.com/maps/place/Test/@0,0,12z/data=!8m2!3d48.1!4d11.5'
    )
    expect(src).toContain('48.1,11.5')
  })
})

describe('parseTypeformId', () => {
  it('erkennt Typeform-Teilen-Links', () => {
    expect(parseTypeformId('https://form.typeform.com/to/ABC123')).toBe('ABC123')
    expect(buildTypeformEmbedUrl('ABC123')).toContain('typeform-embed=embedful')
    expect(isAllowedTypeformEmbedSrc(buildTypeformEmbedUrl('ABC123'))).toBe(true)
  })
})

describe('parseTwitterTweetId', () => {
  it('erkennt X-Status-URLs', () => {
    const id = '1234567890123456789'
    expect(parseTwitterTweetId(`https://x.com/user/status/${id}`)).toBe(id)
    expect(buildTwitterEmbedUrl(id)).toContain(`id=${id}`)
    expect(buildTwitterEmbedUrl(id, 'dark')).toContain('theme=dark')
    expect(isAllowedTwitterEmbedSrc(buildTwitterEmbedUrl(id))).toBe(true)
    expect(isAllowedTwitterEmbedSrc(buildTwitterEmbedUrl(id, 'dark'))).toBe(true)
  })
})

describe('parseTeamsRecordingEmbedSrc', () => {
  const videoId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'

  it('wandelt Stream-Video-URLs in Embed-URLs um', () => {
    const src = parseTeamsRecordingEmbedSrc(`https://web.microsoftstream.com/video/${videoId}`)
    expect(src).toBe(
      `https://web.microsoftstream.com/embed/video/${videoId}?autoplay=false&showinfo=true`
    )
    expect(isAllowedTeamsRecordingEmbedSrc(src!)).toBe(true)
  })

  it('erkennt Teams-Meeting-Recap-Links', () => {
    const url = 'https://teams.microsoft.com/l/meetingrecap?context=abc'
    expect(parseTeamsRecordingEmbedSrc(url)).toBe(url)
    expect(isAllowedTeamsRecordingEmbedSrc(url)).toBe(true)
  })
})

describe('isEmbeddableNoteUrl', () => {
  it('erkennt neue Embed-Typen', () => {
    expect(isEmbeddableNoteUrl('https://form.typeform.com/to/abc')).toBe(true)
    expect(isEmbeddableNoteUrl('https://x.com/a/status/1234567890123456789')).toBe(true)
    expect(isEmbeddableNoteUrl('https://example.com')).toBe(false)
  })
})
