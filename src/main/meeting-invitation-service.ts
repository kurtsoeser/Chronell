import type {
  CalendarParseMeetingFromMessageResult,
  CalendarRespondToMeetingInput,
  CalendarRespondToMeetingResult,
  MeetingAttendeePartStat,
  MeetingInvitationView
} from '@shared/types'
import { extractMeetingJoinUrl } from '@shared/extract-meeting-join-url'
import { looksLikeMeetingInvitationMail } from '@shared/meeting-invitation-detect'
import { extractIcsFromHtml } from '@shared/meeting-invitation-extract'
import { isMeetingCalendarAttachment } from '@shared/meeting-invitation-attachment'
import {
  parseIcsMeetingInvitation,
  resolveSelfMeetingPartStat,
  type IcsAttendeePartStat,
  type IcsMeetingAttendee
} from '@shared/parse-ics'
import { listAccounts } from './accounts'
import { getMessageById } from './db/messages-repo-ops'
import { fetchMailAttachmentsMeta, downloadMailAttachmentBytes } from './mail-attachment-fetch'
import {
  enrichGraphMeetingInvitation,
  respondToGraphMeetingInvitation
} from './graph/calendar-meeting-response'
import { fetchMeetingInvitationFromGraphMessage } from './graph/meeting-invitation-graph'
import {
  fetchIcsTextFromGraphMessageAttachments,
  fetchIcsTextFromGraphMessageMime
} from './graph/meeting-invitation-mime'
import { buildHeuristicMeetingInvitation } from './meeting-invitation-heuristic'
import { mergeMeetingAttendees } from '@shared/merge-meeting-attendees'

function mapPartStat(v: IcsAttendeePartStat): MeetingAttendeePartStat {
  return v
}

function mapAttendees(rows: IcsMeetingAttendee[]): MeetingInvitationView['attendees'] {
  return rows.map((a) => ({
    email: a.email,
    name: a.name,
    partStat: mapPartStat(a.partStat)
  }))
}

function toMeetingViewFromIcs(
  invitation: NonNullable<ReturnType<typeof parseIcsMeetingInvitation>['invitation']>,
  accountEmail: string | null,
  joinUrlFallback: string | null,
  canRespond: boolean,
  respondUnsupportedReason: string | null,
  graphMeta: {
    allowNewTimeProposals: boolean
    selfPartStat: MeetingAttendeePartStat | null
    selfProposedStartIso: string | null
    selfProposedEndIso: string | null
    attendees: MeetingInvitationView['attendees']
  } | null
): MeetingInvitationView {
  const icsSelfPartStat = resolveSelfMeetingPartStat(invitation.attendees, accountEmail)
  const selfPartStat = graphMeta?.selfPartStat ?? (icsSelfPartStat ? mapPartStat(icsSelfPartStat) : null)
  const attendees = mergeMeetingAttendees(
    mapAttendees(invitation.attendees),
    graphMeta?.attendees,
    accountEmail,
    selfPartStat
  )
  return {
    uid: invitation.uid,
    method: invitation.method,
    sequence: invitation.sequence,
    status: invitation.status,
    summary: invitation.summary,
    startIso: invitation.startIso,
    endIso: invitation.endIso,
    isAllDay: invitation.isAllDay,
    location: invitation.location,
    descriptionPlain: invitation.descriptionPlain,
    bodyHtml: invitation.bodyHtml,
    organizer: invitation.organizer,
    attendees,
    joinUrl: invitation.joinUrl ?? joinUrlFallback,
    selfPartStat,
    isCancelled: invitation.isCancelled,
    canRespond,
    respondUnsupportedReason,
    allowNewTimeProposals: graphMeta?.allowNewTimeProposals ?? true,
    selfProposedStartIso: graphMeta?.selfProposedStartIso ?? null,
    selfProposedEndIso: graphMeta?.selfProposedEndIso ?? null
  }
}

async function enrichIcsInvitation(
  invitation: NonNullable<ReturnType<typeof parseIcsMeetingInvitation>['invitation']>,
  acc: { id: string; provider: string; email?: string } | undefined,
  msgRemoteId: string | null,
  joinUrlFallback: string | null
): Promise<{ invitation: MeetingInvitationView; warnings: string[] }> {
  const canRespond = acc?.provider === 'microsoft' && !invitation.isCancelled
  const respondUnsupportedReason =
    acc?.provider === 'google'
      ? 'RSVP fuer Google-Konten ist noch nicht verfuegbar.'
      : acc?.provider !== 'microsoft'
        ? 'RSVP ist nur fuer Microsoft-Konten verfuegbar.'
        : invitation.isCancelled
          ? 'Der Termin wurde abgesagt.'
          : null

  let graphMeta: {
    allowNewTimeProposals: boolean
    selfPartStat: MeetingAttendeePartStat | null
    selfProposedStartIso: string | null
    selfProposedEndIso: string | null
    attendees: MeetingInvitationView['attendees']
  } | null = null

  if (acc?.provider === 'microsoft' && invitation.uid?.trim()) {
    try {
      graphMeta = await enrichGraphMeetingInvitation(
        acc.id,
        invitation.uid,
        acc.email ?? null,
        msgRemoteId
      )
    } catch {
      graphMeta = null
    }
  }

  return {
    invitation: toMeetingViewFromIcs(
      invitation,
      acc?.email ?? null,
      joinUrlFallback,
      canRespond,
      respondUnsupportedReason,
      graphMeta
    ),
    warnings: []
  }
}

async function parseFromIcsText(
  text: string,
  acc: { id: string; provider: string; email?: string } | undefined,
  msgRemoteId: string | null,
  joinUrlFallback: string | null
): Promise<{ invitation: MeetingInvitationView | null; warnings: string[] }> {
  const { invitation, warnings } = parseIcsMeetingInvitation(text)
  if (!invitation) return { invitation: null, warnings }
  const view = await enrichIcsInvitation(invitation, acc, msgRemoteId, joinUrlFallback)
  return { invitation: view.invitation, warnings: [...warnings, ...view.warnings] }
}

async function parseFromIcsAttachment(
  messageId: number,
  calendarAttachmentId: string,
  acc: { id: string; provider: string; email?: string } | undefined,
  msgRemoteId: string | null,
  joinUrlFallback: string | null
): Promise<{ invitation: MeetingInvitationView | null; warnings: string[] }> {
  const file = await downloadMailAttachmentBytes(messageId, calendarAttachmentId)
  return parseFromIcsText(file.bytes.toString('utf8'), acc, msgRemoteId, joinUrlFallback)
}

export async function parseMeetingInvitationFromMessage(
  messageId: number
): Promise<CalendarParseMeetingFromMessageResult> {
  const msg = getMessageById(messageId)
  if (!msg) {
    return { invitation: null, warnings: ['Mail nicht gefunden.'] }
  }

  const accounts = await listAccounts()
  const acc = accounts.find((a) => a.id === msg.accountId)
  const joinUrlFallback = extractMeetingJoinUrl(
    [msg.bodyHtml, msg.bodyText, msg.snippet].filter(Boolean).join('\n')
  )

  const looksLikeMeeting = looksLikeMeetingInvitationMail(msg)
  const diagnostics: string[] = []

  let attachments: Awaited<ReturnType<typeof fetchMailAttachmentsMeta>> = []
  try {
    attachments = await fetchMailAttachmentsMeta(messageId)
  } catch (e) {
    diagnostics.push(e instanceof Error ? e.message : String(e))
  }

  const calendarAttachment = attachments.find(isMeetingCalendarAttachment)
  if (calendarAttachment) {
    try {
      const fromIcs = await parseFromIcsAttachment(
        messageId,
        calendarAttachment.id,
        acc,
        msg.remoteId ?? null,
        joinUrlFallback
      )
      if (fromIcs.invitation) return { invitation: fromIcs.invitation, warnings: fromIcs.warnings }
      diagnostics.push(...fromIcs.warnings)
    } catch (e) {
      diagnostics.push(e instanceof Error ? e.message : String(e))
    }
  }

  if (acc?.provider === 'microsoft' && msg.remoteId?.trim()) {
    try {
      const icsMime = await fetchIcsTextFromGraphMessageMime(acc.id, msg.remoteId)
      if (icsMime) {
        const fromMime = await parseFromIcsText(icsMime, acc, msg.remoteId, joinUrlFallback)
        if (fromMime.invitation) return { invitation: fromMime.invitation, warnings: fromMime.warnings }
        diagnostics.push(...fromMime.warnings)
      }
    } catch (e) {
      diagnostics.push(e instanceof Error ? e.message : String(e))
    }

    try {
      const fromGraph = await fetchMeetingInvitationFromGraphMessage(
        acc.id,
        msg.remoteId,
        acc.email ?? null,
        joinUrlFallback
      )
      if (fromGraph) return { invitation: fromGraph, warnings: [] }
    } catch (e) {
      diagnostics.push(e instanceof Error ? e.message : String(e))
    }

    try {
      const icsAtt = await fetchIcsTextFromGraphMessageAttachments(acc.id, msg.remoteId)
      if (icsAtt) {
        const fromAtt = await parseFromIcsText(icsAtt, acc, msg.remoteId, joinUrlFallback)
        if (fromAtt.invitation) return { invitation: fromAtt.invitation, warnings: fromAtt.warnings }
        diagnostics.push(...fromAtt.warnings)
      }
    } catch (e) {
      diagnostics.push(e instanceof Error ? e.message : String(e))
    }
  }

  const icsInHtml = extractIcsFromHtml(msg.bodyHtml)
  if (icsInHtml) {
    try {
      const fromHtml = await parseFromIcsText(icsInHtml, acc, msg.remoteId ?? null, joinUrlFallback)
      if (fromHtml.invitation) return { invitation: fromHtml.invitation, warnings: fromHtml.warnings }
      diagnostics.push(...fromHtml.warnings)
    } catch (e) {
      diagnostics.push(e instanceof Error ? e.message : String(e))
    }
  }

  if (looksLikeMeeting) {
    const fallback = buildHeuristicMeetingInvitation(
      msg,
      acc?.email ?? null,
      joinUrlFallback,
      acc?.provider
    )
    if (fallback) {
      const warnings = [...diagnostics]
      if (!fallback.startIso || !fallback.endIso) {
        warnings.push('Terminzeiten konnten nicht vollstaendig gelesen werden.')
      } else if (warnings.length > 0) {
        warnings.push('Termindetails teilweise aus Mail-Inhalt rekonstruiert.')
      }
      return { invitation: fallback, warnings }
    }
  }

  return { invitation: null, warnings: diagnostics }
}

export async function respondToMeetingInvitation(
  input: CalendarRespondToMeetingInput
): Promise<CalendarRespondToMeetingResult> {
  const parsed = await parseMeetingInvitationFromMessage(input.messageId)
  const inv = parsed.invitation
  if (!inv?.uid?.trim()) {
    return { ok: false, error: 'Keine Meeting-Einladung mit UID gefunden.' }
  }
  if (!inv.canRespond) {
    return { ok: false, error: inv.respondUnsupportedReason ?? 'Antwort nicht moeglich.' }
  }
  if (input.response === 'propose') {
    if (!inv.allowNewTimeProposals) {
      return { ok: false, error: 'Der Organisator erlaubt keine alternativen Zeiten.' }
    }
    if (inv.isAllDay) {
      return { ok: false, error: 'Fuer Ganztagstermine ist kein Zeitvorschlag moeglich.' }
    }
  }

  const accounts = await listAccounts()
  const acc = accounts.find((a) => a.id === input.accountId)
  if (!acc || acc.provider !== 'microsoft') {
    return { ok: false, error: 'RSVP ist nur fuer Microsoft-Konten verfuegbar.' }
  }

  try {
    const result = await respondToGraphMeetingInvitation(
      input.accountId,
      inv.uid,
      input.response,
      input.comment ?? null,
      input.proposedStartIso ?? null,
      input.proposedEndIso ?? null,
      input.sendResponse !== false
    )
    return {
      ok: true,
      selfPartStat: result.selfPartStat,
      selfProposedStartIso: result.selfProposedStartIso,
      selfProposedEndIso: result.selfProposedEndIso
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return { ok: false, error: message }
  }
}
