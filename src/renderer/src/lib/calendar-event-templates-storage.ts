/**
 * Lokale Speicherung von Termin-Templates (localStorage).
 * Templates werden vollständig im Browser gespeichert – kein Server nötig.
 */

export interface CalendarEventTemplate {
  id: string
  /** Anzeigename des Templates (z. B. "Webinar 60 Min"). */
  name: string
  /** Emoji oder Kürzel für die schnelle Erkennung in Listen. */
  emoji: string
  /** Vorausgefüllter Titel (leer = kein Vorausfüllen). */
  defaultSubject: string
  /** Ort (leer = kein Vorausfüllen). */
  defaultLocation: string
  /** Dauer in Minuten – wird auf die Endzeit angewendet. 0 = nicht ändern. */
  durationMinutes: number
  /** Teams-Meeting automatisch aktivieren. */
  teamsMeeting: boolean
  /**
   * Teams Premium Besprechungsvorlage (`meetingTemplateId`), leer = Standard-Teams.
   * Nur relevant wenn `teamsMeeting` true.
   */
  teamsMeetingTemplateId: string
  /** Beschreibung als HTML. */
  descriptionHtml: string
  /** Feste Erinnerung in Minuten vor dem Termin (−1 = keine Änderung). */
  reminderMinutes: number
  /** Microsoft: Teilnehmerliste ausblenden (−1 = nicht setzen). */
  hideAttendees: boolean | -1
  /** Microsoft: Antworten anfordern (−1 = nicht setzen). */
  responseRequested: boolean | -1
  /** Microsoft: Weiterleitung zulassen (−1 = nicht setzen). */
  allowForwarding: boolean | -1
  /** ISO-Zeitstempel der letzten Änderung. */
  updatedAt: string
}

const STORAGE_KEY = 'mailclient.calendar.eventTemplates.v1'

export function readCalendarEventTemplates(): CalendarEventTemplate[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isValidTemplate).map(normalizeTemplate)
  } catch {
    return []
  }
}

export function writeCalendarEventTemplates(templates: CalendarEventTemplate[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(templates))
    window.dispatchEvent(new CustomEvent('mailclient:calendar-templates-changed'))
  } catch {
    // Storage voll oder nicht verfügbar – ignorieren
  }
}

export function saveCalendarEventTemplate(template: CalendarEventTemplate): void {
  const all = readCalendarEventTemplates()
  const idx = all.findIndex((t) => t.id === template.id)
  const next = { ...normalizeTemplate(template), updatedAt: new Date().toISOString() }
  if (idx >= 0) {
    all[idx] = next
  } else {
    all.push(next)
  }
  writeCalendarEventTemplates(all)
}

export function deleteCalendarEventTemplate(id: string): void {
  const all = readCalendarEventTemplates().filter((t) => t.id !== id)
  writeCalendarEventTemplates(all)
}

export function createEmptyTemplate(): CalendarEventTemplate {
  return {
    id: `tpl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: '',
    emoji: '📅',
    defaultSubject: '',
    defaultLocation: '',
    durationMinutes: 60,
    teamsMeeting: false,
    teamsMeetingTemplateId: '',
    descriptionHtml: '',
    reminderMinutes: -1,
    hideAttendees: -1,
    responseRequested: -1,
    allowForwarding: -1,
    updatedAt: new Date().toISOString()
  }
}

function triStateFlag(v: unknown): boolean | -1 {
  if (v === true || v === false) return v
  return -1
}

function normalizeTemplate(t: CalendarEventTemplate): CalendarEventTemplate {
  return {
    ...t,
    teamsMeetingTemplateId:
      typeof t.teamsMeetingTemplateId === 'string' ? t.teamsMeetingTemplateId.trim() : '',
    hideAttendees: triStateFlag(t.hideAttendees),
    responseRequested: triStateFlag(t.responseRequested),
    allowForwarding: triStateFlag(t.allowForwarding)
  }
}

function isValidTemplate(x: unknown): x is CalendarEventTemplate {
  if (typeof x !== 'object' || x === null) return false
  const t = x as Record<string, unknown>
  return (
    typeof t.id === 'string' &&
    typeof t.name === 'string' &&
    typeof t.emoji === 'string'
  )
}
