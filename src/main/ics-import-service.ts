import { readFile } from 'node:fs/promises'
import { basename } from 'node:path'
import { parseIcsCalendarText, type IcsParsedEvent } from '@shared/parse-ics'
import type { CalendarParseIcsFileResult } from '@shared/types'

export async function parseIcsFileAtPath(filePath: string): Promise<CalendarParseIcsFileResult> {
  const buf = await readFile(filePath, 'utf8')
  const { events, warnings } = parseIcsCalendarText(buf)
  return {
    filePath,
    fileName: basename(filePath),
    events: events.map(toPreview),
    warnings
  }
}

function toPreview(ev: IcsParsedEvent): CalendarParseIcsFileResult['events'][number] {
  return {
    uid: ev.uid,
    summary: ev.summary,
    startIso: ev.startIso,
    endIso: ev.endIso,
    isAllDay: ev.isAllDay,
    location: ev.location,
    bodyHtml: ev.bodyHtml,
    descriptionPlain: ev.descriptionPlain
  }
}
