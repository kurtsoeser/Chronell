import { describe, expect, it } from 'vitest'
import type { ChronellEntityRef } from '@shared/entity-ref'
import {
  AI_CONFIDENCE_MIN,
  mergeEntityLinkSuggestions,
  parseRawAiSuggestions,
  rawPairsToEntitySuggestions
} from './entity-link-ai-validate'
import type { AiLinkCandidateEntry } from './entity-link-ai-retrieval'

const anchor: ChronellEntityRef = { kind: 'mail', messageId: 42 }

function entry(
  candId: string,
  ref: ChronellEntityRef,
  title: string
): AiLinkCandidateEntry {
  return {
    candId,
    ref,
    snapshot: { id: candId, kind: ref.kind, fields: {} },
    title,
    subtitle: null
  }
}

describe('parseRawAiSuggestions', () => {
  it('parses valid suggestion list', () => {
    const rows = parseRawAiSuggestions({
      suggestions: [
        { fromId: 'anchor', toId: 'cand_1', confidence: 0.9, reason: 'Passt' }
      ]
    })
    expect(rows).toHaveLength(1)
    expect(rows[0]!.confidence).toBe(0.9)
  })
})

describe('rawPairsToEntitySuggestions', () => {
  it('keeps only pairs touching anchor and above confidence', () => {
    const candidateById = new Map<string, AiLinkCandidateEntry>([
      ['anchor', entry('anchor', anchor, 'Mail')],
      [
        'cand_1',
        entry('cand_1', { kind: 'people_contact', contactId: 7 }, 'Kontakt')
      ]
    ])
    const out = rawPairsToEntitySuggestions(
      anchor,
      [
        { fromId: 'anchor', toId: 'cand_1', confidence: 0.8, reason: 'Workshop' },
        { fromId: 'cand_1', toId: 'cand_2', confidence: 0.95, reason: 'Ignoriert' }
      ],
      candidateById,
      new Set(),
      () => false
    )
    expect(out).toHaveLength(1)
    expect(out[0]!.target).toEqual({ kind: 'people_contact', contactId: 7 })
    expect(out[0]!.reason).toBe('ai_semantic')
  })

  it('drops low confidence', () => {
    const candidateById = new Map<string, AiLinkCandidateEntry>([
      ['anchor', entry('anchor', anchor, 'Mail')],
      ['cand_1', entry('cand_1', { kind: 'calendar_event', accountId: 'a', graphEventId: 'e' }, 'Termin')]
    ])
    const out = rawPairsToEntitySuggestions(
      anchor,
      [{ fromId: 'anchor', toId: 'cand_1', confidence: AI_CONFIDENCE_MIN - 0.1, reason: 'Schwach' }],
      candidateById,
      new Set(),
      () => false
    )
    expect(out).toHaveLength(0)
  })
})

describe('mergeEntityLinkSuggestions', () => {
  it('prefers heuristic first and dedupes by target', () => {
    const merged = mergeEntityLinkSuggestions(
      [
        {
          target: { kind: 'people_contact', contactId: 1 },
          title: 'A',
          subtitle: null,
          reason: 'sender_email'
        }
      ],
      [
        {
          target: { kind: 'people_contact', contactId: 1 },
          title: 'A',
          subtitle: null,
          reason: 'ai_semantic',
          confidence: 0.9
        },
        {
          target: { kind: 'calendar_event', accountId: 'x', graphEventId: 'y' },
          title: 'Termin',
          subtitle: null,
          reason: 'ai_semantic',
          confidence: 0.8
        }
      ]
    )
    expect(merged).toHaveLength(2)
    expect(merged[0]!.reason).toBe('sender_email')
    expect(merged[1]!.reason).toBe('ai_semantic')
  })
})
