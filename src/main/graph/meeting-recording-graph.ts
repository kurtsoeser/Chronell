import { GraphError } from '@microsoft/microsoft-graph-client'
import { createGraphClient } from './client'
import { graphFindOnlineMeetingId } from './online-meeting-lookup'
import { loadConfig } from '../config'

interface GraphCallRecordingRow {
  id?: string
  recordingContentUrl?: string | null
  createdDateTime?: string | null
}

export interface GraphMeetingRecordingResolve {
  hasRecording: boolean
  meetingId: string | null
  recordingId: string | null
  recordingContentUrl: string | null
}

async function getClientFor(accountId: string): Promise<ReturnType<typeof createGraphClient>> {
  const config = await loadConfig()
  if (!config.microsoftClientId) {
    throw new Error('Keine Azure Client-ID konfiguriert.')
  }
  const homeAccountId = accountId.replace(/^ms:/, '')
  return createGraphClient(config.microsoftClientId, homeAccountId)
}

/**
 * Teams-Aufzeichnung über Graph onlineMeetings + recordings.
 * Benötigt ggf. OnlineMeetingRecording.Read.All.
 */
export async function graphResolveMeetingRecording(
  accountId: string,
  joinUrl: string
): Promise<GraphMeetingRecordingResolve> {
  const empty: GraphMeetingRecordingResolve = {
    hasRecording: false,
    meetingId: null,
    recordingId: null,
    recordingContentUrl: null
  }

  const trimmed = joinUrl.trim()
  if (!trimmed) return empty

  try {
    const client = await getClientFor(accountId)
    const meetingId = await graphFindOnlineMeetingId(client, trimmed)
    if (!meetingId) return empty

    const recordings = (await client
      .api(`/me/onlineMeetings/${encodeURIComponent(meetingId)}/recordings`)
      .get()) as { value?: GraphCallRecordingRow[] }
    const rows = recordings.value ?? []
    if (rows.length === 0) {
      return { hasRecording: false, meetingId, recordingId: null, recordingContentUrl: null }
    }

    const latest = [...rows].sort(
      (a, b) => Date.parse(b.createdDateTime ?? '') - Date.parse(a.createdDateTime ?? '')
    )[0]

    return {
      hasRecording: true,
      meetingId,
      recordingId: latest?.id?.trim() || null,
      recordingContentUrl: latest?.recordingContentUrl?.trim() || null
    }
  } catch (e) {
    if (e instanceof GraphError) {
      const code = e.statusCode ?? 0
      if (code === 401 || code === 403 || code === 404) return empty
    }
    return empty
  }
}

/** @deprecated Nutze {@link graphResolveMeetingRecording}. */
export async function graphResolveMeetingRecordingUrl(
  accountId: string,
  joinUrl: string
): Promise<string | null> {
  const resolved = await graphResolveMeetingRecording(accountId, joinUrl)
  return resolved.recordingContentUrl
}
