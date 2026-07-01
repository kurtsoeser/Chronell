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

const DEFAULT_MEETING_DURATION_MIN = 60

const MONTH_NAMES: Record<string, number> = {
  // Deutsch
  januar: 1, jan: 1,
  februar: 2, feb: 2,
  'märz': 3, maerz: 3, mrz: 3, 'mär': 3, maer: 3,
  april: 4, apr: 4,
  mai: 5,
  juni: 6, jun: 6,
  juli: 7, jul: 7,
  august: 8, aug: 8,
  september: 9, sept: 9, sep: 9,
  oktober: 10, okt: 10,
  november: 11, nov: 11,
  dezember: 12, dez: 12,
  // Englisch
  january: 1,
  february: 2,
  march: 3, mar: 3,
  may: 5,
  june: 6,
  july: 7,
  october: 10, oct: 10,
  december: 12, dec: 12
}

function monthFromName(name: string): number | null {
  return MONTH_NAMES[name.trim().toLowerCase()] ?? null
}

function buildTimeResult(
  y: number,
  mo: number,
  d: number,
  h1: number,
  mi1: number,
  h2: number | null,
  mi2: number | null
): { startIso: string; endIso: string } | null {
  if (h1 > 23 || mi1 > 59 || mo < 1 || mo > 12 || d < 1 || d > 31) return null
  const start = new Date(y, mo - 1, d, h1, mi1)
  if (Number.isNaN(start.getTime())) return null
  let end: Date
  if (h2 != null && mi2 != null && h2 <= 23 && mi2 <= 59) {
    end = new Date(y, mo - 1, d, h2, mi2)
    // Endzeit vor/gleich Startzeit -> entweder über Mitternacht oder fehlerhaft: Standarddauer ansetzen
    if (end <= start) end = new Date(start.getTime() + DEFAULT_MEETING_DURATION_MIN * 60_000)
  } else {
    end = new Date(start.getTime() + DEFAULT_MEETING_DURATION_MIN * 60_000)
  }
  return { startIso: start.toISOString(), endIso: end.toISOString() }
}

/** Findet das erste Datum (numerisch, ISO oder mit Monatsnamen) im Text. */
function findDate(flat: string): { y: number; mo: number; d: number } | null {
  // ISO: 2026-06-29
  const iso = flat.match(/(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (iso) {
    const y = Number(iso[1])
    const mo = Number(iso[2])
    const d = Number(iso[3])
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) return { y, mo, d }
  }

  // Numerisch deutsch: 29.06.2026 (Jahr optional)
  const numeric = flat.match(/(\d{1,2})\.(\d{1,2})\.(\d{2,4})/)
  if (numeric) {
    const d = Number(numeric[1])
    const mo = Number(numeric[2])
    let y = Number(numeric[3])
    if (y < 100) y += 2000
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) return { y, mo, d }
  }

  // Mit Monatsnamen, Tag zuerst: "29. Juni 2026" / "29 June 2026"
  const dayFirst = flat.match(/(\d{1,2})\.?\s+([A-Za-zÄÖÜäöüé]+)\.?\s+(\d{4})/)
  if (dayFirst) {
    const mo = monthFromName(dayFirst[2])
    if (mo) {
      const d = Number(dayFirst[1])
      const y = Number(dayFirst[3])
      if (d >= 1 && d <= 31) return { y, mo, d }
    }
  }

  // Mit Monatsnamen, Monat zuerst: "June 29, 2026" / "Juni 29 2026"
  const monthFirst = flat.match(/([A-Za-zÄÖÜäöüé]+)\.?\s+(\d{1,2}),?\s+(\d{4})/)
  if (monthFirst) {
    const mo = monthFromName(monthFirst[1])
    if (mo) {
      const d = Number(monthFirst[2])
      const y = Number(monthFirst[3])
      if (d >= 1 && d <= 31) return { y, mo, d }
    }
  }

  return null
}

const TIME_SEP = '(?:-|–|—|‐|‑|bis|to|until)'

function validTime(h: number, mi: number): boolean {
  return h >= 0 && h <= 23 && mi >= 0 && mi <= 59
}

/** Findet eine Zeitspanne ("13:00 - 14:00") oder eine einzelne Startzeit ("13:00 Uhr"). */
function findTime(flat: string): { h1: number; mi1: number; h2: number | null; mi2: number | null } | null {
  // 1) Zeitspanne mit ":" (zuverlässigste Form), "Uhr" optional
  const colonRange = new RegExp(
    `(\\d{1,2}):(\\d{2})\\s*(?:Uhr\\s*)?${TIME_SEP}\\s*(\\d{1,2}):(\\d{2})`,
    'gi'
  )
  for (const m of flat.matchAll(colonRange)) {
    const h1 = Number(m[1]), mi1 = Number(m[2]), h2 = Number(m[3]), mi2 = Number(m[4])
    if (validTime(h1, mi1) && validTime(h2, mi2)) return { h1, mi1, h2, mi2 }
  }

  // 2) Zeitspanne mit "." nur wenn "Uhr" beteiligt ist (sonst Verwechslung mit Datum)
  const dotRange = new RegExp(
    `(\\d{1,2})\\.(\\d{2})\\s*(?:Uhr\\s*)?${TIME_SEP}\\s*(\\d{1,2})\\.(\\d{2})\\s*Uhr`,
    'gi'
  )
  for (const m of flat.matchAll(dotRange)) {
    const h1 = Number(m[1]), mi1 = Number(m[2]), h2 = Number(m[3]), mi2 = Number(m[4])
    if (validTime(h1, mi1) && validTime(h2, mi2)) return { h1, mi1, h2, mi2 }
  }

  // 3) Einzelne Startzeit mit ":" (Standarddauer wird angesetzt)
  for (const m of flat.matchAll(/(\d{1,2}):(\d{2})/g)) {
    const h1 = Number(m[1]), mi1 = Number(m[2])
    if (validTime(h1, mi1)) return { h1, mi1, h2: null, mi2: null }
  }

  // 4) Einzelne Startzeit mit "." nur mit "Uhr" (z. B. "13.00 Uhr")
  for (const m of flat.matchAll(/(\d{1,2})\.(\d{2})\s*Uhr/gi)) {
    const h1 = Number(m[1]), mi1 = Number(m[2])
    if (validTime(h1, mi1)) return { h1, mi1, h2: null, mi2: null }
  }

  return null
}

/** Grobe Datums-/Zeit-Erkennung aus Meeting-Mailtext (Fallback). */
export function extractMeetingTimesFromText(
  text: string | null | undefined
): { startIso: string; endIso: string } | null {
  if (!text?.trim()) return null
  const flat = text.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ')

  const date = findDate(flat)
  if (!date) return null

  const time = findTime(flat)
  if (!time) return null

  return buildTimeResult(date.y, date.mo, date.d, time.h1, time.mi1, time.h2, time.mi2)
}
