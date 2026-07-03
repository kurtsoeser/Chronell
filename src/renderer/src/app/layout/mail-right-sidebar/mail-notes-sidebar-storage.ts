export const MAIL_NOTES_SIDEBAR_EDITOR_HEIGHT_KEY =
  'mailclient.mail.notesSidebarEditorHeight'

/** Standardhöhe Notiz-Editor über der Seitenliste (px). */
export const MAIL_NOTES_SIDEBAR_EDITOR_HEIGHT_DEFAULT = 240
export const MAIL_NOTES_SIDEBAR_EDITOR_HEIGHT_MIN = 120
export const MAIL_NOTES_SIDEBAR_EDITOR_HEIGHT_MAX = 640

export function mailNotesSidebarEditorHeightMax(): number {
  if (typeof window === 'undefined') return 480
  return Math.max(
    MAIL_NOTES_SIDEBAR_EDITOR_HEIGHT_MIN + 80,
    Math.min(
      MAIL_NOTES_SIDEBAR_EDITOR_HEIGHT_MAX,
      Math.round(window.innerHeight * 0.55)
    )
  )
}
