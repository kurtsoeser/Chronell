import { describe, expect, it } from 'vitest'
import { buildSuggestPromptPackage } from './entity-link-ai-prompts'
import {
  effectiveMaxCandidatesForTier,
  isCompactOllamaModel,
  resolveAiPromptTier
} from '@shared/ai-prompt-tier'

describe('isCompactOllamaModel', () => {
  it('detects small parameter sizes', () => {
    expect(isCompactOllamaModel('llama3.2:latest')).toBe(true)
    expect(isCompactOllamaModel('qwen2.5:7b')).toBe(true)
    expect(isCompactOllamaModel('mistral:7b-instruct')).toBe(true)
  })

  it('keeps large models on full tier', () => {
    expect(isCompactOllamaModel('nemotron3:33b')).toBe(false)
    expect(isCompactOllamaModel('llama3.1:70b')).toBe(false)
  })
})

describe('resolveAiPromptTier', () => {
  it('only compacts for ollama small models', () => {
    expect(resolveAiPromptTier('gemini', 'gemini-2.5-flash')).toBe('full')
    expect(resolveAiPromptTier('ollama', 'llama3.2')).toBe('compact')
    expect(resolveAiPromptTier('ollama', 'nemotron3:33b')).toBe('full')
  })
})

describe('effectiveMaxCandidatesForTier', () => {
  it('caps compact retrieval at 12', () => {
    expect(effectiveMaxCandidatesForTier('compact', 40)).toBe(12)
    expect(effectiveMaxCandidatesForTier('full', 40)).toBe(40)
  })
})

describe('buildSuggestPromptPackage compact', () => {
  it('produces shorter system prompt than full tier', () => {
    const anchor = { id: 'anchor', kind: 'mail', fields: { subject: 'Test' } }
    const candidates = [
      { candId: 'cand_1', kind: 'mail', fields: { subject: 'B' } },
      { candId: 'cand_2', kind: 'people_contact', fields: { name: 'A' } }
    ]
    const full = buildSuggestPromptPackage('anchor', anchor, candidates, false, undefined, 'full')
    const compact = buildSuggestPromptPackage(
      'anchor',
      anchor,
      candidates,
      false,
      undefined,
      'compact'
    )
    expect(compact.systemPrompt.length).toBeLessThan(full.systemPrompt.length)
  })
})
