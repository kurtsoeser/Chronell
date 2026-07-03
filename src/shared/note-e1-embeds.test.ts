import { describe, expect, it } from 'vitest'
import {
  buildSoundCloudEmbedUrl,
  isAllowedSoundCloudEmbedSrc,
  parseSoundCloudPageUrl
} from './note-soundcloud-embed'
import {
  buildSpotifyEmbedUrl,
  isAllowedSpotifyEmbedSrc,
  parseSpotifyEmbedRef,
  serializeSpotifyEmbedRef
} from './note-spotify-embed'
import {
  buildTikTokEmbedUrl,
  isAllowedTikTokEmbedSrc,
  parseTikTokVideoId
} from './note-tiktok-embed'
import {
  buildVimeoEmbedUrl,
  isAllowedVimeoEmbedSrc,
  parseVimeoVideoId
} from './note-vimeo-embed'
import { isEmbeddableNoteUrl } from './note-embed-registry'

describe('Spotify embed', () => {
  it('erkennt Track-URLs', () => {
    const ref = parseSpotifyEmbedRef('https://open.spotify.com/track/4iV5W9uYEdYUVa79Axb7Rh')
    expect(ref).toEqual({ kind: 'track', id: '4iV5W9uYEdYUVa79Axb7Rh' })
    const embed = buildSpotifyEmbedUrl(serializeSpotifyEmbedRef(ref!))
    expect(embed).toBe('https://open.spotify.com/embed/track/4iV5W9uYEdYUVa79Axb7Rh')
    expect(isAllowedSpotifyEmbedSrc(embed)).toBe(true)
  })

  it('erkennt intl-Pfade', () => {
    expect(
      parseSpotifyEmbedRef('https://open.spotify.com/intl-de/playlist/37i9dQZF1DXcBWIGoYBM5M')?.kind
    ).toBe('playlist')
  })
})

describe('Vimeo embed', () => {
  it('erkennt vimeo.com-Links', () => {
    const id = '76979871'
    expect(parseVimeoVideoId(`https://vimeo.com/${id}`)).toBe(id)
    expect(isAllowedVimeoEmbedSrc(buildVimeoEmbedUrl(id))).toBe(true)
  })
})

describe('SoundCloud embed', () => {
  it('baut Player-URL aus Track-Seite', () => {
    const page = 'https://soundcloud.com/forss/flickermood'
    expect(parseSoundCloudPageUrl(page)).toBe(page)
    const embed = buildSoundCloudEmbedUrl(page)
    expect(embed).toContain('w.soundcloud.com/player/')
    expect(isAllowedSoundCloudEmbedSrc(embed)).toBe(true)
  })
})

describe('TikTok embed', () => {
  it('erkennt Video-URLs', () => {
    const id = '7234567890123456789'
    expect(parseTikTokVideoId(`https://www.tiktok.com/@user/video/${id}`)).toBe(id)
    expect(isAllowedTikTokEmbedSrc(buildTikTokEmbedUrl(id))).toBe(true)
  })
})

describe('E1 registry integration', () => {
  it('erkennt alle neuen Provider', () => {
    expect(isEmbeddableNoteUrl('https://open.spotify.com/track/abc123XYZ09')).toBe(true)
    expect(isEmbeddableNoteUrl('https://vimeo.com/76979871')).toBe(true)
    expect(isEmbeddableNoteUrl('https://soundcloud.com/forss/flickermood')).toBe(true)
    expect(isEmbeddableNoteUrl('https://www.tiktok.com/@user/video/7234567890123456789')).toBe(true)
  })
})
