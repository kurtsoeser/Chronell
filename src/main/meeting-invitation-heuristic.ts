import type { MailFull, MeetingInvitationView } from '@shared/types'
import { extractMeetingJoinUrl } from '@shared/extract-meeting-join-url'
import {
  extractIcsFromHtml,
  extractMeetingTimesFromText
} from '@shared/meeting-invitation-extract'
import { extractEmailsFromAddressLine } from '@shared/mail-participants'

/** Fallback-Einladung aus Mail-Metadaten, wenn Graph/ICS nicht verfuegbar sind. */
export function buildHeuristicMeetingInvitation(
  msg: MailFull,
  accountEmail: string | null,
  joinUrlFallback: string | null,
  provider: string | undefined
): MeetingInvitationView | null {
  void accountEmail
  const joinUrl = joinUrlFallback ?? extractMeetingJoinUrl(msg.bodyHtml ?? msg.bodyText ?? msg.snippet)
  if (!joinUrl && !msg.subject?.trim()) return null

  const times = extractMeetingTimesFromText(
    [msg.bodyHtml, msg.bodyText, msg.snippet, msg.subject].filter(Boolean).join('\n')
  )

  const fromEmail = msg.fromAddr?.trim().toLowerCase() ?? null
  const attendeeEmails = [
    ...extractEmailsFromAddressLine(msg.toAddrs),
    ...extractEmailsFromAddressLine(msg.ccAddrs)
  ]
  const attendees = [...new Set(attendeeEmails)].map((email) => ({
    email,
    name: null,
    partStat: 'unknown' as const
  }))

  const canRespond = provider === 'microsoft' && Boolean(times)

  return {
    uid: null,
    method: 'REQUEST',
    sequence: 0,
    status: null,
    summary: msg.subject?.trim() || 'Termin',
    startIso: times?.startIso ?? null,
    endIso: times?.endIso ?? null,
    isAllDay: false,
    location: /teams/i.test(joinUrl ?? '') ? 'Microsoft Teams-Besprechung' : null,
    descriptionPlain: null,
    bodyHtml: extractIcsFromHtml(msg.bodyHtml) ? msg.bodyHtml : null,
    organizer: fromEmail
      ? { email: fromEmail, name: msg.fromName?.trim() || null }
      : null,
    attendees,
    joinUrl,
    selfPartStat: null,
    isCancelled: false,
    canRespond,
    respondUnsupportedReason: canRespond
      ? null
      : provider !== 'microsoft'
        ? 'RSVP ist nur fuer Microsoft-Konten verfuegbar.'
        : 'Terminzeiten konnten nicht gelesen werden — RSVP nicht moeglich.',
    allowNewTimeProposals: true,
    selfProposedStartIso: null,
    selfProposedEndIso: null
  }
}
