import { replaceInlineCidImages } from '@/lib/sanitize'
import { sanitizeComposeHtmlFragment } from '@/lib/sanitize-compose-html'
import { isChronellWebinarInvitationHtml } from '@shared/chronell-webinar-calendar'
import { restoreWebinarTeamsSlotForEditor } from '@/lib/restore-webinar-invitation-for-editor'
import { sanitizeWebinarInvitationHtml } from '@/lib/sanitize-webinar-invitation-html'
import {
  cleanTeamsMeetingJoinInformationHtml,
  lightenEmbeddedTeamsMeetingBlobInWebinarHtml
} from '@shared/calendar-event-body-html'

function sanitizeCalendarEventBodyForEditor(html: string): string {
  if (isChronellWebinarInvitationHtml(html)) {
    return sanitizeWebinarInvitationHtml(html)
  }
  return sanitizeComposeHtmlFragment(html)
}

/**
 * Laedt Microsoft-Inline-Anhaenge und ersetzt `cid:` im Termin-HTML durch Data-URIs,
 * danach passendes Sanitize (Webinar-HTML vs. Compose-Fliesstext).
 */
export async function prepareCalendarEventBodyHtmlForEditor(
  rawHtml: string,
  opts?: {
    accountId?: string | null
    graphEventId?: string | null
    graphCalendarId?: string | null
    /** Microsoft: Inline-Bilder nachladen. Google/ohne IDs: uebersprungen. */
    resolveInlineImages?: boolean
    /** Teams-Join fuer geschuetzten Editor-Slot nach Blob-Strip. */
    teamsJoinUrl?: string | null
    /** false = TN-Ansicht (Teams-Blob behalten, kein Editor-Slot). */
    forEditor?: boolean
  }
): Promise<string> {
  const trimmed = rawHtml.trim()
  if (!trimmed) return ''

  // Teams-Clean nur bei normalem Fliesstext — nie auf Webinar-HTML (zerstoert Hero-<img style=…>).
  let html = trimmed
  if (
    !isChronellWebinarInvitationHtml(trimmed) &&
    /asyncgw\.teams\.microsoft\.com|amsauth=/i.test(trimmed)
  ) {
    html = cleanTeamsMeetingJoinInformationHtml(trimmed)
  }
  if (!html.trim()) return ''

  const accountId = opts?.accountId?.trim()
  const graphEventId = opts?.graphEventId?.trim()
  const resolve = opts?.resolveInlineImages !== false
  if (resolve && accountId && graphEventId && /cid:/i.test(html)) {
    html = await resolveCalendarEventInlineCidImages(html, {
      accountId,
      graphEventId,
      graphCalendarId: opts?.graphCalendarId ?? null
    })
  }
  const forEditor = opts?.forEditor !== false
  if (forEditor && isChronellWebinarInvitationHtml(html)) {
    html = restoreWebinarTeamsSlotForEditor(html, opts?.teamsJoinUrl)
  }
  return sanitizeCalendarEventBodyForEditor(html)
}

/** Termin-Vorschau / TN-Ansicht — Graph-Body inkl. lesbarem Teams-Blob auf dunklem Panel. */
export async function prepareCalendarEventBodyHtmlForAttendeeDisplay(
  rawHtml: string,
  opts?: {
    accountId?: string | null
    graphEventId?: string | null
    graphCalendarId?: string | null
    resolveInlineImages?: boolean
  }
): Promise<string> {
  const prepared = await prepareCalendarEventBodyHtmlForEditor(rawHtml, {
    ...opts,
    forEditor: false,
    teamsJoinUrl: null
  })
  return lightenEmbeddedTeamsMeetingBlobInWebinarHtml(prepared)
}

/** Ersetzt `cid:`-Bilder in bestehendem Editor-HTML (lazy nach dem ersten Paint). */
export async function resolveCalendarEventInlineCidImages(
  html: string,
  opts: {
    accountId: string
    graphEventId: string
    graphCalendarId?: string | null
  }
): Promise<string> {
  if (!/cid:/i.test(html)) return html
  try {
    const map = await window.mailClient.calendar.fetchEventInlineImages({
      accountId: opts.accountId,
      graphEventId: opts.graphEventId,
      graphCalendarId: opts.graphCalendarId ?? null
    })
    if (Object.keys(map).length === 0) return html
    return sanitizeCalendarEventBodyForEditor(replaceInlineCidImages(html, map))
  } catch (e) {
    console.warn('[calendar] fetchEventInlineImages:', e)
    return html
  }
}
