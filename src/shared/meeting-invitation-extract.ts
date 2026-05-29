/** Extrahiert den ersten VCALENDAR-Block aus MIME- oder Rohtext. */
export function extractIcsBlockFromText(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null
  const normalized = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const m = normalized.match(/BEGIN:VCALENDAR[\s\S]*?END:VCALENDAR/i)
  return m?.[0]?.trim() ?? null
}

function decodeQuotedPrintable(input: string): string {
  return input
    .replace(/=\r?\n/g, '')
    .replace(/=([0-9A-Fa-f]{2})/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)))
}

function decodeMimePartBody(body: string, headersBlock: string): string {
  const encoding = headersBlock.match(/Content-Transfer-Encoding:\s*([^\s;]+)/i)?.[1]?.toLowerCase()
  const trimmed = body.trim()
  if (encoding === 'base64') {
    try {
      return Buffer.from(trimmed.replace(/\s+/g, ''), 'base64').toString('utf8')
    } catch {
      return trimmed
    }
  }
  if (encoding === 'quoted-printable') {
    return decodeQuotedPrintable(trimmed)
  }
  return trimmed
}

/** Extrahiert ICS aus MIME-Rohtext (text/calendar-Parts, auch base64/quoted-printable). */
export function extractIcsFromMime(mime: string | null | undefined): string | null {
  if (!mime?.trim()) return null

  const direct = extractIcsBlockFromText(mime)
  if (direct) return direct

  const normalized = mime.replace(/\r\n/g, '\n')
  const partPattern =
    /Content-Type:\s*text\/calendar[^\n]*\n(?:(?:Content-[^\n]+\n)*)\n([\s\S]*?)(?=\n--[^\n]+|\nContent-Type:|\n$)/gi

  let match: RegExpExecArray | null
  while ((match = partPattern.exec(normalized)) !== null) {
    const headerStart = match.index
    const headersBlock = normalized.slice(headerStart, match.index + match[0].indexOf('\n\n') + 2)
    const body = decodeMimePartBody(match[1] ?? '', headersBlock)
    const block = extractIcsBlockFromText(body)
    if (block) return block
  }

  // Fallback: grob zwischen text/calendar und naechstem Boundary
  const rough = normalized.match(
    /Content-Type:\s*text\/calendar[\s\S]*?\n\n([\s\S]*?)(?:\n--|$)/i
  )
  if (rough?.[1]) {
    const headerBlock = rough[0].slice(0, rough[0].indexOf('\n\n') + 2)
    const body = decodeMimePartBody(rough[1], headerBlock)
    const block = extractIcsBlockFromText(body)
    if (block) return block
  }

  return null
}

/** Sucht eingebettetes ICS in HTML (selten, aber vorkommend). */
export function extractIcsFromHtml(html: string | null | undefined): string | null {
  if (!html?.trim()) return null
  return extractIcsBlockFromText(html)
}

/** Grobe Datums-/Zeit-Erkennung aus Meeting-Mailtext (Fallback). */
export function extractMeetingTimesFromText(
  text: string | null | undefined
): { startIso: string; endIso: string } | null {
  if (!text?.trim()) return null
  const flat = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')

  const patterns = [
    /(\d{1,2})\.(\d{1,2})\.(\d{4})[\s,]*(\d{1,2}):(\d{2})\s*[-–—]\s*(\d{1,2}):(\d{2})/,
    /(\d{1,2})\.(\d{1,2})\.(\d{4})\s+(\d{1,2}):(\d{2})\s*[-–—]\s*(\d{1,2}):(\d{2})/
  ]

  for (const re of patterns) {
    const m = flat.match(re)
    if (!m) continue
    const [, d, mo, y, h1, mi1, h2, mi2] = m
    const start = new Date(Number(y), Number(mo) - 1, Number(d), Number(h1), Number(mi1))
    const end = new Date(Number(y), Number(mo) - 1, Number(d), Number(h2), Number(mi2))
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end > start) {
      return { startIso: start.toISOString(), endIso: end.toISOString() }
    }
  }

  return null
}
