/**
 * Teams-Meeting-Recap (Zusammenfassung + Aufzeichnung) aus Join-URL oder Body ableiten.
 * Microsoft schreibt den Recap-Link oft nicht in die Kalenderbeschreibung.
 */

function parseUrl(input: string): URL | null {
  const raw = input.trim()
  if (!raw) return null
  try {
    return new URL(raw)
  } catch {
    return null
  }
}

function isTeamsHost(hostname: string): boolean {
  const host = hostname.replace(/^www\./, '').toLowerCase()
  return host === 'teams.microsoft.com' || host === 'teams.live.com'
}

/** Recap-Kontext aus Teams-Beitrittslink (Tid/Oid im `context`-Parameter). */
export function buildTeamsMeetingRecapUrlFromJoinUrl(joinUrl: string): string | null {
  const url = parseUrl(joinUrl)
  if (!url || !isTeamsHost(url.hostname)) return null

  const contextRaw = url.searchParams.get('context')?.trim()
  if (!contextRaw) return null

  let context: { Tid?: string; Oid?: string; tid?: string; oid?: string }
  try {
    context = JSON.parse(contextRaw) as typeof context
  } catch {
    return null
  }

  const tid = context.Tid?.trim() || context.tid?.trim()
  const oid = context.Oid?.trim() || context.oid?.trim()
  if (!tid || !oid) return null

  const recapContext = JSON.stringify({
    Tid: tid,
    Oid: oid,
    JoinWebUrl: joinUrl.trim()
  })
  return `https://teams.microsoft.com/l/meetingrecap?context=${encodeURIComponent(recapContext)}`
}

function recapFromV2Params(params: Record<string, string>): string | null {
  const threadId = decodeURIComponent(params.threadId ?? params.ThreadId ?? '').trim()
  const tenantId = (params.tenantId ?? params.Tid ?? '').trim()
  const organizerId = (params.organizerId ?? params.Oid ?? '').trim()
  if (!threadId || !tenantId || !organizerId) return null

  const threadEnc = encodeURIComponent(threadId).replace(/%3A/gi, '%3a').replace(/%40/gi, '%40')
  const ctx = JSON.stringify({ Tid: tenantId, Oid: organizerId })
  const joinWebUrl = `https://teams.microsoft.com/l/meetup-join/${threadEnc}/0?context=${encodeURIComponent(ctx)}`
  return buildTeamsMeetingRecapUrlFromJoinUrl(joinWebUrl)
}

/** Bekannte Recap-URL-Formate in die klassische `/l/meetingrecap`-Form bringen. */
export function normalizeTeamsMeetingRecapUrl(input: string): string | null {
  const raw = input.trim()
  if (!raw) return null

  if (raw.includes('/l/meetingrecap')) {
    const url = parseUrl(raw)
    if (url && isTeamsHost(url.hostname) && url.pathname === '/l/meetingrecap') {
      return url.toString()
    }
  }

  if (raw.toLowerCase().includes('meetingrecap')) {
    const params: Record<string, string> = {}
    for (const match of raw.matchAll(/([a-zA-Z]+)=([^&#]+)/g)) {
      params[match[1]!] = match[2]!
    }
    const fromV2 = recapFromV2Params(params)
    if (fromV2) return fromV2
  }

  return null
}

export function resolveTeamsMeetingRecapUrl(input: {
  bodyHtml?: string | null
  joinUrl?: string | null
  recapFromBody?: string | null
}): { url: string | null; source: 'body' | 'joinUrl' | null } {
  const fromBodyRaw = input.recapFromBody?.trim()
  if (fromBodyRaw) {
    const normalized = normalizeTeamsMeetingRecapUrl(fromBodyRaw) ?? fromBodyRaw
    return { url: normalized, source: 'body' }
  }

  const body = input.bodyHtml ?? ''
  const recapInBody = /https?:\/\/[^\s"'<>]*teams\.microsoft\.com[^\s"'<>]*meetingrecap[^\s"'<>]*/i.exec(
    body
  )
  if (recapInBody?.[0]) {
    const normalized = normalizeTeamsMeetingRecapUrl(recapInBody[0])
    if (normalized) return { url: normalized, source: 'body' }
  }

  const joinUrl = input.joinUrl?.trim()
  if (joinUrl) {
    const built = buildTeamsMeetingRecapUrlFromJoinUrl(joinUrl)
    if (built) return { url: built, source: 'joinUrl' }
  }

  return { url: null, source: null }
}
