import { describe, expect, it } from 'vitest'
import { mapGraphMeetingAiInsight } from './meeting-insights-graph'

describe('mapGraphMeetingAiInsight', () => {
  it('maps notes, action items and mention count', () => {
    const mapped = mapGraphMeetingAiInsight({
      id: 'insight-1',
      callId: 'call-1',
      contentCorrelationId: 'corr-1',
      createdDateTime: '2026-03-01T10:00:00Z',
      endDateTime: '2026-03-01T10:30:00Z',
      meetingNotes: [
        {
          title: 'Kickoff',
          text: 'Ziele abgestimmt.',
          subpoints: [{ title: 'Timeline', text: 'Q2' }, { title: '', text: '' }, null]
        },
        null
      ],
      actionItems: [
        { title: 'Draft senden', text: 'Präsentation', ownerDisplayName: 'Ada' },
        { title: '', text: '', ownerDisplayName: null },
        null
      ],
      viewpoint: {
        mentionEvents: [
          { transcriptUtterance: 'Ada bitte prüfen', speaker: { user: { displayName: 'Bob' } } },
          null
        ]
      }
    })

    expect(mapped.id).toBe('insight-1')
    expect(mapped.meetingNotes).toHaveLength(1)
    expect(mapped.meetingNotes[0]?.subpoints).toEqual([{ title: 'Timeline', text: 'Q2' }])
    expect(mapped.actionItems).toEqual([
      { title: 'Draft senden', text: 'Präsentation', ownerDisplayName: 'Ada' }
    ])
    expect(mapped.mentionCount).toBe(1)
    expect(mapped.mentionSnippets).toEqual([
      { speakerDisplayName: 'Bob', text: 'Ada bitte prüfen' }
    ])
  })
})
