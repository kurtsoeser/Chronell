export const MAIL_READING_CONTEXT_HEIGHT_KEY = 'mailclient.mail.readingContextHeight'

/** Standardhöhe Notiz/Kontext unter der Mail (px). */
export const MAIL_READING_CONTEXT_HEIGHT_DEFAULT = 300
export const MAIL_READING_CONTEXT_HEIGHT_MIN = 96
export const MAIL_READING_CONTEXT_HEIGHT_MAX = 720

export function mailReadingContextHeightMax(): number {
  if (typeof window === 'undefined') return 480
  return Math.max(
    MAIL_READING_CONTEXT_HEIGHT_MIN + 40,
    Math.min(
      MAIL_READING_CONTEXT_HEIGHT_MAX,
      Math.round(window.innerHeight * 0.65)
    )
  )
}
