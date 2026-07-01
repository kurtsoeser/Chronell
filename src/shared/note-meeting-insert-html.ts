import { normalizeExternalOpenUrl } from './external-open-url'
import { extractMeetingJoinUrl } from './extract-meeting-join-url'
import type { CalendarEventView, CalendarGetEventResult } from './types'

export interface NoteMeetingInsertLabels {
  date: string
  location: string
  organizer: string
  attendees: string
  onlineMeeting: string
  joinMeeting: string
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

/** HTML-Block für Besprechungsdetails (OneNote-ähnlich) in den Notizen-Editor. */
export function buildNoteMeetingInsertHtml(input: NoteMeetingInsertInput): string {
  const { event, details, whenLabel, labels } = input
  const subject = event.title?.trim() || '—'
  const location = (details?.location ?? event.location)?.trim()
  const organizer = (details?.organizer ?? event.organizer)?.trim()
  const attendees = (details?.attendeeEmails ?? []).filter(Boolean)
  const joinUrl = resolveNoteMeetingJoinUrl(event, details)

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

  lines.push('<hr>')
  lines.push(`<h3>${escapeHtml(labels.agenda)}</h3>`)
  lines.push('<ul><li></li></ul>')
  lines.push(`<h3>${escapeHtml(labels.notes)}</h3>`)
  lines.push('<p></p>')
  lines.push(`<h3>${escapeHtml(labels.nextSteps)}</h3>`)
  lines.push(
    '<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p></p></li></ul>'
  )

  return lines.join('')
}
