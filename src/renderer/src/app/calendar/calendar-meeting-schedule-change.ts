import type { TFunction } from 'i18next'
import { showAppConfirm } from '@/stores/app-dialog'
import type { CalendarEventView, CalendarGetEventResult, CalendarPatchScheduleInput } from '@shared/types'

export type MeetingScheduleChangeResolution =
  | { action: 'proceed'; notifyAttendees: boolean }
  | { action: 'discard' }

export type CalendarEventScheduleSnapshot = {
  startIso: string
  endIso: string
  isAllDay: boolean
}

function scheduleInstantKey(iso: string, isAllDay: boolean): string {
  const trimmed = iso.trim()
  if (isAllDay) return trimmed.slice(0, 10)
  const ms = Date.parse(trimmed)
  return Number.isFinite(ms) ? String(ms) : trimmed
}

/** True wenn Start, Ende oder Ganztaegig sich geaendert haben. */
export function calendarEventScheduleChanged(
  prev: CalendarEventScheduleSnapshot,
  next: CalendarEventScheduleSnapshot
): boolean {
  if (prev.isAllDay !== next.isAllDay) return true
  return (
    scheduleInstantKey(prev.startIso, next.isAllDay) !==
      scheduleInstantKey(next.startIso, next.isAllDay) ||
    scheduleInstantKey(prev.endIso, next.isAllDay) !==
      scheduleInstantKey(next.endIso, next.isAllDay)
  )
}

export function calendarEventLooksLikeMeeting(
  ev: CalendarEventView,
  detail: CalendarGetEventResult | null
): boolean {
  if (detail != null && detail.attendeeEmails.length > 0) return true
  if (detail?.isOnlineMeeting) return true
  if (ev.joinUrl?.trim()) return true
  return false
}

/** Termin-Dialog: Teilnehmer / Teams / Join-URL → Update geht an Empfaenger. */
export function calendarEventDialogLooksLikeMeeting(input: {
  attendeeEmails: string[]
  teamsMeeting: boolean
  joinUrl?: string | null
}): boolean {
  if (input.attendeeEmails.length > 0) return true
  if (input.teamsMeeting) return true
  if (input.joinUrl?.trim()) return true
  return false
}

export async function loadCalendarEventDetailForMeetingCheck(
  ev: CalendarEventView
): Promise<CalendarGetEventResult | null> {
  const graphEventId = ev.graphEventId?.trim()
  if (!graphEventId) return null
  try {
    const detail = await window.mailClient.calendar.getEvent({
      accountId: ev.accountId,
      graphEventId,
      graphCalendarId: ev.graphCalendarId ?? null,
      cacheOnly: true
    })
    if (
      detail.attendeeEmails.length === 0 &&
      !detail.isOnlineMeeting &&
      !detail.joinUrl?.trim()
    ) {
      return null
    }
    return detail
  } catch {
    return null
  }
}

async function confirmMeetingScheduleChange(
  t: TFunction,
  opts?: { cancelLabel?: string }
): Promise<boolean> {
  return showAppConfirm(t('calendar.scheduleChangeDialog.body'), {
    title: t('calendar.scheduleChangeDialog.title'),
    confirmLabel: t('calendar.scheduleChangeDialog.saveAndNotify'),
    cancelLabel: opts?.cancelLabel ?? t('calendar.scheduleChangeDialog.discard')
  })
}

/** Explizite Bestaetigung vor Reschedule (Dialog / Mail-Popover). */
export async function confirmMeetingRescheduleNotify(
  t: TFunction,
  opts?: { cancelLabel?: string }
): Promise<boolean> {
  return confirmMeetingScheduleChange(t, opts)
}

/**
 * Termin-Dialog beim Speichern: wenn Zeit/Datum geaendert und Besprechung,
 * Bestaetigung dass alle Teilnehmer eine Aktualisierung erhalten.
 */
export async function confirmEventDialogMeetingReschedule(input: {
  t: TFunction
  source: CalendarEventView['source']
  previous: CalendarEventScheduleSnapshot
  next: CalendarEventScheduleSnapshot
  attendeeEmails: string[]
  teamsMeeting: boolean
  joinUrl?: string | null
}): Promise<boolean> {
  if (input.source !== 'microsoft' && input.source !== 'google') return true
  if (!calendarEventScheduleChanged(input.previous, input.next)) return true
  if (
    !calendarEventDialogLooksLikeMeeting({
      attendeeEmails: input.attendeeEmails,
      teamsMeeting: input.teamsMeeting,
      joinUrl: input.joinUrl
    })
  ) {
    return true
  }
  return confirmMeetingScheduleChange(input.t, {
    cancelLabel: input.t('calendar.scheduleChangeDialog.cancel')
  })
}

export async function resolveMeetingScheduleChange(
  ev: CalendarEventView,
  t: TFunction
): Promise<MeetingScheduleChangeResolution> {
  if (ev.source !== 'microsoft' && ev.source !== 'google') {
    return { action: 'proceed', notifyAttendees: false }
  }

  if (ev.source === 'google' && !ev.joinUrl?.trim()) {
    return { action: 'proceed', notifyAttendees: false }
  }

  if (ev.joinUrl?.trim()) {
    const save = await confirmMeetingScheduleChange(t)
    if (!save) return { action: 'discard' }
    return { action: 'proceed', notifyAttendees: true }
  }

  const detail = await loadCalendarEventDetailForMeetingCheck(ev)
  if (!calendarEventLooksLikeMeeting(ev, detail)) {
    return { action: 'proceed', notifyAttendees: false }
  }

  const save = await confirmMeetingScheduleChange(t)
  if (!save) return { action: 'discard' }
  return { action: 'proceed', notifyAttendees: true }
}

export function patchScheduleInputWithMeetingNotify(
  input: CalendarPatchScheduleInput,
  notifyAttendees: boolean
): CalendarPatchScheduleInput {
  return notifyAttendees ? { ...input, notifyAttendees: true } : input
}

/** Drag verworfen (Besprechung): kein API-PATCH, UI zuruecksetzen. */
export class CalendarScheduleChangeDiscardedError extends Error {
  constructor() {
    super('calendar.scheduleChange.discarded')
    this.name = 'CalendarScheduleChangeDiscardedError'
  }
}
