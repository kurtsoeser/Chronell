import { dueCalendarDateFromIso } from '@shared/calendar-datetime'

/** Client dueIso (YYYY-MM-DD oder ISO) → Google Tasks `due` (RFC 3339, Mitternacht UTC). */
export function dueIsoToGoogleTasksDue(dueIso: string): string {
  const s = dueIso.trim()
  if (!s) throw new Error('Ungültiges Fälligkeitsdatum.')

  const dateOnly = dueCalendarDateFromIso(s, 'local')
  if (!dateOnly || !/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) {
    throw new Error('Ungültiges Fälligkeitsdatum.')
  }
  return `${dateOnly}T00:00:00.000Z`
}
