import { format, parseISO, set } from 'date-fns'

/** `HH:mm` normalisieren; ungültige Eingaben → `null`. */
export function normalizeHm(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const m = /^(\d{1,2}):(\d{2})$/.exec(trimmed)
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (!Number.isFinite(h) || !Number.isFinite(min)) return null
  if (h < 0 || h > 23 || min < 0 || min > 59) return null
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

export function quarterHourTimesForYmd(ymd: string): string[] {
  const base = parseISO(`${ymd}T12:00:00`)
  const out: string[] = []
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 15) {
      out.push(
        format(set(base, { hours: h, minutes: m, seconds: 0, milliseconds: 0 }), 'HH:mm')
      )
    }
  }
  return out
}

export function calendarTimeSelectOptions(ymd: string, currentHm: string): string[] {
  const base = quarterHourTimesForYmd(ymd)
  if (currentHm && !base.includes(currentHm)) {
    return [...base, currentHm].sort()
  }
  return base
}

export function mergeYmdIntoDate(base: Date, ymd: string): Date {
  const parsed = parseISO(`${ymd}T12:00:00`)
  if (Number.isNaN(parsed.getTime())) return base
  return set(base, {
    year: parsed.getFullYear(),
    month: parsed.getMonth(),
    date: parsed.getDate()
  })
}

export function mergeHmIntoDate(base: Date, hm: string): Date {
  const [hh, mm] = hm.split(':').map(Number)
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return base
  return set(base, { hours: hh, minutes: mm, seconds: 0, milliseconds: 0 })
}

export function addMinutesToDate(d: Date, minutes: number): Date {
  return new Date(d.getTime() + minutes * 60_000)
}

export function mergeHmIntoEndAfterStart(start: Date, end: Date, hm: string, minGapMin = 30): Date {
  const next = mergeHmIntoDate(end, hm)
  if (next.getTime() <= start.getTime()) {
    return addMinutesToDate(start, minGapMin)
  }
  return next
}
