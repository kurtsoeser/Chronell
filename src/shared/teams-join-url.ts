/**
 * Teams liefert oft zwei Join-URLs:
 * - lang: `https://teams.microsoft.com/l/meetup-join/19%3ameeting_…`
 * - kurz: `https://teams.microsoft.com/meet/{id}?p={passcode}` (im joinInformation-Block)
 * Fuer Anzeige/Kopieren bevorzugen wir den kurzen Meet-Link.
 */

const TEAMS_SHORT_MEET_RE =
  /https:\/\/(?:teams\.microsoft\.com|teams\.live\.com)\/meet\/[^\s"'<>\\]+/gi
const TEAMS_LONG_JOIN_RE = /\/l\/meetup-join\//i
const TEAMS_LONG_JOIN_URL_RE =
  /https:\/\/(?:teams\.microsoft\.com|teams\.live\.com)\/l\/meetup-join\/[^\s"'<>\\]+/gi

export function isTeamsLongMeetupJoinUrl(url: string | null | undefined): boolean {
  const u = url?.trim()
  if (!u) return false
  return TEAMS_LONG_JOIN_RE.test(u)
}

function cleanExtractedTeamsUrl(raw: string): string {
  return raw.replace(/[),.!?;:]+$/g, '').trim()
}

export function extractTeamsShortMeetUrl(htmlOrText: string | null | undefined): string | null {
  const raw = htmlOrText?.trim()
  if (!raw) return null
  TEAMS_SHORT_MEET_RE.lastIndex = 0
  const match = TEAMS_SHORT_MEET_RE.exec(raw)
  if (!match?.[0]) return null
  return cleanExtractedTeamsUrl(match[0]) || null
}

/** Langer Graph-/Outlook-meetup-join-Link aus Body oder Text. */
export function extractTeamsLongMeetupJoinUrl(
  htmlOrText: string | null | undefined
): string | null {
  const raw = htmlOrText?.trim()
  if (!raw) return null
  TEAMS_LONG_JOIN_URL_RE.lastIndex = 0
  const match = TEAMS_LONG_JOIN_URL_RE.exec(raw)
  if (!match?.[0]) return null
  return cleanExtractedTeamsUrl(match[0]) || null
}

/**
 * Bevorzugt den kurzen `/meet/…`-Link aus joinInformation/Body;
 * Fallback auf langen meetup-join-Link (Graph oder Body), dann sonstige joinUrl.
 */
export function preferTeamsJoinUrl(input: {
  joinUrl?: string | null
  joinInformationHtml?: string | null
  bodyHtml?: string | null
}): string | null {
  const fromInfo = extractTeamsShortMeetUrl(input.joinInformationHtml)
  if (fromInfo) return fromInfo
  const fromBodyShort = extractTeamsShortMeetUrl(input.bodyHtml)
  if (fromBodyShort) return fromBodyShort
  const direct = input.joinUrl?.trim() || null
  if (direct && !isTeamsLongMeetupJoinUrl(direct)) {
    const shortDirect = extractTeamsShortMeetUrl(direct)
    if (shortDirect) return shortDirect
    return direct
  }
  const fromJoinShort = extractTeamsShortMeetUrl(direct)
  if (fromJoinShort) return fromJoinShort
  if (direct) return direct
  const fromInfoLong = extractTeamsLongMeetupJoinUrl(input.joinInformationHtml)
  if (fromInfoLong) return fromInfoLong
  return extractTeamsLongMeetupJoinUrl(input.bodyHtml)
}
