export const NOTE_DEFAULT_APPOINTMENT_MINUTES = 30

export interface NoteCalendarSpan {
  allDay: boolean
  startIso: string
  endIso: string
}

/** Anzeige im Notizen-Kalender: Erstellungsdatum oder Planung. */
export type NotesCalendarDateMode = 'created' | 'scheduled'

function addMinutesIso(iso: string, minutes: number): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  d.setMinutes(d.getMinutes() + minutes)
  return d.toISOString()
}

function addOneCalendarDay(dateOnly: string): string {
  const d = new Date(`${dateOnly}T12:00:00.000Z`)
  if (Number.isNaN(d.getTime())) return dateOnly
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

function noteCreatedAllDaySpan(createdAt: string): NoteCalendarSpan | null {
  const raw = createdAt?.trim()
  if (!raw) return null
  const d0 = raw.slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d0)) return null
  return { allDay: true, startIso: d0, endIso: addOneCalendarDay(d0) }
}

function noteScheduledSpan(note: {
  scheduledStartIso: string | null
  scheduledEndIso: string | null
  scheduledAllDay: boolean
}): NoteCalendarSpan | null {
  const start = note.scheduledStartIso?.trim()
  if (!start) return null
  if (note.scheduledAllDay) {
    const d0 = start.slice(0, 10)
    const d1 = addOneCalendarDay(d0)
    return { allDay: true, startIso: d0, endIso: d1 }
  }
  const end = note.scheduledEndIso?.trim() || addMinutesIso(start, NOTE_DEFAULT_APPOINTMENT_MINUTES)
  const s = new Date(start).getTime()
  const e = new Date(end).getTime()
  if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) return null
  return { allDay: false, startIso: start, endIso: end }
}

export function resolveNoteCalendarSpanForMode(
  note: {
    createdAt: string
    scheduledStartIso: string | null
    scheduledEndIso: string | null
    scheduledAllDay: boolean
  },
  mode: NotesCalendarDateMode
): NoteCalendarSpan | null {
  return mode === 'created' ? noteCreatedAllDaySpan(note.createdAt) : noteScheduledSpan(note)
}

/** Kalender-Anzeige nur bei expliziter Planung (Hauptkalender-Overlay). */
export function resolveNoteCalendarSpan(note: {
  scheduledStartIso: string | null
  scheduledEndIso: string | null
  scheduledAllDay: boolean
}): NoteCalendarSpan | null {
  return noteScheduledSpan(note)
}
