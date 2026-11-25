/** chronell://webinar?eventId=… aus dem Events OS. */

export type ChronellWebinarLaunchAction = 'invite' | 'remind'

export type ChronellWebinarLaunch = {
  eventId: string
  action: ChronellWebinarLaunchAction
}

/**
 * Nur Einladung/Erinnerung aus Events OS.
 * Compose mit commercialId bleibt unangetastet.
 */
export function parseChronellWebinarArg(raw: string): ChronellWebinarLaunch | null {
  const text = String(raw || '').trim()
  if (!/^chronell:/i.test(text)) return null
  let url: URL
  try {
    url = new URL(text)
  } catch {
    return null
  }
  const host = (url.hostname || '').toLowerCase()
  if (host !== 'webinar') return null
  if (url.searchParams.get('commercialId')?.trim()) return null
  const actionRaw = (url.searchParams.get('action') || 'invite').trim().toLowerCase()
  if (actionRaw === 'compose') return null
  if (actionRaw !== 'invite' && actionRaw !== 'remind') return null
  const eventId = (url.searchParams.get('eventId') || '')
    .trim()
    .replace(/-/g, '')
    .toLowerCase()
  if (!eventId) return null
  return { eventId, action: actionRaw }
}

export function extractChronellWebinarLaunchesFromArgv(
  argv: readonly string[]
): ChronellWebinarLaunch[] {
  const out: ChronellWebinarLaunch[] = []
  const seen = new Set<string>()
  for (const arg of argv) {
    const parsed = parseChronellWebinarArg(arg)
    if (!parsed) continue
    const key = `${parsed.action}:${parsed.eventId}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(parsed)
  }
  return out
}
