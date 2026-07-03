import { findNoteEmbedInsertTarget } from './note-embed-insert'
import { isM365VideoShareUrl } from './note-m365-video-embed'
import { parseTeamsRecordingEmbedSrc } from './note-teams-recording-embed'
import { normalizeTeamsMeetingRecapUrl } from './note-teams-meeting-recap'

const RECORDING_URL_PATTERNS: RegExp[] = [
  /https?:\/\/(?:web\.)?microsoftstream\.com\/(?:embed\/)?video\/[0-9a-f-]{36}[^\s"'<>]*/gi,
  /https?:\/\/[^\s"'<>]*\.sharepoint\.com\/[^\s"'<>]*(?:embed\.aspx|stream\.aspx|Stream\.aspx)[^\s"'<>]*/gi,
  /https?:\/\/teams\.microsoft\.com\/l\/meetingrecap\?[^\s"'<>]*/gi,
  /https?:\/\/teams\.microsoft\.com\/v2\/[^\s"'<>#]*meetingrecap[^\s"'<>]*/gi,
  /https?:\/\/[^\s"'<>]*\.sharepoint\.com\/[^\s"'<>]*\/:v:\/[^\s"'<>]*/gi,
  /https?:\/\/1drv\.ms\/[^\s"'<>]+/gi
]

function sanitizeRecordingUrl(raw: string): string {
  return raw.replace(/[.,;:!?)>\]]+$/g, '').trim()
}

function isEmbeddableRecordingCandidate(url: string): boolean {
  return parseTeamsRecordingEmbedSrc(url) != null || isM365VideoShareUrl(url)
}

/** Alle Aufzeichnungs-Links aus Termin-HTML oder -Text extrahieren. */
export function extractMeetingRecordingUrls(source: string | null | undefined): string[] {
  if (!source?.trim()) return []

  const found = new Set<string>()

  for (const re of RECORDING_URL_PATTERNS) {
    re.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = re.exec(source)) !== null) {
      const url = sanitizeRecordingUrl(match[0] ?? '')
      if (url && isEmbeddableRecordingCandidate(url)) found.add(url)
    }
  }

  const hrefRe = /href=["']([^"']+)["']/gi
  let hrefMatch: RegExpExecArray | null
  while ((hrefMatch = hrefRe.exec(source)) !== null) {
    const url = sanitizeRecordingUrl(hrefMatch[1] ?? '')
    if (url && isEmbeddableRecordingCandidate(url)) found.add(url)
  }

  return [...found]
}

export function isMeetingRecapUrl(input: string): boolean {
  const raw = input.trim()
  if (!raw) return false
  try {
    const url = new URL(raw)
    const host = url.hostname.replace(/^www\./, '')
    return host === 'teams.microsoft.com' && url.pathname === '/l/meetingrecap'
  } catch {
    return false
  }
}

/** Teams-Meeting-Recap (Zusammenfassung + Aufzeichnung) aus Termin-HTML. */
export function extractMeetingRecapUrl(source: string | null | undefined): string | null {
  for (const url of extractMeetingRecordingUrls(source)) {
    if (!isMeetingRecapUrl(url) && !url.toLowerCase().includes('meetingrecap')) continue
    const normalized = normalizeTeamsMeetingRecapUrl(url) ?? url
    if (findNoteEmbedInsertTarget(normalized)) return normalized
  }

  if (!source?.trim()) return null
  const loose = /https?:\/\/[^\s"'<>]*meetingrecap[^\s"'<>]*/i.exec(source)
  if (loose?.[0]) {
    const normalized = normalizeTeamsMeetingRecapUrl(loose[0])
    if (normalized && findNoteEmbedInsertTarget(normalized)) return normalized
  }

  return null
}

/** Stream-/SharePoint-Aufzeichnung ohne Meeting-Recap. */
export function extractMeetingStreamRecordingUrl(source: string | null | undefined): string | null {
  for (const url of extractMeetingRecordingUrls(source)) {
    if (isMeetingRecapUrl(url)) continue
    if (findNoteEmbedInsertTarget(url)) return url
  }
  return null
}

/** Ersten einbettbaren Aufzeichnungs-Link aus Termin-HTML oder -Text liefern. */
export function extractMeetingRecordingUrl(source: string | null | undefined): string | null {
  return extractMeetingStreamRecordingUrl(source) ?? extractMeetingRecapUrl(source)
}
