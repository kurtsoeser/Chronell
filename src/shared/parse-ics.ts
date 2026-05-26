/** Ein aus iCalendar (RFC 5545) geparster Termin fuer den Import-Dialog. */
export interface IcsParsedEvent {
  uid: string | null
  summary: string
  startIso: string
  endIso: string
  isAllDay: boolean
  location: string | null
  bodyHtml: string | null
  descriptionPlain: string | null
}

export interface ParseIcsResult {
  events: IcsParsedEvent[]
  warnings: string[]
}

/** Zeilen entfalten (RFC 5545: Fortsetzungszeilen beginnen mit Leerzeichen/Tab). */
export function unfoldIcsLines(text: string): string[] {
  const raw = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  const out: string[] = []
  for (const line of raw) {
    if ((line.startsWith(' ') || line.startsWith('\t')) && out.length > 0) {
      out[out.length - 1] += line.slice(1)
    } else {
      out.push(line)
    }
  }
  return out
}

function decodeIcsText(value: string): string {
  let s = value
  s = s.replace(/\\n/gi, '\n').replace(/\\N/g, '\n')
  s = s.replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\')
  return s
}

function parsePropertyLine(line: string): { name: string; params: Record<string, string>; value: string } | null {
  const colon = line.indexOf(':')
  if (colon < 0) return null
  const head = line.slice(0, colon)
  const value = line.slice(colon + 1)
  const semi = head.indexOf(';')
  const name = (semi >= 0 ? head.slice(0, semi) : head).trim().toUpperCase()
  const params: Record<string, string> = {}
  if (semi >= 0) {
    for (const part of head.slice(semi + 1).split(';')) {
      const eq = part.indexOf('=')
      if (eq < 0) continue
      const k = part.slice(0, eq).trim().toUpperCase()
      let v = part.slice(eq + 1).trim()
      if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1)
      params[k] = v
    }
  }
  return { name, params, value }
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/** DATE (YYYYMMDD) oder DATE-TIME → ISO bzw. YYYY-MM-DD (Ganztag). */
export function parseIcsDateValue(
  raw: string,
  params: Record<string, string>
): { iso: string; isAllDay: boolean } {
  const value = raw.trim()
  const valueType = (params['VALUE'] ?? '').toUpperCase()
  const isDateOnly = valueType === 'DATE' || /^\d{8}$/.test(value)

  if (isDateOnly) {
    const digits = value.replace(/[^0-9]/g, '').slice(0, 8)
    if (digits.length !== 8) throw new Error(`Ungueltiges ICS-Datum: ${raw}`)
    const y = digits.slice(0, 4)
    const m = digits.slice(4, 6)
    const d = digits.slice(6, 8)
    return { iso: `${y}-${m}-${d}`, isAllDay: true }
  }

  const m = value.match(
    /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/i
  )
  if (!m) throw new Error(`Ungueltiges ICS-Datum/Zeit: ${raw}`)
  const [, y, mo, da, h, mi, s, z] = m
  if (z) {
    const dt = new Date(
      `${y}-${mo}-${da}T${h}:${mi}:${s}Z`
    )
    if (Number.isNaN(dt.getTime())) throw new Error(`Ungueltiges ICS-Datum/Zeit: ${raw}`)
    return { iso: dt.toISOString(), isAllDay: false }
  }
  const local = new Date(
    Number(y),
    Number(mo) - 1,
    Number(da),
    Number(h),
    Number(mi),
    Number(s)
  )
  if (Number.isNaN(local.getTime())) throw new Error(`Ungueltiges ICS-Datum/Zeit: ${raw}`)
  return { iso: local.toISOString(), isAllDay: false }
}

function allDayEndExclusive(startYmd: string, endRaw: string, endParams: Record<string, string>): string {
  if (!endRaw.trim()) {
    const [y, m, d] = startYmd.split('-').map(Number)
    const next = new Date(y!, m! - 1, d! + 1)
    return `${next.getFullYear()}-${pad2(next.getMonth() + 1)}-${pad2(next.getDate())}`
  }
  const end = parseIcsDateValue(endRaw, endParams)
  if (!end.isAllDay) return end.iso.slice(0, 10)
  return end.iso
}

function parseVeventBlock(lines: string[]): IcsParsedEvent | null {
  const props = new Map<string, Array<{ params: Record<string, string>; value: string }>>()
  for (const line of lines) {
    if (!line.trim() || line.startsWith('BEGIN:') || line.startsWith('END:')) continue
    const p = parsePropertyLine(line)
    if (!p) continue
    const list = props.get(p.name) ?? []
    list.push({ params: p.params, value: p.value })
    props.set(p.name, list)
  }

  const first = (name: string): { params: Record<string, string>; value: string } | undefined =>
    props.get(name)?.[0]

  const dtStart = first('DTSTART')
  if (!dtStart) return null

  let startIso: string
  let endIso: string
  let isAllDay: boolean
  try {
    const start = parseIcsDateValue(dtStart.value, dtStart.params)
    startIso = start.iso
    isAllDay = start.isAllDay
    const dtEnd = first('DTEND')
    const duration = first('DURATION')
    if (isAllDay) {
      endIso = allDayEndExclusive(startIso, dtEnd?.value ?? '', dtEnd?.params ?? {})
    } else if (dtEnd) {
      const end = parseIcsDateValue(dtEnd.value, dtEnd.params)
      endIso = end.iso
    } else if (duration?.value.trim()) {
      const startMs = new Date(startIso).getTime()
      const durMs = parseIcsDurationMs(duration.value)
      endIso = new Date(startMs + durMs).toISOString()
    } else {
      endIso = new Date(new Date(startIso).getTime() + 60 * 60 * 1000).toISOString()
    }
  } catch {
    return null
  }

  const summary = decodeIcsText(first('SUMMARY')?.value ?? '').trim() || 'Termin'
  const location = decodeIcsText(first('LOCATION')?.value ?? '').trim() || null
  const uid = first('UID')?.value?.trim() || null

  const altDesc = props.get('X-ALT-DESC')?.find(
    (p) => (p.params['FMTTYPE'] ?? '').toLowerCase().includes('html')
  )
  const desc = first('DESCRIPTION')
  const descriptionPlain = desc ? decodeIcsText(desc.value).trim() || null : null
  let bodyHtml: string | null = null
  if (altDesc?.value.trim()) {
    bodyHtml = decodeIcsText(altDesc.value).trim() || null
  } else if (descriptionPlain) {
    bodyHtml = descriptionPlain.includes('<')
      ? descriptionPlain
      : `<p>${escapeHtml(descriptionPlain).replace(/\n/g, '<br>')}</p>`
  }

  return {
    uid,
    summary,
    startIso,
    endIso,
    isAllDay,
    location,
    bodyHtml,
    descriptionPlain
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** ISO-8601-Dauer (z. B. PT1H30M) grob in Millisekunden. */
function parseIcsDurationMs(raw: string): number {
  const v = raw.trim().toUpperCase()
  if (!v.startsWith('P')) return 60 * 60 * 1000
  let ms = 0
  const week = v.match(/(\d+)W/)
  if (week) ms += Number(week[1]) * 7 * 24 * 60 * 60 * 1000
  const day = v.match(/(\d+)D/)
  if (day) ms += Number(day[1]) * 24 * 60 * 60 * 1000
  const hour = v.match(/(\d+)H/)
  if (hour) ms += Number(hour[1]) * 60 * 60 * 1000
  const min = v.match(/(\d+)M/)
  if (min) ms += Number(min[1]) * 60 * 1000
  const sec = v.match(/(\d+)S/)
  if (sec) ms += Number(sec[1]) * 1000
  return ms > 0 ? ms : 60 * 60 * 1000
}

/** Parst iCalendar-Text (.ics) und liefert alle VEVENT-Eintraege. */
export function parseIcsCalendarText(text: string): ParseIcsResult {
  const warnings: string[] = []
  const lines = unfoldIcsLines(text)
  const events: IcsParsedEvent[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]!.trim()
    if (line.toUpperCase() === 'BEGIN:VEVENT') {
      const block: string[] = []
      i++
      while (i < lines.length && lines[i]!.trim().toUpperCase() !== 'END:VEVENT') {
        block.push(lines[i]!)
        i++
      }
      const ev = parseVeventBlock(block)
      if (ev) events.push(ev)
      else warnings.push('Ein VEVENT konnte nicht gelesen werden (fehlende oder ungueltige Zeiten).')
    }
    i++
  }
  if (events.length === 0 && lines.some((l) => l.trim().toUpperCase().includes('VEVENT'))) {
    warnings.push('Keine gueltigen Termine in der Datei gefunden.')
  }
  return { events, warnings }
}
