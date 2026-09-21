import { describe, expect, it } from 'vitest'
import { buildGroundedCopilotMessage } from './build-grounded-copilot-message'

describe('buildGroundedCopilotMessage', () => {
  it('appends context under a separator', () => {
    expect(buildGroundedCopilotMessage('Summarize', ['Subject: Hi', 'Body text'])).toBe(
      'Summarize\n\n---\nSubject: Hi\n\nBody text\n---'
    )
  })

  it('returns prompt only when context empty', () => {
    expect(buildGroundedCopilotMessage('Summarize', ['  ', ''])).toBe('Summarize')
  })
})
