import type { Locale } from 'date-fns'
import { formatNoteMeetingEventRangeLabel } from '@shared/note-meeting-format'
import type { NoteMeetingInsertLabels } from '@shared/note-meeting-insert-html'
import { resolveNoteMeetingJoinUrl } from '@shared/note-meeting-insert-html'
import {
  extractNoteMeetingBlocksFromHtml,
  noteMeetingBlockKey,
  refreshNoteMeetingHeadersInHtml,
  type NoteMeetingHeaderRefreshInput
} from '@shared/note-meeting-sync'
import type { CalendarEventView, CalendarGetEventResult } from '@shared/types'

export function noteHtmlContainsEmbedUrl(html: string, url: string): boolean {
  const needle = url.trim()
  if (!needle || !html.trim()) return false
  if (html.includes(needle)) return true
  try {
    const normalized = new URL(needle).toString()
    return html.includes(normalized)
  } catch {
    return false
  }
}

function buildEventViewFromDetails(
  details: CalendarGetEventResult,
  fallback?: Pick<CalendarEventView, 'title' | 'startIso' | 'endIso' | 'isAllDay' | 'location' | 'organizer' | 'joinUrl' | 'webLink'>
): Pick<
  CalendarEventView,
  'title' | 'startIso' | 'endIso' | 'isAllDay' | 'location' | 'organizer' | 'joinUrl' | 'webLink'
> | null {
  const startIso = details.startIso ?? fallback?.startIso
  const endIso = details.endIso ?? fallback?.endIso
  if (!startIso || !endIso) return null
  return {
    title: details.subject?.trim() || fallback?.title || '—',
    startIso,
    endIso,
    isAllDay: details.isAllDay ?? fallback?.isAllDay ?? false,
    location: details.location ?? fallback?.location ?? null,
    organizer: details.organizer ?? fallback?.organizer ?? null,
    joinUrl: details.joinUrl ?? fallback?.joinUrl ?? null,
    webLink: details.webLink ?? fallback?.webLink ?? null
  }
}

export interface RefreshNoteMeetingDetailsResult {
  html: string
  updatedCount: number
  newEmbeds: string[]
}

export async function refreshNoteMeetingDetailsInHtml(
  html: string,
  labels: NoteMeetingInsertLabels,
  locale: Locale,
  allDaySuffix: string
): Promise<RefreshNoteMeetingDetailsResult> {
  const blocks = extractNoteMeetingBlocksFromHtml(html)
  if (blocks.length === 0) {
    return { html, updatedCount: 0, newEmbeds: [] }
  }

  const updates = new Map<string, NoteMeetingHeaderRefreshInput>()
  const newEmbeds: string[] = []

  for (const block of blocks) {
    let details: CalendarGetEventResult
    try {
      details = await window.mailClient.calendar.getEvent({
        accountId: block.accountId,
        graphEventId: block.graphEventId,
        graphCalendarId: block.graphCalendarId ?? null,
        forceRefresh: true
      })
    } catch {
      continue
    }

    const event = buildEventViewFromDetails(details)
    if (!event) continue

    const joinUrl = resolveNoteMeetingJoinUrl(event, details)
    const resolved = await window.mailClient.calendar.resolveMeetingRecording({
      accountId: block.accountId,
      joinUrl,
      bodyHtml: details.bodyHtml
    })

    for (const url of [resolved.recordingUrl, resolved.recapUrl]) {
      if (!url || noteHtmlContainsEmbedUrl(html, url) || newEmbeds.includes(url)) continue
      newEmbeds.push(url)
    }

    updates.set(noteMeetingBlockKey(block), {
      metadata: block,
      event,
      details,
      whenLabel: formatNoteMeetingEventRangeLabel(event, locale, allDaySuffix),
      labels,
      recapUrl: resolved.recapUrl,
      recordingLinkUrl: resolved.recordingUrl
    })
  }

  const { html: nextHtml, updatedCount } = refreshNoteMeetingHeadersInHtml(html, updates)
  return { html: nextHtml, updatedCount, newEmbeds }
}
