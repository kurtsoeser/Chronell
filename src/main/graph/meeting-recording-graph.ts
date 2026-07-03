import { GraphError } from '@microsoft/microsoft-graph-client'
import { createGraphClient } from './client'
import { loadConfig } from '../config'

interface GraphOnlineMeetingRow {
  id?: string
}

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

function joinUrlLookupVariants(joinUrl: string): string[] {
  const trimmed = joinUrl.trim()
  if (!trimmed) return []

  const variants = new Set<string>([trimmed])

  try {
    const url = new URL(trimmed)
    variants.add(url.toString())

    const decodedPath = decodeURIComponent(url.pathname)
    if (decodedPath !== url.pathname) {
      const copy = new URL(url.toString())
      copy.pathname = decodedPath
      variants.add(copy.toString())
    }

    const normalized = trimmed.replace(/%3A/g, '%3a').replace(/%40/g, '%40')
    variants.add(normalized)

    const context = url.searchParams.get('context')
    if (context) {
      try {
        const parsed = JSON.parse(context) as { Tid?: string; Oid?: string }
        if (parsed.Tid && parsed.Oid) {
          const ordered = JSON.stringify({ Tid: parsed.Tid, Oid: parsed.Oid })
          const copy = new URL(url.toString())
          copy.searchParams.set('context', ordered)
          variants.add(copy.toString())
        }
      } catch {
        // ignore
      }
    }
  } catch {
    // ignore
  }

  return [...variants]
}

async function graphFindOnlineMeetingId(
  client: ReturnType<typeof createGraphClient>,
  joinUrl: string
): Promise<string | null> {
  for (const variant of joinUrlLookupVariants(joinUrl)) {
    const escaped = variant.replace(/'/g, "''")
    try {
      const direct = (await client.api(`/me/onlineMeetings(joinWebUrl='${escaped}')`).get()) as GraphOnlineMeetingRow
      const id = direct?.id?.trim()
      if (id) return id
    } catch {
      // try filter next
    }

    try {
      const filter = `JoinWebUrl eq '${escaped}'`
      const meetings = (await client
        .api(`/me/onlineMeetings?$filter=${encodeURIComponent(filter)}`)
        .get()) as { value?: GraphOnlineMeetingRow[] }
      const id = meetings.value?.[0]?.id?.trim()
      if (id) return id
    } catch {
      // next variant
    }
  }
  return null
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
