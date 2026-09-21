import { describe, expect, it } from 'vitest'
import { pickCopilotAssistantReply } from './copilot-chat-graph'
import { mapCopilotRetrievalHits } from './copilot-retrieval-graph'

describe('pickCopilotAssistantReply', () => {
  it('returns the last non-user message', () => {
    const picked = pickCopilotAssistantReply(
      [
        { text: 'Summarize this mail', attributions: [] },
        {
          text: 'Key points: A, B.',
          attributions: [{ attributionType: 'citation', providerDisplayName: 'Doc', seeMoreWebUrl: 'https://x' }]
        }
      ],
      'Summarize this mail'
    )
    expect(picked.replyText).toBe('Key points: A, B.')
    expect(picked.attributions[0]?.providerDisplayName).toBe('Doc')
  })

  it('harvests references map and prefers citations', () => {
    const picked = pickCopilotAssistantReply(
      [
        { text: 'Prompt', attributions: [] },
        {
          text: 'Answer with source[^1^]',
          attributions: [
            {
              attributionType: 'annotation',
              providerDisplayName: '',
              seeMoreWebUrl: 'https://annotation.example'
            }
          ],
          references: {
            '1': { targetLink: 'https://cite.example/doc', isCitedInResponse: true }
          }
        }
      ],
      'Prompt'
    )
    expect(picked.attributions.some((a) => a.seeMoreWebUrl === 'https://cite.example/doc')).toBe(
      true
    )
    expect(picked.attributions.every((a) => a.attributionType === 'citation')).toBe(true)
  })
})

describe('mapCopilotRetrievalHits', () => {
  it('maps extracts and metadata', () => {
    const hits = mapCopilotRetrievalHits([
      {
        extract: 'Budget draft…',
        relevanceScore: 0.82,
        resourceMetadata: [
          { name: 'title', value: 'Q2 Plan' },
          { name: 'url', value: 'https://contoso.sharepoint.com/doc' }
        ]
      },
      { extract: '  ' }
    ])
    expect(hits).toEqual([
      {
        extract: 'Budget draft…',
        resourceUrl: 'https://contoso.sharepoint.com/doc',
        resourceTitle: 'Q2 Plan',
        relevanceScore: 0.82
      }
    ])
  })
})
