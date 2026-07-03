import { extractMeetingRecordingUrl } from './extract-meeting-recording-url'
import type { CalendarEventView, CalendarGetEventResult } from './types'

export interface NoteMeetingRecordingResolveInput {
  accountId: string
  event: Pick<CalendarEventView, 'joinUrl' | 'webLink' | 'location'>
  details?: Pick<
    CalendarGetEventResult,
    'joinUrl' | 'bodyHtml' | 'location' | 'isOnlineMeeting'
  > | null
}

/** Aufzeichnungs-Link aus Termin-Beschreibung ableiten (Teams fügt ihn oft nach der Besprechung ein). */
export function resolveNoteMeetingRecordingFromBody(
  input: Pick<NoteMeetingRecordingResolveInput, 'details'>
): string | null {
  return extractMeetingRecordingUrl(input.details?.bodyHtml)
}
