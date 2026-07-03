import { describe, expect, it } from 'vitest'
import { normalizeNoteEmbedTheme } from './note-embed-theme'
import { getNoteEmbedRegistryEntry } from './note-embed-registry'
import {
  buildTwitterEmbedUrl,
  parseTwitterEmbedTheme,
  parseTwitterTweetId
} from './note-twitter-embed'

describe('note-embed-theme', () => {
  it('normalisiert Editor-Themes', () => {
    expect(normalizeNoteEmbedTheme('dark')).toBe('dark')
    expect(normalizeNoteEmbedTheme('light')).toBe('light')
    expect(normalizeNoteEmbedTheme(null)).toBe('light')
  })
})

describe('Twitter embed theme', () => {
  const tweetId = '1234567890123456789'

  it('baut Embed-URLs mit Theme-Parameter', () => {
    expect(buildTwitterEmbedUrl(tweetId, 'light')).toContain('theme=light')
    expect(buildTwitterEmbedUrl(tweetId, 'dark')).toContain('theme=dark')
  })

  it('liest Theme aus Embed-URL', () => {
    expect(parseTwitterEmbedTheme(buildTwitterEmbedUrl(tweetId, 'dark'))).toBe('dark')
    expect(parseTwitterTweetId(buildTwitterEmbedUrl(tweetId, 'dark'))).toBe(tweetId)
  })
})

describe('E5 registry integration', () => {
  const tweetId = '1234567890123456789'

  it('markiert Twitter als theme-aware', () => {
    const twitter = getNoteEmbedRegistryEntry('twitter')
    expect(twitter?.tiptap?.usesEditorTheme).toBe(true)
    expect(twitter?.tiptap?.buildIframeSrc(tweetId, { theme: 'dark' })).toContain('theme=dark')
  })
})
