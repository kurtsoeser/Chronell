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
  /** Beschreibung als HTML. */
  descriptionHtml: string
  /** Feste Erinnerung in Minuten vor dem Termin (−1 = keine Änderung). */
  reminderMinutes: number
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
    return parsed.filter(isValidTemplate)
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
  const next = { ...template, updatedAt: new Date().toISOString() }
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
    descriptionHtml: '',
    reminderMinutes: -1,
    updatedAt: new Date().toISOString()
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
