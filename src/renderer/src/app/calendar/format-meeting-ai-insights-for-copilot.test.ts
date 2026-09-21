import { describe, expect, it } from 'vitest'
import { formatMeetingAiInsightsForCopilotContext } from './format-meeting-ai-insights-for-copilot'
import type { CalendarMeetingAiInsightsResult } from '@shared/types'

function ok(partial: Partial<CalendarMeetingAiInsightsResult>): CalendarMeetingAiInsightsResult {
  return {
    status: 'ok',
    meetingId: 'm1',
    insightId: 'i1',
    createdDateTime: null,
    endDateTime: null,
    meetingNotes: [],
    actionItems: [],
    mentionCount: 0,
    mentionSnippets: [],
    errorMessage: null,
    ...partial
  }
}

describe('formatMeetingAiInsightsForCopilotContext', () => {
  it('returns null when not ok or empty', () => {
    expect(formatMeetingAiInsightsForCopilotContext(null)).toBeNull()
    expect(formatMeetingAiInsightsForCopilotContext(ok({ status: 'pending' }))).toBeNull()
    expect(formatMeetingAiInsightsForCopilotContext(ok({}))).toBeNull()
  })

  it('formats notes, actions and snippets', () => {
    const text = formatMeetingAiInsightsForCopilotContext(
      ok({
        meetingNotes: [
          {
            title: 'Kickoff',
            text: 'Ziele klar',
            subpoints: [{ title: 'Next', text: 'Demo' }]
          }
        ],
        actionItems: [{ title: 'Mail senden', text: null, ownerDisplayName: 'Ada' }],
        mentionSnippets: [{ speakerDisplayName: 'Bob', text: 'Bitte prüfen' }],
        mentionCount: 1
      })
    )
    expect(text).toContain('Meeting notes')
    expect(text).toContain('Kickoff')
    expect(text).toContain('Action items')
    expect(text).toContain('Owner: Ada')
    expect(text).toContain('Bob: Bitte prüfen')
  })
})
