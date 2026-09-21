import type { CalendarMeetingAiInsightsResult } from '@shared/types'

const MAX_INSIGHTS_CONTEXT_CHARS = 8_000

/**
 * Meeting Notes / Action Items / Mention-Snippets als Copilot-Grounding-Text.
 * Leer wenn keine nutzbaren Insights.
 */
export function formatMeetingAiInsightsForCopilotContext(
  result: CalendarMeetingAiInsightsResult | null | undefined
): string | null {
  if (!result || result.status !== 'ok') return null

  const parts: string[] = ['MEETING INSIGHTS (nach dem Meeting — bitte berücksichtigen):']

  if (result.meetingNotes.length > 0) {
    parts.push('', 'Meeting notes / Zusammenfassung:')
    for (const note of result.meetingNotes) {
      const head = [note.title, note.text].filter(Boolean).join(' — ')
      if (head) parts.push(`- ${head}`)
      for (const sp of note.subpoints) {
        const line = [sp.title, sp.text].filter(Boolean).join(': ')
        if (line) parts.push(`  • ${line}`)
      }
    }
  }

  if (result.actionItems.length > 0) {
    parts.push('', 'Action items:')
    for (const item of result.actionItems) {
      const body = [item.title, item.text].filter(Boolean).join(' — ')
      const owner = item.ownerDisplayName ? ` (Owner: ${item.ownerDisplayName})` : ''
      if (body) parts.push(`- ${body}${owner}`)
    }
  }

  if (result.mentionSnippets.length > 0) {
    parts.push('', 'Transcript snippets (mentions, gekürzt):')
    for (const sn of result.mentionSnippets.slice(0, 12)) {
      const who = sn.speakerDisplayName ? `${sn.speakerDisplayName}: ` : ''
      const text = sn.text.length > 280 ? `${sn.text.slice(0, 277)}…` : sn.text
      parts.push(`- ${who}${text}`)
    }
  }

  if (parts.length <= 1) return null

  const joined = parts.join('\n').trim()
  return joined.length > MAX_INSIGHTS_CONTEXT_CHARS
    ? `${joined.slice(0, MAX_INSIGHTS_CONTEXT_CHARS - 1)}…`
    : joined
}
