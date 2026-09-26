import {
  dedupeRepeatedWebinarTailSections,
  extractRawTeamsOnlineMeetingBlob,
  extractTeamsMeetingJoinBlockHtml,
  findWebinarTeamsBlobSlotRange,
  stripTeamsMeetingJoinBlockHtml
} from '@shared/calendar-event-body-html'
import { buildWebinarTeamsSlotInnerHtml } from '@/lib/build-webinar-invitation-html'
import { isWebinarInvitationHtml } from '@/lib/parse-webinar-invitation-html'

const TEAMS_HEADING_RE = /<p[^>]*>[\s\S]*?Microsoft\s+Teams[\s\S]*?<\/p>/i

const ORPHAN_TEAMS_PLACEHOLDER_RE =
  /<p\b[^>]*>[\s\S]*?Beim Speichern wird hier der offizielle Microsoft-Zugangsblock eingefügt\.[\s\S]*?<\/p>/gi

function stripAllWebinarTeamsSlots(html: string): string {
  let out = html
  for (let n = 0; n < 20; n++) {
    const range = findWebinarTeamsBlobSlotRange(out)
    if (!range) break
    out = `${out.slice(0, range.start)}${out.slice(range.end)}`
  }
  return out
}

/** Verwaiste Platzhalter-Absätze (ohne Slot-Wrapper) entfernen — oft durch mehrfaches Anhängen. */
function stripOrphanTeamsPlaceholderParagraphs(html: string): string {
  return html.replace(ORPHAN_TEAMS_PLACEHOLDER_RE, '')
}

/**
 * Graph speichert den echten Teams-Meeting-Blob statt des Editor-Slots.
 * Fuer Bearbeitung: Blob entfernen, genau einen geschuetzten Slot wieder einsetzen.
 */
export function restoreWebinarTeamsSlotForEditor(
  html: string,
  teamsJoinUrl?: string | null
): string {
  const raw = html.trim()
  if (!raw || !isWebinarInvitationHtml(raw)) return raw

  const blob =
    extractRawTeamsOnlineMeetingBlob(raw) || extractTeamsMeetingJoinBlockHtml(raw)
  let base = blob ? stripTeamsMeetingJoinBlockHtml(raw) : raw
  if (!base.trim()) return raw

  base = stripAllWebinarTeamsSlots(base)
  base = stripOrphanTeamsPlaceholderParagraphs(base)

  const slot = `<span id="chronell-webinar-teams-slot">${buildWebinarTeamsSlotInnerHtml(teamsJoinUrl)}</span>`

  if (TEAMS_HEADING_RE.test(base)) {
    return dedupeRepeatedWebinarTailSections(
      base.replace(TEAMS_HEADING_RE, (heading) => `${heading}${slot}`)
    )
  }

  return dedupeRepeatedWebinarTailSections(`${base.trimEnd()}${slot}`)
}
