import { describe, expect, it } from 'vitest'
import { normalizeOllamaBaseUrl, parseOllamaTagsResponse } from './ollama-provider'

describe('normalizeOllamaBaseUrl', () => {
  it('trims trailing slashes', () => {
    expect(normalizeOllamaBaseUrl('http://127.0.0.1:11434/')).toBe('http://127.0.0.1:11434')
  })
})

describe('parseOllamaTagsResponse', () => {
  it('parses model names from tags payload', () => {
    const list = parseOllamaTagsResponse({
      models: [
        { name: 'nemotron3:33b', size: 28_000_000_000 },
        { model: 'llama3.2:latest', size: 2_000_000_000 }
      ]
    })
    expect(list.map((m) => m.name)).toEqual(['llama3.2:latest', 'nemotron3:33b'])
    expect(list[1]?.sizeBytes).toBe(28_000_000_000)
  })

  it('returns empty for invalid payload', () => {
    expect(parseOllamaTagsResponse(null)).toEqual([])
  })
})
