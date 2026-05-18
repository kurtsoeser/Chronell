/** Zeitfenster fuer Terminplanung (D-light, lokal / ohne Buchungs-Backend). */
export interface SchedulingSlot {
  id: string
  startIso: string
  endIso: string
  isAllDay: boolean
}

export const SCHEDULING_PLACEHOLDER_EVENT_PREFIX = '__scheduling-slot__:'

export function schedulingPlaceholderEventId(slotId: string): string {
  return `${SCHEDULING_PLACEHOLDER_EVENT_PREFIX}${slotId}`
}

export function parseSchedulingPlaceholderEventId(eventId: string): string | null {
  if (!eventId.startsWith(SCHEDULING_PLACEHOLDER_EVENT_PREFIX)) return null
  return eventId.slice(SCHEDULING_PLACEHOLDER_EVENT_PREFIX.length) || null
}
