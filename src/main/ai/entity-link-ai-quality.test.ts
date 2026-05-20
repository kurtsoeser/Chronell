import { describe, expect, it } from 'vitest'
import { parseRawAiLinkQuality } from './entity-link-ai-quality'

describe('parseRawAiLinkQuality', () => {
  it('parses valid evaluations', () => {
    const rows = parseRawAiLinkQuality({
      evaluations: [
        { linkId: 'link_1', quality: 'strong', confidence: 0.9, reason: 'Passt gut.' },
        { linkId: 'link_2', quality: 'bogus', confidence: 0.5, reason: 'x' }
      ]
    })
    expect(rows).toHaveLength(1)
    expect(rows[0]?.linkId).toBe('link_1')
    expect(rows[0]?.quality).toBe('strong')
  })
})
