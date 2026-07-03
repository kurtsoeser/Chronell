import {
  NOTE_MEETING_ACCOUNT_ID_ATTR,
  NOTE_MEETING_BLOCK_ATTR,
  NOTE_MEETING_GRAPH_CALENDAR_ID_ATTR,
  NOTE_MEETING_GRAPH_EVENT_ID_ATTR,
  NOTE_MEETING_HEADER_ATTR,
  buildNoteMeetingHeaderHtml,
  type NoteMeetingBlockMetadata,
  type NoteMeetingInsertLabels
} from './note-meeting-insert-html'
import type { CalendarEventView, CalendarGetEventResult } from './types'

export interface NoteMeetingBlockRef extends NoteMeetingBlockMetadata {
  headerHtml: string
}

function parseMeetingBlockMetadata(el: Element): NoteMeetingBlockMetadata | null {
  const accountId = el.getAttribute(NOTE_MEETING_ACCOUNT_ID_ATTR)?.trim()
  const graphEventId = el.getAttribute(NOTE_MEETING_GRAPH_EVENT_ID_ATTR)?.trim()
  if (!accountId || !graphEventId) return null
  const graphCalendarId = el.getAttribute(NOTE_MEETING_GRAPH_CALENDAR_ID_ATTR)?.trim() || null
  return { accountId, graphEventId, graphCalendarId }
}

export function extractNoteMeetingBlocksFromHtml(html: string): NoteMeetingBlockRef[] {
  if (!html.trim()) return []
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const blocks = Array.from(doc.querySelectorAll(`[${NOTE_MEETING_BLOCK_ATTR}]`))
  const out: NoteMeetingBlockRef[] = []
  for (const block of blocks) {
    const metadata = parseMeetingBlockMetadata(block)
    if (!metadata) continue
    const header = block.querySelector(`[${NOTE_MEETING_HEADER_ATTR}]`)
    out.push({
      ...metadata,
      headerHtml: header?.innerHTML ?? ''
    })
  }
  return out
}

export function noteHtmlHasMeetingBlocks(html: string): boolean {
  return extractNoteMeetingBlocksFromHtml(html).length > 0
}

export interface NoteMeetingHeaderRefreshInput {
  metadata: NoteMeetingBlockMetadata
  event: Pick<
    CalendarEventView,
    'title' | 'startIso' | 'endIso' | 'isAllDay' | 'location' | 'organizer' | 'joinUrl' | 'webLink'
  >
  details?: Pick<
    CalendarGetEventResult,
    'attendeeEmails' | 'joinUrl' | 'location' | 'organizer' | 'bodyHtml' | 'isOnlineMeeting'
  > | null
  whenLabel: string
  labels: NoteMeetingInsertLabels
  recapUrl?: string | null
  recordingLinkUrl?: string | null
}

export function refreshNoteMeetingHeadersInHtml(
  html: string,
  updates: Map<string, NoteMeetingHeaderRefreshInput>
): { html: string; updatedCount: number } {
  if (!html.trim() || updates.size === 0) return { html, updatedCount: 0 }
  const doc = new DOMParser().parseFromString(html, 'text/html')
  let updatedCount = 0

  for (const block of Array.from(doc.querySelectorAll(`[${NOTE_MEETING_BLOCK_ATTR}]`))) {
    const metadata = parseMeetingBlockMetadata(block)
    if (!metadata) continue
    const key = `${metadata.accountId}:${metadata.graphEventId}`
    const update = updates.get(key)
    if (!update) continue

    let header = block.querySelector(`[${NOTE_MEETING_HEADER_ATTR}]`)
    if (!header) {
      header = doc.createElement('div')
      header.setAttribute(NOTE_MEETING_HEADER_ATTR, 'true')
      block.insertBefore(header, block.firstChild)
    }

    const nextHeader = buildNoteMeetingHeaderHtml({
      event: update.event,
      details: update.details,
      whenLabel: update.whenLabel,
      labels: update.labels,
      recapUrl: update.recapUrl,
      recordingLinkUrl: update.recordingLinkUrl
    })
    if (header.innerHTML !== nextHeader) {
      header.innerHTML = nextHeader
      updatedCount += 1
    }
  }

  if (updatedCount === 0) return { html, updatedCount: 0 }
  return { html: doc.body.innerHTML, updatedCount }
}

export function noteMeetingBlockKey(metadata: NoteMeetingBlockMetadata): string {
  return `${metadata.accountId}:${metadata.graphEventId}`
}
