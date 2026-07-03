import { describe, expect, it } from 'vitest'
import {
  buildYouTubeEmbedUrl,
  isAllowedYouTubeEmbedSrc,
  isYouTubeWatchUrl,
  parseYouTubeVideoId
} from './note-youtube-embed'

describe('parseYouTubeVideoId', () => {
  it('erkennt watch-URLs', () => {
    expect(parseYouTubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
    expect(parseYouTubeVideoId('https://youtube.com/watch?v=dQw4w9WgXcQ&t=42s')).toBe('dQw4w9WgXcQ')
  })

  it('erkennt youtu.be-Links', () => {
    expect(parseYouTubeVideoId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
  })

  it('erkennt Shorts und Embed-URLs', () => {
    expect(parseYouTubeVideoId('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
    expect(parseYouTubeVideoId('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
  })

  it('lehnt ungültige IDs ab', () => {
    expect(parseYouTubeVideoId('https://example.com/watch?v=dQw4w9WgXcQ')).toBeNull()
    expect(parseYouTubeVideoId('https://www.youtube.com/watch?v=short')).toBeNull()
    expect(parseYouTubeVideoId('')).toBeNull()
  })
})

describe('buildYouTubeEmbedUrl', () => {
  it('nutzt youtube.com mit Origin und playsinline', () => {
    expect(buildYouTubeEmbedUrl('dQw4w9WgXcQ')).toBe(
      'https://www.youtube.com/embed/dQw4w9WgXcQ?playsinline=1&origin=https%3A%2F%2Fchronell.app'
    )
  })
})

describe('isAllowedYouTubeEmbedSrc', () => {
  it('erlaubt nur YouTube-Embed-URLs', () => {
    expect(isAllowedYouTubeEmbedSrc('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ')).toBe(true)
    expect(isAllowedYouTubeEmbedSrc('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe(true)
    expect(isAllowedYouTubeEmbedSrc('https://evil.example/embed/dQw4w9WgXcQ')).toBe(false)
    expect(isAllowedYouTubeEmbedSrc('javascript:alert(1)')).toBe(false)
  })
})

describe('isYouTubeWatchUrl', () => {
  it('erkennt gültige YouTube-Links', () => {
    expect(isYouTubeWatchUrl('youtu.be/dQw4w9WgXcQ')).toBe(true)
    expect(isYouTubeWatchUrl('https://vimeo.com/123')).toBe(false)
  })
})
