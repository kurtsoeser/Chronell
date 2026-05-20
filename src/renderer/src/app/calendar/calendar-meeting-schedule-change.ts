import type { TFunction } from 'i18next'
import { showAppConfirm } from '@/stores/app-dialog'
import type { CalendarEventView, CalendarGetEventResult, CalendarPatchScheduleInput } from '@shared/types'

export type MeetingScheduleChangeResolution =
  | { action: 'proceed'; notifyAttendees: boolean }
  | { action: 'discard' }

export function calendarEventLooksLikeMeeting(
  ev: CalendarEventView,
  detail: CalendarGetEventResult | null
): boolean {
  if (detail != null && detail.attendeeEmails.length > 0) return true
  if (detail?.isOnlineMeeting) return true
  if (ev.joinUrl?.trim()) return true
  return false
}

export async function loadCalendarEventDetailForMeetingCheck(
  ev: CalendarEventView
): Promise<CalendarGetEventResult | null> {
  const graphEventId = ev.graphEventId?.trim()
  if (!graphEventId) return null
  try {
    return await window.mailClient.calendar.getEvent({
      accountId: ev.accountId,
      graphEventId,
      graphCalendarId: ev.graphCalendarId ?? null
    })
  } catch {
    return null
  }
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

  const detail = await loadCalendarEventDetailForMeetingCheck(ev)
  if (!calendarEventLooksLikeMeeting(ev, detail)) {
    return { action: 'proceed', notifyAttendees: false }
  }

  const save = await showAppConfirm(t('calendar.scheduleChangeDialog.body'), {
    title: t('calendar.scheduleChangeDialog.title'),
    confirmLabel: t('calendar.scheduleChangeDialog.saveAndNotify'),
    cancelLabel: t('calendar.scheduleChangeDialog.discard')
  })
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
