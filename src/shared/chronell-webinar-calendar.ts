/** Graph Extended Property: Termin ist Chronell-Webinar-Einladung (HTML-Editor, kein TipTap). */
export const GRAPH_CHRONELL_WEBINAR_INVITATION_PROP_ID =
  'String {00020329-0000-0000-C000-000000000046} Name ChronellWebinarInvitation'

/** Graph Extended Property: Teilnehmer-Entwurf (noch nicht eingeladen). */
export const GRAPH_CHRONELL_WEBINAR_DRAFT_ATTENDEES_PROP_ID =
  'String {00020329-0000-0000-C000-000000000046} Name ChronellWebinarDraftAttendees'

export interface ChronellWebinarDraftAttendees {
  required: string[]
  optional: string[]
}

const SIMPLE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i

function normalizeDraftAttendeeEmails(emails: string[] | null | undefined): string[] {
  if (!emails?.length) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of emails) {
    const addr = raw.trim().toLowerCase()
    if (!addr || !SIMPLE_EMAIL.test(addr) || seen.has(addr)) continue
    seen.add(addr)
    out.push(addr)
  }
  return out
}

export function parseChronellWebinarDraftAttendees(
  value: string | null | undefined
): ChronellWebinarDraftAttendees | null {
  const raw = value?.trim() ?? ''
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as { required?: unknown; optional?: unknown }
    const required = normalizeDraftAttendeeEmails(
      Array.isArray(parsed.required) ? (parsed.required as string[]) : []
    )
    const optional = normalizeDraftAttendeeEmails(
      Array.isArray(parsed.optional) ? (parsed.optional as string[]) : []
    )
    if (required.length === 0 && optional.length === 0) return null
    return { required, optional }
  } catch {
    return null
  }
}

/** Leerer String loescht den Entwurf in Graph Extended Properties. */
export function formatChronellWebinarDraftAttendees(
  draft: ChronellWebinarDraftAttendees | null | undefined
): string {
  if (!draft) return ''
  const required = normalizeDraftAttendeeEmails(draft.required)
  const optional = normalizeDraftAttendeeEmails(draft.optional)
  if (required.length === 0 && optional.length === 0) return ''
  return JSON.stringify({ required, optional })
}

export function parseChronellWebinarInvitationFlag(value: string | null | undefined): boolean {
  return (value ?? '').trim().toLowerCase() === 'true'
}

export function formatChronellWebinarInvitationFlag(active: boolean): string {
  return active ? 'true' : 'false'
}

/** Erkennt gespeicherte #kurtrocks-Webinar-Einladungen (nicht TipTap-Fliesstext). */
export function isChronellWebinarInvitationHtml(html: string | null | undefined): boolean {
  const raw = html?.trim() ?? ''
  if (!raw) return false
  return (
    raw.includes('#kurtrocks') ||
    raw.includes('chronell-webinar-teams-slot') ||
    (raw.includes('bgcolor="#121212"') &&
      (raw.includes('Hinweise &amp; Hilfen') || raw.includes('Hinweise & Hilfen'))) ||
    (raw.includes('bgcolor="#121212"') && raw.includes('Microsoft Teams'))
  )
}
