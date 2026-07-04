export type NoteScheduleDraft = {
  scheduledStartIso: string | null
  scheduledEndIso: string | null
  scheduledAllDay: boolean
  clearSchedule?: boolean
}

export type UserNoteScheduleFieldsForSave = {
  scheduledStartIso?: string | null
  scheduledEndIso?: string | null
  scheduledAllDay?: boolean
  clearSchedule?: boolean
}

export const NOTES_DETAIL_WIDTH_KEY = 'mailclient.notesShell.detailWidth'
export const NOTES_NAV_WIDTH_KEY = 'mailclient.notesShell.navWidth.v2'
export const NOTES_PREVIEW_DOCK_WIDTH_KEY = 'mailclient.notesShell.previewDockWidth'
export const NOTES_CALENDAR_PREVIEW_WIDTH_KEY = 'mailclient.notesShell.calendarPreviewWidth'
export const NOTES_CALENDAR_EDITOR_HEIGHT_KEY = 'mailclient.notesShell.calendarEditorHeight'
export const NOTES_CALENDAR_EDITOR_HEIGHT_DEFAULT = 480
export const NOTES_CALENDAR_EDITOR_HEIGHT_MIN = 200
export const NOTES_CALENDAR_EDITOR_HEIGHT_MAX = 960

export function notesCalendarEditorHeightMax(): number {
  if (typeof window === 'undefined') return 720
  return Math.max(
    NOTES_CALENDAR_EDITOR_HEIGHT_MIN + 80,
    Math.min(
      NOTES_CALENDAR_EDITOR_HEIGHT_MAX,
      Math.round(window.innerHeight * 0.72)
    )
  )
}
