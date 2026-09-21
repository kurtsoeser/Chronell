import { GraphError } from '@microsoft/microsoft-graph-client'
import { createGraphClient } from './client'
import { graphFindOnlineMeetingId } from './online-meeting-lookup'
import { loadConfig } from '../config'
import type {
  CalendarMeetingAiInsight,
  CalendarMeetingAiInsightActionItem,
  CalendarMeetingAiInsightMentionSnippet,
  CalendarMeetingAiInsightNote,
  CalendarMeetingAiInsightsResult
} from '@shared/types'

interface GraphAiInsightListRow {
  id?: string
  callId?: string | null
  contentCorrelationId?: string | null
  createdDateTime?: string | null
  endDateTime?: string | null
}

interface GraphAiInsightDetail extends GraphAiInsightListRow {
  meetingNotes?: Array<{
    title?: string | null
    text?: string | null
    subpoints?: Array<{ title?: string | null; text?: string | null } | null> | null
  } | null> | null
  actionItems?: Array<{
    title?: string | null
    text?: string | null
    ownerDisplayName?: string | null
  } | null> | null
  viewpoint?: {
    mentionEvents?: Array<{
      eventDateTime?: string | null
      transcriptUtterance?: string | null
      speaker?: {
        user?: { displayName?: string | null } | null
      } | null
    } | null> | null
  } | null
}

async function getClientFor(accountId: string): Promise<ReturnType<typeof createGraphClient>> {
  const config = await loadConfig()
  if (!config.microsoftClientId) {
    throw new Error('Keine Azure Client-ID konfiguriert.')
  }
  const homeAccountId = accountId.replace(/^ms:/, '')
  return createGraphClient(config.microsoftClientId, homeAccountId)
}

function emptyResult(
  status: CalendarMeetingAiInsightsResult['status'],
  extras?: Partial<CalendarMeetingAiInsightsResult>
): CalendarMeetingAiInsightsResult {
  return {
    status,
    meetingId: null,
    insightId: null,
    createdDateTime: null,
    endDateTime: null,
    meetingNotes: [],
    actionItems: [],
    mentionCount: 0,
    mentionSnippets: [],
    errorMessage: null,
    ...extras
  }
}

export function mapGraphMeetingAiInsight(detail: GraphAiInsightDetail): CalendarMeetingAiInsight {
  const meetingNotes: CalendarMeetingAiInsightNote[] = (detail.meetingNotes ?? [])
    .filter((n): n is NonNullable<typeof n> => !!n)
    .map((n) => ({
      title: n.title?.trim() || null,
      text: n.text?.trim() || null,
      subpoints: (n.subpoints ?? [])
        .filter((s): s is NonNullable<typeof s> => !!s)
        .map((s) => ({
          title: s.title?.trim() || null,
          text: s.text?.trim() || null
        }))
        .filter((s) => s.title || s.text)
    }))
    .filter((n) => n.title || n.text || n.subpoints.length > 0)

  const actionItems: CalendarMeetingAiInsightActionItem[] = (detail.actionItems ?? [])
    .filter((a): a is NonNullable<typeof a> => !!a)
    .map((a) => ({
      title: a.title?.trim() || null,
      text: a.text?.trim() || null,
      ownerDisplayName: a.ownerDisplayName?.trim() || null
    }))
    .filter((a) => a.title || a.text)

  const mentionSnippets: CalendarMeetingAiInsightMentionSnippet[] = (
    detail.viewpoint?.mentionEvents ?? []
  )
    .filter((e): e is NonNullable<typeof e> => !!e)
    .map((e) => ({
      speakerDisplayName: e.speaker?.user?.displayName?.trim() || null,
      text: e.transcriptUtterance?.trim() || ''
    }))
    .filter((e) => e.text.length > 0)
    .slice(0, 20)

  const mentionCount = (detail.viewpoint?.mentionEvents ?? []).filter(Boolean).length

  return {
    id: detail.id?.trim() || '',
    callId: detail.callId?.trim() || null,
    contentCorrelationId: detail.contentCorrelationId?.trim() || null,
    createdDateTime: detail.createdDateTime?.trim() || null,
    endDateTime: detail.endDateTime?.trim() || null,
    meetingNotes,
    actionItems,
    mentionCount,
    mentionSnippets
  }
}

/**
 * Teams Copilot Meeting Insights (nach Meeting-Ende).
 * Endpoint: GET /v1.0/copilot/users/{userId}/onlineMeetings/{id}/aiInsights
 * Scope: OnlineMeetingAiInsight.Read.All + Microsoft 365 Copilot Lizenz.
 */
export async function graphFetchMeetingAiInsights(
  accountId: string,
  joinUrl: string,
  opts?: { meetingEnded?: boolean }
): Promise<CalendarMeetingAiInsightsResult> {
  if (!accountId.startsWith('ms:')) {
    return emptyResult('unsupported')
  }

  const trimmed = joinUrl.trim()
  if (!trimmed) {
    return emptyResult('noJoinUrl')
  }

  if (opts?.meetingEnded === false) {
    return emptyResult('notEnded')
  }

  try {
    const client = await getClientFor(accountId)
    const meetingId = await graphFindOnlineMeetingId(client, trimmed)
    if (!meetingId) {
      return emptyResult('meetingNotFound')
    }

    const me = (await client.api('/me').select(['id']).get()) as { id?: string }
    const userId = me.id?.trim()
    if (!userId) {
      return emptyResult('error', {
        meetingId,
        errorMessage: 'Benutzer-ID konnte nicht geladen werden.'
      })
    }

    const listPath = `/copilot/users/${encodeURIComponent(userId)}/onlineMeetings/${encodeURIComponent(meetingId)}/aiInsights`
    const list = (await client.api(listPath).get()) as { value?: GraphAiInsightListRow[] }
    const rows = [...(list.value ?? [])].filter((r) => r.id?.trim())
    if (rows.length === 0) {
      return emptyResult('pending', { meetingId })
    }

    rows.sort(
      (a, b) => Date.parse(b.endDateTime ?? b.createdDateTime ?? '') - Date.parse(a.endDateTime ?? a.createdDateTime ?? '')
    )
    const latestId = rows[0]!.id!.trim()
    const detail = (await client.api(`${listPath}/${encodeURIComponent(latestId)}`).get()) as GraphAiInsightDetail
    const mapped = mapGraphMeetingAiInsight(detail)
    if (!mapped.id) {
      return emptyResult('pending', { meetingId })
    }

    const hasContent =
      mapped.meetingNotes.length > 0 || mapped.actionItems.length > 0 || mapped.mentionCount > 0
    if (!hasContent) {
      return emptyResult('pending', {
        meetingId,
        insightId: mapped.id,
        createdDateTime: mapped.createdDateTime,
        endDateTime: mapped.endDateTime
      })
    }

    return {
      status: 'ok',
      meetingId,
      insightId: mapped.id,
      createdDateTime: mapped.createdDateTime,
      endDateTime: mapped.endDateTime,
      meetingNotes: mapped.meetingNotes,
      actionItems: mapped.actionItems,
      mentionCount: mapped.mentionCount,
      mentionSnippets: mapped.mentionSnippets,
      errorMessage: null
    }
  } catch (e) {
    if (e instanceof GraphError) {
      const code = e.statusCode ?? 0
      if (code === 401 || code === 403) {
        return emptyResult('forbidden', {
          errorMessage:
            e.message?.trim() ||
            'Copilot Meeting Insights nicht freigegeben (Scope oder Lizenz).'
        })
      }
      if (code === 404) {
        return emptyResult('meetingNotFound')
      }
      return emptyResult('error', {
        errorMessage: e.message?.trim() || `Graph-Fehler (${code}).`
      })
    }
    return emptyResult('error', {
      errorMessage: e instanceof Error ? e.message : String(e)
    })
  }
}
