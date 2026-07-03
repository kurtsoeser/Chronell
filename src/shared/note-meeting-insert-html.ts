import { normalizeExternalOpenUrl } from './external-open-url'
import { extractMeetingJoinUrl } from './extract-meeting-join-url'
import { extractMeetingRecapUrl, extractMeetingStreamRecordingUrl } from './extract-meeting-recording-url'
import { buildTeamsMeetingRecapUrlFromJoinUrl } from './note-teams-meeting-recap'
import type { CalendarEventView, CalendarGetEventResult } from './types'

export const NOTE_MEETING_BLOCK_ATTR = 'data-note-meeting-block' as const
export const NOTE_MEETING_HEADER_ATTR = 'data-note-meeting-header' as const
export const NOTE_MEETING_ACCOUNT_ID_ATTR = 'data-note-meeting-account-id' as const
export const NOTE_MEETING_GRAPH_EVENT_ID_ATTR = 'data-note-meeting-graph-event-id' as const
export const NOTE_MEETING_GRAPH_CALENDAR_ID_ATTR = 'data-note-meeting-graph-calendar-id' as const

export interface NoteMeetingBlockMetadata {
  accountId: string
  graphEventId: string
  graphCalendarId?: string | null
}

export interface NoteMeetingInsertLabels {
  date: string
  location: string
  organizer: string
  attendees: string
  onlineMeeting: string
  joinMeeting: string
  meetingRecap: string
  viewRecap: string
  meetingRecording: string
  viewRecording: string
  agenda: string
  notes: string
  nextSteps: string
}

export interface NoteMeetingInsertInput {
  event: Pick<
    CalendarEventView,
    'title' | 'startIso' | 'endIso' | 'isAllDay' | 'location' | 'organizer' | 'joinUrl' | 'webLink'
  >
  details?: Pick<
    CalendarGetEventResult,
    'attendeeEmails' | 'joinUrl' | 'location' | 'organizer' | 'bodyHtml' | 'isOnlineMeeting'
  > | null
  whenLabel: string
  labels: NoteMeetingInsertLabels
  metadata?: NoteMeetingBlockMetadata | null
  /** Teams-Meeting-Recap (Zusammenfassung); sonst aus `details.bodyHtml` extrahiert. */
  recapUrl?: string | null
  /** Stream-/SharePoint-Aufzeichnung oder Recap-Fallback bei Graph-Aufzeichnung. */
  recordingLinkUrl?: string | null
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const MEETING_WEB_LINK_RE =
  /teams\.(microsoft|live)\.com|meet\.google\.com|zoom\.us|webex\.com/i

/** Erlaubte http(s)/Teams-URLs; lehnt Platzhalter wie `#` ab. */
export function normalizeNoteMeetingJoinUrl(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim()
  if (!trimmed || trimmed === '#' || trimmed.startsWith('#')) return null
  return normalizeExternalOpenUrl(trimmed)
}

/** Teams-/Meet-Beitrittslink aus Termin-Details, Cache und Body ableiten. */
export function resolveNoteMeetingJoinUrl(
  event: Pick<CalendarEventView, 'joinUrl' | 'webLink' | 'location'>,
  details?: Pick<
    CalendarGetEventResult,
    'joinUrl' | 'bodyHtml' | 'location' | 'isOnlineMeeting'
  > | null
): string | null {
  const candidates: Array<string | null | undefined> = [
    details?.joinUrl,
    event.joinUrl,
    extractMeetingJoinUrl(details?.bodyHtml),
    extractMeetingJoinUrl(details?.location),
    extractMeetingJoinUrl(event.location)
  ]

  const webLink = normalizeNoteMeetingJoinUrl(event.webLink)
  if (webLink && MEETING_WEB_LINK_RE.test(webLink)) {
    candidates.push(webLink)
  } else if (webLink && details?.isOnlineMeeting) {
    candidates.push(webLink)
  }

  for (const candidate of candidates) {
    const normalized = normalizeNoteMeetingJoinUrl(candidate)
    if (normalized) return normalized
  }

  return null
}

/** Nur der aktualisierbare Kopfbereich (Titel, Metadaten). */
export function buildNoteMeetingHeaderHtml(
  input: Omit<NoteMeetingInsertInput, 'metadata'>
): string {
  const { event, details, whenLabel, labels, recapUrl: recapUrlInput, recordingLinkUrl: recordingLinkInput } =
    input
  const subject = event.title?.trim() || '—'
  const location = (details?.location ?? event.location)?.trim()
  const organizer = (details?.organizer ?? event.organizer)?.trim()
  const attendees = (details?.attendeeEmails ?? []).filter(Boolean)
  const joinUrl = resolveNoteMeetingJoinUrl(event, details)
  const recapUrl = normalizeNoteMeetingJoinUrl(
    recapUrlInput ??
      extractMeetingRecapUrl(details?.bodyHtml) ??
      (joinUrl ? buildTeamsMeetingRecapUrlFromJoinUrl(joinUrl) : null)
  )
  const recordingLinkUrl = normalizeNoteMeetingJoinUrl(
    recordingLinkInput ?? extractMeetingStreamRecordingUrl(details?.bodyHtml)
  )

  const lines: string[] = [
    `<h2>${escapeHtml(subject)}</h2>`,
    `<p><strong>${escapeHtml(labels.date)}:</strong> ${escapeHtml(whenLabel)}</p>`
  ]

  if (location) {
    lines.push(
      `<p><strong>${escapeHtml(labels.location)}:</strong> ${escapeHtml(location)}</p>`
    )
  }
  if (organizer) {
    lines.push(
      `<p><strong>${escapeHtml(labels.organizer)}:</strong> ${escapeHtml(organizer)}</p>`
    )
  }
  if (attendees.length > 0) {
    lines.push(
      `<p><strong>${escapeHtml(labels.attendees)}:</strong> ${escapeHtml(attendees.join(', '))}</p>`
    )
  }
  if (joinUrl) {
    const safeUrl = escapeHtml(joinUrl)
    lines.push(
      `<p><strong>${escapeHtml(labels.onlineMeeting)}:</strong> <a href="${safeUrl}" rel="noopener noreferrer" target="_blank">${escapeHtml(labels.joinMeeting)}</a></p>`
    )
  }
  if (recapUrl) {
    const safeUrl = escapeHtml(recapUrl)
    lines.push(
      `<p><strong>${escapeHtml(labels.meetingRecap)}:</strong> <a href="${safeUrl}" rel="noopener noreferrer" target="_blank">${escapeHtml(labels.viewRecap)}</a></p>`
    )
  }
  if (recordingLinkUrl && recordingLinkUrl !== recapUrl) {
    const safeUrl = escapeHtml(recordingLinkUrl)
    lines.push(
      `<p><strong>${escapeHtml(labels.meetingRecording)}:</strong> <a href="${safeUrl}" rel="noopener noreferrer" target="_blank">${escapeHtml(labels.viewRecording)}</a></p>`
    )
  } else if (recordingLinkUrl && !recapUrl) {
    const safeUrl = escapeHtml(recordingLinkUrl)
    lines.push(
      `<p><strong>${escapeHtml(labels.meetingRecording)}:</strong> <a href="${safeUrl}" rel="noopener noreferrer" target="_blank">${escapeHtml(labels.viewRecording)}</a></p>`
    )
  }

  return lines.join('')
}

/** HTML-Block für Besprechungsdetails (OneNote-ähnlich) in den Notizen-Editor. */
export function buildNoteMeetingInsertHtml(input: NoteMeetingInsertInput): string {
  const { labels, metadata } = input
  const header = buildNoteMeetingHeaderHtml(input)
  const body = [
    '<hr>',
    `<h3>${escapeHtml(labels.agenda)}</h3>`,
    '<ul><li></li></ul>',
    `<h3>${escapeHtml(labels.notes)}</h3>`,
    '<p></p>',
    `<h3>${escapeHtml(labels.nextSteps)}</h3>`,
    '<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p></p></li></ul>'
  ].join('')

  if (!metadata?.accountId?.trim() || !metadata.graphEventId?.trim()) {
    return `${header}${body}`
  }

  const attrs = [
    `${NOTE_MEETING_BLOCK_ATTR}="true"`,
    `${NOTE_MEETING_ACCOUNT_ID_ATTR}="${escapeHtml(metadata.accountId.trim())}"`,
    `${NOTE_MEETING_GRAPH_EVENT_ID_ATTR}="${escapeHtml(metadata.graphEventId.trim())}"`
  ]
  const calendarId = metadata.graphCalendarId?.trim()
  if (calendarId) {
    attrs.push(`${NOTE_MEETING_GRAPH_CALENDAR_ID_ATTR}="${escapeHtml(calendarId)}"`)
  }

  return `<div ${attrs.join(' ')}><div ${NOTE_MEETING_HEADER_ATTR}="true">${header}</div>${body}</div>`
}
