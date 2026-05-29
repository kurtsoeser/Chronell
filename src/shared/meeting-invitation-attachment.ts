import type { AttachmentMeta } from './types'

const CALENDAR_MIME = new Set([
  'text/calendar',
  'application/ics',
  'application/x-icalendar',
  'text/x-vcalendar'
])

/** Erkennt Kalender-Anhaenge (.ics / text/calendar) an Meeting-Einladungen. */
export function isMeetingCalendarAttachment(a: AttachmentMeta): boolean {
  const ct = (a.contentType ?? '').split(';')[0]?.trim().toLowerCase() ?? ''
  if (CALENDAR_MIME.has(ct)) return true
  const name = (a.name ?? '').trim().toLowerCase()
  if (name.endsWith('.ics') || name.endsWith('.ical')) return true
  if (name === 'invite.ics' || name.startsWith('invite')) return true
  if (name.includes('calendar') && !name.endsWith('.png') && !name.endsWith('.jpg')) return true
  return false
}
