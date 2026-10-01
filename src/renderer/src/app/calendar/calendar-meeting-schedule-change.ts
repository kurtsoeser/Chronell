import type { TFunction } from 'i18next'
import { showAppChoice, showAppConfirm } from '@/stores/app-dialog'
import type { CalendarEventView, CalendarGetEventResult, CalendarPatchScheduleInput } from '@shared/types'

export type MeetingScheduleChangeResolution =
  | { action: 'proceed'; notifyAttendees: boolean }
  | { action: 'discard' }

export type MeetingInviteNotifyScope = 'all' | 'changed'

export type MeetingInviteNotifyResolution =
  | { action: 'cancel' }
  | { action: 'proceed'; notifyAttendeeScope: MeetingInviteNotifyScope }

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

function normalizeEmailSet(emails: string[]): Set<string> {
  const out = new Set<string>()
  for (const raw of emails) {
    const a = raw.trim().toLowerCase()
    if (a) out.add(a)
  }
  return out
}

/** Teilnehmerliste geaendert (hinzugefuegt oder entfernt). */
export function calendarAttendeeSetChanged(previous: string[], next: string[]): boolean {
  const a = normalizeEmailSet(previous)
  const b = normalizeEmailSet(next)
  if (a.size !== b.size) return true
  for (const e of a) {
    if (!b.has(e)) return true
  }
  return false
}

export function calendarAttendeeDiffCounts(
  previous: string[],
  next: string[]
): { added: number; removed: number } {
  const a = normalizeEmailSet(previous)
  const b = normalizeEmailSet(next)
  let added = 0
  let removed = 0
  for (const e of b) {
    if (!a.has(e)) added += 1
  }
  for (const e of a) {
    if (!b.has(e)) removed += 1
  }
  return { added, removed }
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

/**
 * Beim Senden: wenn schon Eingeladene existieren und die Liste sich aendert,
 * Outlook-aehnliche Wahl (alle vs. nur neu hinzugefuegte/entfernte).
 * `changed` nur bei Microsoft (Graph attendees-only PATCH).
 */
export async function confirmMeetingInviteNotifyScope(input: {
  t: TFunction
  source: CalendarEventView['source']
  previouslyInvitedEmails: string[]
  nextAttendeeEmails: string[]
}): Promise<MeetingInviteNotifyResolution> {
  if (input.source !== 'microsoft' && input.source !== 'google') {
    return { action: 'proceed', notifyAttendeeScope: 'all' }
  }
  if (input.previouslyInvitedEmails.length === 0) {
    return { action: 'proceed', notifyAttendeeScope: 'all' }
  }
  if (!calendarAttendeeSetChanged(input.previouslyInvitedEmails, input.nextAttendeeEmails)) {
    return { action: 'proceed', notifyAttendeeScope: 'all' }
  }

  const { added, removed } = calendarAttendeeDiffCounts(
    input.previouslyInvitedEmails,
    input.nextAttendeeEmails
  )
  const supportsChanged = input.source === 'microsoft'
  const id = await showAppChoice(
    input.t('calendar.inviteNotifyDialog.body', {
      added,
      removed,
      invited: input.previouslyInvitedEmails.length
    }),
    {
      title: input.t('calendar.inviteNotifyDialog.title'),
      cancelLabel: input.t('calendar.inviteNotifyDialog.cancel'),
      actions: [
        {
          id: 'all',
          label: input.t('calendar.inviteNotifyDialog.sendToAll'),
          variant: 'primary'
        },
        ...(supportsChanged
          ? [
              {
                id: 'changed',
                label: input.t('calendar.inviteNotifyDialog.sendToChanged'),
                variant: 'secondary' as const
              }
            ]
          : [])
      ]
    }
  )
  if (id === 'all') return { action: 'proceed', notifyAttendeeScope: 'all' }
  if (id === 'changed' && supportsChanged) {
    return { action: 'proceed', notifyAttendeeScope: 'changed' }
  }
  return { action: 'cancel' }
}

/**
 * Nach Drag: Dialog nur bei klarem Meeting-Signal (Join-URL).
 * Sonst kein getEvent-Roundtrip — der blockierte früher spürbar das Persist-Feeling.
 * Teilnehmer ohne Teams-Link werden ohne Extra-Bestätigung mitnotify=false gepatcht.
 */
export async function resolveMeetingScheduleChange(
  ev: CalendarEventView,
  t: TFunction
): Promise<MeetingScheduleChangeResolution> {
  if (ev.source !== 'microsoft' && ev.source !== 'google') {
    return { action: 'proceed', notifyAttendees: false }
  }

  if (!ev.joinUrl?.trim()) {
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
