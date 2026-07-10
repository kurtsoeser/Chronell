const COMPLETE_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type MailMeetingParticipantFields = {
  fromAddr?: string | null
  fromName?: string | null
  toAddrs?: string | null
  ccAddrs?: string | null
  bccAddrs?: string | null
}

export type ParsedMailMeetingAttendee = {
  address: string
  name?: string
}

function parseParticipantEntry(entry: string): ParsedMailMeetingAttendee | null {
  const trimmed = entry.trim()
  if (!trimmed) return null
  const match = trimmed.match(/^(.*?)<([^>]+)>\s*$/)
  if (match) {
    const name = match[1]?.trim().replace(/^["']|["']$/g, '') || undefined
    const address = match[2]?.trim() ?? ''
    if (!COMPLETE_EMAIL_RE.test(address)) return null
    return { address, ...(name ? { name } : {}) }
  }
  if (!COMPLETE_EMAIL_RE.test(trimmed)) return null
  return { address: trimmed }
}

/** Empfaenger fuer «Mit Besprechung antworten» (wie Reply-All, ohne eigenes Konto). */
export function meetingAttendeesFromMailParticipants(
  fields: MailMeetingParticipantFields,
  excludeNormalizedEmails: string[] = []
): ParsedMailMeetingAttendee[] {
  const exclude = new Set(
    excludeNormalizedEmails.map((e) => e.trim().toLowerCase()).filter(Boolean)
  )
  const seen = new Set<string>()
  const out: ParsedMailMeetingAttendee[] = []

  const fromLine =
    fields.fromAddr?.trim() ?
      fields.fromName?.trim() ?
        `${fields.fromName.trim()} <${fields.fromAddr.trim()}>`
      : fields.fromAddr.trim()
    : ''

  const raw = [fromLine, fields.toAddrs ?? '', fields.ccAddrs ?? '', fields.bccAddrs ?? '']
    .filter((s) => s.trim().length > 0)
    .join(', ')

  for (const part of raw.split(/[,;\n]/)) {
    const p = parseParticipantEntry(part)
    if (!p) continue
    const key = p.address.toLowerCase()
    if (exclude.has(key) || seen.has(key)) continue
    seen.add(key)
    out.push(p)
    if (out.length >= 40) break
  }
  return out
}

export function formatMeetingAttendeesForComposeInput(
  attendees: ParsedMailMeetingAttendee[]
): string {
  return attendees
    .map((a) => (a.name ? `${a.name} <${a.address}>` : a.address))
    .join(', ')
}
