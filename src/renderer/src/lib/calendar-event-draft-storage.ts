/** Verzögerung nach der letzten Änderung, bis der Termin-Entwurf lokal gespeichert wird. */
export const CALENDAR_EVENT_AUTO_SAVE_DELAY_MS = 1_500

const STORAGE_KEY = 'mailclient:calendar-event-drafts-v1'

export type CalendarEventDraftCreateKind = 'event' | 'task'

export type CalendarEventDraftRecurFreq =
  | 'none'
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'yearly'

export type CalendarEventDraftRecurEnd = 'never' | 'until' | 'count'

export type CalendarEventDraftWeekday =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday'

/** Serialisierbarer Formular-Entwurf für den Termin-/Aufgaben-Dialog. */
export type CalendarEventFormDraft = {
  v: 1
  key: string
  updatedAt: number
  createKind: CalendarEventDraftCreateKind
  accountId: string
  graphCalendarId: string
  subject: string
  eventIconId?: string
  location: string
  descriptionHtml: string
  isAllDay: boolean
  dayStart: string
  dayEnd: string
  dtStart: string
  dtEnd: string
  eventTimeZone: string
  secondaryTimeZone: string
  eventCategories: string[]
  reminderEnabled: boolean
  reminderMinutesBefore: number
  teamsMeeting: boolean
  attendeeInput: string
  recurFreq: CalendarEventDraftRecurFreq
  recurEnd: CalendarEventDraftRecurEnd
  recurUntilDate: string
  recurCount: string
  recurWeekdays: CalendarEventDraftWeekday[]
  taskAccountId: string
  taskListId: string
  taskNotes: string
  taskDue: string
  taskPlannedStart: string
  taskPlannedEnd: string
}

type DraftMap = Record<string, CalendarEventFormDraft>

function isEffectivelyEmptyEditorHtml(html: string): boolean {
  const t = html.replace(/<[^>]+>/gi, '').replace(/\u00a0/g, ' ').trim()
  return t.length === 0
}

export function calendarEventDraftKey(input: {
  mode: 'create' | 'edit'
  createKind?: CalendarEventDraftCreateKind
  accountId?: string
  graphEventId?: string | null
  eventId?: string | null
}): string | null {
  if (input.mode === 'create') {
    return `create:${input.createKind === 'task' ? 'task' : 'event'}`
  }
  const gid = input.graphEventId?.trim()
  if (gid && input.accountId?.trim()) {
    return `edit:${input.accountId.trim()}:${gid}`
  }
  const id = input.eventId?.trim()
  if (id) return `edit:local:${id}`
  return null
}

export function calendarEventDraftFingerprint(
  draft: Omit<CalendarEventFormDraft, 'updatedAt'>
): string {
  const { key: _key, v: _v, ...rest } = draft
  return JSON.stringify(rest)
}

export function hasCalendarEventDraftContent(
  draft: Pick<
    CalendarEventFormDraft,
    | 'subject'
    | 'location'
    | 'descriptionHtml'
    | 'attendeeInput'
    | 'teamsMeeting'
    | 'eventCategories'
    | 'eventIconId'
    | 'taskNotes'
    | 'recurFreq'
  >
): boolean {
  const descriptionHtml = typeof draft.descriptionHtml === 'string' ? draft.descriptionHtml : ''
  const hasBody =
    Boolean(descriptionHtml.trim()) && !isEffectivelyEmptyEditorHtml(descriptionHtml)
  return Boolean(
    (typeof draft.subject === 'string' && draft.subject.trim()) ||
      (typeof draft.location === 'string' && draft.location.trim()) ||
      hasBody ||
      (typeof draft.attendeeInput === 'string' && draft.attendeeInput.trim()) ||
      draft.teamsMeeting ||
      (draft.eventCategories?.length ?? 0) > 0 ||
      (typeof draft.eventIconId === 'string' && draft.eventIconId.trim()) ||
      (typeof draft.taskNotes === 'string' && draft.taskNotes.trim()) ||
      (draft.recurFreq && draft.recurFreq !== 'none')
  )
}

function readDraftMap(): DraftMap {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const out: DraftMap = {}
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (!v || typeof v !== 'object' || Array.isArray(v)) continue
      const d = v as Partial<CalendarEventFormDraft>
      if (d.v !== 1 || typeof d.key !== 'string') continue
      out[k] = d as CalendarEventFormDraft
    }
    return out
  } catch {
    return {}
  }
}

function writeDraftMap(map: DraftMap): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
  } catch {
    // ignore quota / private mode
  }
}

export function readCalendarEventDraft(key: string): CalendarEventFormDraft | null {
  const map = readDraftMap()
  return map[key] ?? null
}

export function writeCalendarEventDraft(
  draft: Omit<CalendarEventFormDraft, 'updatedAt'> & { updatedAt?: number }
): void {
  const map = readDraftMap()
  map[draft.key] = {
    ...draft,
    v: 1,
    updatedAt: draft.updatedAt ?? Date.now()
  }
  writeDraftMap(map)
}

export function clearCalendarEventDraft(key: string): void {
  const map = readDraftMap()
  if (!(key in map)) return
  delete map[key]
  writeDraftMap(map)
}
