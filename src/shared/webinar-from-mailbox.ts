/** Standard-Absender / Organizer für Chronell-Webinar-Einladungen. */
export const DEFAULT_WEBINAR_FROM_MAILBOX = 'events@kurtrocks.com'

export function normalizeWebinarFromMailbox(raw: string | null | undefined): string {
  const v = String(raw || '')
    .trim()
    .toLowerCase()
  if (!v || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
    return DEFAULT_WEBINAR_FROM_MAILBOX
  }
  return v
}
