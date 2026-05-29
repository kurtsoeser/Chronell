/** Extrahiert einen Online-Meeting-Beitrittslink aus Mail-HTML oder -Text. */
export function extractMeetingJoinUrl(source: string | null | undefined): string | null {
  if (!source?.trim()) return null
  const text = source
  const patterns = [
    /https:\/\/teams\.microsoft\.com\/(?:meet|l\/meetup-join)\/[^\s"'<>]+/gi,
    /https:\/\/teams\.live\.com\/meet\/[^\s"'<>]+/gi,
    /https:\/\/[\w.-]+\.zoom\.us\/(?:j|my)\/[^\s"'<>]+/gi,
    /https:\/\/meet\.google\.com\/[^\s"'<>]+/gi,
    /https:\/\/[\w.-]+\.webex\.com\/[^\s"'<>]+/gi
  ]
  for (const re of patterns) {
    const m = text.match(re)
    if (m?.[0]) return sanitizeJoinUrl(m[0])
  }
  return null
}

function sanitizeJoinUrl(raw: string): string {
  return raw.replace(/[.,;:!?)>\]]+$/g, '').trim()
}
