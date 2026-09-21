import type { CalendarEventSensitivity, CalendarEventShowAs } from './types/calendar'

export const CALENDAR_EVENT_SHOW_AS_OPTIONS: CalendarEventShowAs[] = [
  'free',
  'tentative',
  'busy',
  'oof',
  'workingElsewhere'
]

export const DEFAULT_CALENDAR_EVENT_SHOW_AS: CalendarEventShowAs = 'busy'

export function normalizeCalendarEventShowAs(
  raw: string | null | undefined
): CalendarEventShowAs | null {
  switch (raw?.trim().toLowerCase()) {
    case 'free':
      return 'free'
    case 'tentative':
      return 'tentative'
    case 'busy':
      return 'busy'
    case 'oof':
      return 'oof'
    case 'workingelsewhere':
      return 'workingElsewhere'
    default:
      return null
  }
}

export function normalizeCalendarEventSensitivity(
  raw: string | null | undefined
): CalendarEventSensitivity | null {
  switch (raw?.trim().toLowerCase()) {
    case 'normal':
      return 'normal'
    case 'personal':
      return 'personal'
    case 'private':
      return 'private'
    case 'confidential':
      return 'confidential'
    default:
      return null
  }
}

/** UI-Checkbox Privat: alles außer `normal` als privat behandeln. */
export function calendarEventSensitivityIsPrivate(
  sensitivity: CalendarEventSensitivity | null | undefined
): boolean {
  return sensitivity != null && sensitivity !== 'normal'
}

export function calendarEventSensitivityFromPrivate(isPrivate: boolean): CalendarEventSensitivity {
  return isPrivate ? 'private' : 'normal'
}

/** Google Calendar `transparency` aus Outlook-ShowAs. */
export function googleTransparencyFromShowAs(
  showAs: CalendarEventShowAs | null | undefined
): 'transparent' | 'opaque' {
  return showAs === 'free' ? 'transparent' : 'opaque'
}

export function showAsFromGoogleTransparency(
  transparency: string | null | undefined
): CalendarEventShowAs {
  return transparency?.trim().toLowerCase() === 'transparent' ? 'free' : 'busy'
}

/** Google Calendar `visibility` aus Sensitivity. */
export function googleVisibilityFromSensitivity(
  sensitivity: CalendarEventSensitivity | null | undefined
): 'default' | 'private' {
  return calendarEventSensitivityIsPrivate(sensitivity) ? 'private' : 'default'
}

export function sensitivityFromGoogleVisibility(
  visibility: string | null | undefined
): CalendarEventSensitivity {
  const v = visibility?.trim().toLowerCase()
  if (v === 'private' || v === 'confidential') return 'private'
  return 'normal'
}
