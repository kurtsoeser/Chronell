export const CALENDAR_PREVIEW_NOTE_PANE_HEIGHT_KEY =
  'mailclient.calendar.previewNotePaneHeight'

/** Standardhöhe Notiz/Kontext unter Termin-Details (px). */
export const CALENDAR_PREVIEW_NOTE_PANE_HEIGHT_DEFAULT = 380
export const CALENDAR_PREVIEW_NOTE_PANE_HEIGHT_MIN = 160
export const CALENDAR_PREVIEW_NOTE_PANE_HEIGHT_MAX = 960

export function calendarPreviewNotePaneHeightMax(): number {
  if (typeof window === 'undefined') return 720
  return Math.max(
    CALENDAR_PREVIEW_NOTE_PANE_HEIGHT_MIN + 80,
    Math.min(
      CALENDAR_PREVIEW_NOTE_PANE_HEIGHT_MAX,
      Math.round(window.innerHeight * 0.78)
    )
  )
}
