import { describe, expect, it } from 'vitest'
import type { AiConnectionsSettings } from '@shared/ai-connections'
import {
  defaultCopilotEngine,
  listCopilotEngineOptions,
  resolvePreferredApiEngine
} from './copilot-engine-options'

function baseSettings(partial: Partial<AiConnectionsSettings> = {}): AiConnectionsSettings {
  return {
    enabled: true,
    provider: 'gemini',
    model: null,
    ollamaBaseUrl: 'http://127.0.0.1:11434',
    hasGeminiApiKey: false,
    hasOpenAiApiKey: false,
    hasActiveApiKey: false,
    consentGiven: true,
    snippetMode: 'off',
    includeSnippet: false,
    snippetConsentGiven: false,
    scanLookbackDays: 90,
    scanMaxAnchors: 50,
    minConfidence: 0.65,
    compareProviders: false,
    customDomainProfiles: [],
    showLinkQualityOnGraph: false,
    embeddingsEnabled: true,
    embeddingModel: 'nomic-embed-text',
    embeddingHybridRetrieval: true,
    embeddingAutoIndex: true,
    embeddingFastSuggestions: true,
    ...partial
  }
}

describe('listCopilotEngineOptions', () => {
  it('includes graph only for microsoft accounts without Work IQ', () => {
    const opts = listCopilotEngineOptions({
      microsoftAccount: true,
      aiSettings: null,
      workIqAvailable: false
    })
    expect(opts.map((o) => o.value)).toEqual(['graph'])
  })

  it('includes workiq only when available', () => {
    const opts = listCopilotEngineOptions({
      microsoftAccount: true,
      aiSettings: null,
      workIqAvailable: true
    })
    expect(opts.map((o) => o.value)).toEqual(['graph', 'workiq'])
  })

  it('adds gemini/openai when keys and consent present', () => {
    const opts = listCopilotEngineOptions({
      microsoftAccount: true,
      aiSettings: baseSettings({ hasGeminiApiKey: true, hasOpenAiApiKey: true }),
      workIqAvailable: true
    })
    expect(opts.map((o) => o.value)).toEqual(['graph', 'workiq', 'gemini', 'openai'])
  })
})

describe('defaultCopilotEngine', () => {
  it('defaults to graph for microsoft accounts', () => {
    expect(
      defaultCopilotEngine({
        microsoftAccount: true,
        aiSettings: baseSettings({ hasGeminiApiKey: true }),
        workIqAvailable: true
      })
    ).toBe('graph')
  })

  it('defaults to selected provider when no microsoft account', () => {
    expect(
      defaultCopilotEngine({
        microsoftAccount: false,
        aiSettings: baseSettings({
          provider: 'openai',
          hasGeminiApiKey: true,
          hasOpenAiApiKey: true
        })
      })
    ).toBe('openai')
  })

  it('falls back to gemini when provider key missing but gemini key exists', () => {
    expect(
      resolvePreferredApiEngine(
        baseSettings({
          provider: 'openai',
          hasGeminiApiKey: true,
          hasOpenAiApiKey: false
        })
      )
    ).toBe('gemini')
  })

  it('never auto-picks workiq', () => {
    expect(
      defaultCopilotEngine({
        microsoftAccount: true,
        aiSettings: null,
        workIqAvailable: true
      })
    ).toBe('graph')
  })

  it('honors preferred workiq when available', () => {
    expect(
      defaultCopilotEngine({
        microsoftAccount: true,
        aiSettings: null,
        preferred: 'workiq',
        workIqAvailable: true
      })
    ).toBe('workiq')
  })
})
