import { describe, expect, it } from 'vitest'
import type { AiConnectionsSettings } from '@shared/ai-connections'
import { resolveIncludeExcerpt } from './ai-snippet-policy'

function base(over: Partial<AiConnectionsSettings>): AiConnectionsSettings {
  return {
    enabled: true,
    provider: 'gemini',
    model: null,
    ollamaBaseUrl: 'http://127.0.0.1:11434',
    hasGeminiApiKey: true,
    hasOpenAiApiKey: false,
    hasActiveApiKey: true,
    consentGiven: true,
    snippetMode: 'off',
    includeSnippet: false,
    snippetConsentGiven: true,
    scanLookbackDays: 90,
    scanMaxAnchors: 50,
    minConfidence: 0.65,
    compareProviders: false,
    customDomainProfiles: [],
    showLinkQualityOnGraph: false,
    embeddingsEnabled: false,
    embeddingModel: 'nomic-embed-text',
    embeddingHybridRetrieval: true,
    embeddingAutoIndex: true,
    embeddingFastSuggestions: true,
    ...over
  }
}

describe('resolveIncludeExcerpt', () => {
  it('returns false when consent missing', () => {
    expect(resolveIncludeExcerpt(base({ snippetConsentGiven: false, snippetMode: 'on' }))).toBe(
      false
    )
  })

  it('on mode always includes excerpt with consent', () => {
    expect(resolveIncludeExcerpt(base({ snippetMode: 'on' }))).toBe(true)
  })

  it('ask mode only with explicit true', () => {
    const s = base({ snippetMode: 'ask' })
    expect(resolveIncludeExcerpt(s)).toBe(false)
    expect(resolveIncludeExcerpt(s, true)).toBe(true)
    expect(resolveIncludeExcerpt(s, false)).toBe(false)
  })

  it('off mode never includes excerpt', () => {
    expect(resolveIncludeExcerpt(base({ snippetMode: 'off' }), true)).toBe(false)
  })
})
