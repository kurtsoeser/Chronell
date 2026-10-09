import type { MeetingInvitationView } from './types'

/** Outlook-/Graph-typische Antwort-Präfixe im Betreff, nicht im UI-Titel wiederholen. */
const SUBJECT_RESPONSE_PREFIXES: RegExp[] = [
  /^zugesagt:\s*/i,
  /^abgelehnt:\s*/i,
  /^mit vorbehalt:\s*/i,
  /^angenommen:\s*/i,
  /^accepted:\s*/i,
  /^declined:\s*/i,
  /^tentative:\s*/i,
  /^tentatively accepted:\s*/i
]

export function meetingSubjectLooksLikeResponse(summary: string): boolean {
  const s = summary.trim()
  return SUBJECT_RESPONSE_PREFIXES.some((re) => re.test(s))
}

export function displayMeetingSummary(summary: string): string {
  let s = summary.trim()
  for (const re of SUBJECT_RESPONSE_PREFIXES) {
    const next = s.replace(re, '')
    if (next !== s) {
      s = next.trim()
      break
    }
  }
  return s || summary.trim()
}

export type MeetingInvitationIntroKey =
  | 'cancelledIntro'
  | 'introOrganizer'
  | 'introUpdate'
  | 'intro'

export function meetingInvitationIntroKey(invitation: MeetingInvitationView): MeetingInvitationIntroKey {
  if (invitation.isCancelled) return 'cancelledIntro'
  if (invitation.isOrganizer) return 'introOrganizer'
  if (!invitation.canRespond) return 'introUpdate'
  return 'intro'
}

export function meetingInvitationNeedsRsvp(invitation: MeetingInvitationView): boolean {
  if (invitation.isCancelled || invitation.isOrganizer || !invitation.canRespond) return false
  if (meetingSubjectLooksLikeResponse(invitation.summary)) return false
  const stat = invitation.selfPartStat
  return stat === null || stat === 'needs-action' || stat === 'unknown'
}

/** Nur Statuszeile (kein RSVP, kein Organisator-Aktionen). */
export function meetingInvitationIsCompactSummary(invitation: MeetingInvitationView): boolean {
  if (invitation.isCancelled) return false
  if (meetingInvitationNeedsRsvp(invitation)) return false
  if (invitation.isOrganizer && invitation.canReschedule) return false
  return true
}

const SHORT_MAIL_BODY_MAX_CHARS = 420

/** Kurze Antwort-Mail ohne Join — Panel sparen, Inhalt steht im Fliesstext. */
export function shouldHideMeetingInvitationPanel(
  invitation: MeetingInvitationView,
  bodyPlainLength: number
): boolean {
  if (meetingInvitationNeedsRsvp(invitation) || invitation.isCancelled) return false
  if (bodyPlainLength > SHORT_MAIL_BODY_MAX_CHARS) return false
  if (invitation.joinUrl) return false
  if (invitation.isOrganizer && invitation.canReschedule) return false
  return meetingInvitationIsCompactSummary(invitation)
}

export function meetingAttendeeResponseSummary(
  attendees: MeetingInvitationView['attendees']
): { accepted: number; declined: number; tentative: number; pending: number } {
  let accepted = 0
  let declined = 0
  let tentative = 0
  let pending = 0
  for (const a of attendees) {
    switch (a.partStat) {
      case 'accepted':
        accepted++
        break
      case 'declined':
        declined++
        break
      case 'tentative':
        tentative++
        break
      default:
        pending++
        break
    }
  }
  return { accepted, declined, tentative, pending }
}
