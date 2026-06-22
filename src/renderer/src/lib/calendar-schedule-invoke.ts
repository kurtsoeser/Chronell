import { IPC } from '@shared/ipc-channels'
import type {
  CalendarAttendeeScheduleView,
  CalendarFindLocalFreeSlotsInput,
  CalendarFindMeetingTimesInput,
  CalendarFreeSlot,
  CalendarGetAttendeeScheduleInput
} from '@shared/types'

type InvokeFn = (channel: string, payload?: unknown) => Promise<unknown>

function getInvoke(): InvokeFn | undefined {
  const m = window.mailClient as typeof window.mailClient & { invoke?: InvokeFn }
  return typeof m.invoke === 'function' ? m.invoke : undefined
}

async function calendarInvoke<T>(
  method: keyof typeof window.mailClient.calendar,
  channel: string,
  input: unknown
): Promise<T> {
  const fn = window.mailClient?.calendar?.[method]
  if (typeof fn === 'function') {
    return (fn as (arg: unknown) => Promise<T>)(input)
  }
  const inv = getInvoke()
  if (inv) {
    return inv(channel, input) as Promise<T>
  }
  return Promise.reject(
    new Error(
      'Kalender-Planung: Bitte MailClient vollstaendig beenden und neu starten (Preload-Update).'
    )
  )
}

export async function safeFindLocalFreeSlots(
  input: CalendarFindLocalFreeSlotsInput
): Promise<CalendarFreeSlot[]> {
  return calendarInvoke('findLocalFreeSlots', IPC.calendar.findLocalFreeSlots, input)
}

export async function safeGetAttendeeSchedule(
  input: CalendarGetAttendeeScheduleInput
): Promise<CalendarAttendeeScheduleView[]> {
  return calendarInvoke('getAttendeeSchedule', IPC.calendar.getAttendeeSchedule, input)
}

export async function safeFindMeetingTimes(
  input: CalendarFindMeetingTimesInput
): Promise<CalendarFreeSlot[]> {
  return calendarInvoke('findMeetingTimes', IPC.calendar.findMeetingTimes, input)
}
