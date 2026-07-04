import { formatUtcIsoAsLocalDateTime } from '@shared/calendar-datetime'
import { graphWindowsZoneToIana } from '@shared/microsoft-timezones'
import { zonedLocalDateTimeToUtcIso } from '@/lib/zoned-iso-date'

export function resolveDefaultEventTimeZone(calendarTzConfig: string | null | undefined): string {
  const configured = calendarTzConfig?.trim()
  if (configured && configured !== 'local') return configured
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

export function resolveRendererDisplayTimeZone(calendarTzConfig: string | null | undefined): string {
  return graphWindowsZoneToIana(resolveDefaultEventTimeZone(calendarTzConfig))
}

export function normalizeEventTimeZoneHint(hint: string | null | undefined): string | null {
  const raw = hint?.trim()
  if (!raw) return null
  if (raw.includes('/')) return raw
  return graphWindowsZoneToIana(raw)
}

export function parseEventDatetimeLocal(
  dtLocal: string
): { ymd: string; hour: number; minute: number } | null {
  const m = dtLocal.trim().match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/)
  if (!m) return null
  return { ymd: m[1]!, hour: Number(m[2]), minute: Number(m[3]) }
}

export function formatEventDatetimeLocal(ymd: string, hour: number, minute: number): string {
  return `${ymd}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

export function eventDatetimeLocalToMs(dtLocal: string, timeZone: string): number {
  const p = parseEventDatetimeLocal(dtLocal)
  if (!p) return Number.NaN
  return new Date(zonedLocalDateTimeToUtcIso(p.ymd, p.hour, p.minute, 0, timeZone)).getTime()
}

export function utcIsoToEventDatetimeLocal(utcIso: string, timeZone: string): string {
  const local = formatUtcIsoAsLocalDateTime(utcIso, timeZone)
  if (!local) return ''
  return local.slice(0, 16)
}

export function eventDatetimeLocalToUtcIso(
  dtLocal: string,
  timeZone: string,
  invalidMsg: string
): string {
  const p = parseEventDatetimeLocal(dtLocal)
  if (!p) throw new Error(invalidMsg)
  const iso = zonedLocalDateTimeToUtcIso(p.ymd, p.hour, p.minute, 0, timeZone)
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) throw new Error(invalidMsg)
  return d.toISOString()
}

export function convertEventDatetimeLocalBetweenZones(
  dtLocal: string,
  fromZone: string,
  toZone: string
): string {
  if (!dtLocal.trim() || fromZone === toZone) return dtLocal
  try {
    const utc = eventDatetimeLocalToUtcIso(dtLocal, fromZone, 'invalid')
    return utcIsoToEventDatetimeLocal(utc, toZone) || dtLocal
  } catch {
    return dtLocal
  }
}

export function addMinutesInEventZone(
  dtLocal: string,
  minutes: number,
  timeZone: string
): string {
  const ms = eventDatetimeLocalToMs(dtLocal, timeZone)
  if (Number.isNaN(ms)) return dtLocal
  return utcIsoToEventDatetimeLocal(new Date(ms + minutes * 60_000).toISOString(), timeZone)
}

export function mergeTimeIntoEventStart(dtStart: string, hhmm: string): string {
  const p = parseEventDatetimeLocal(dtStart)
  if (!p) return dtStart
  const [hh, mm] = hhmm.split(':').map(Number)
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return dtStart
  return formatEventDatetimeLocal(p.ymd, hh, mm)
}

export function mergeTimeIntoEventEnd(
  dtStart: string,
  dtEnd: string,
  hhmm: string,
  timeZone: string
): string {
  const p = parseEventDatetimeLocal(dtEnd)
  if (!p) return dtEnd
  const [hh, mm] = hhmm.split(':').map(Number)
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return dtEnd
  const next = formatEventDatetimeLocal(p.ymd, hh, mm)
  const startMs = eventDatetimeLocalToMs(dtStart, timeZone)
  const endMs = eventDatetimeLocalToMs(next, timeZone)
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) return next
  if (endMs <= startMs) {
    return addMinutesInEventZone(dtStart, 15, timeZone)
  }
  return next
}

export function mergeYmdIntoEventDatetimeLocal(dtLocal: string, ymd: string): string {
  const p = parseEventDatetimeLocal(dtLocal)
  if (!p) return dtLocal
  return formatEventDatetimeLocal(ymd, p.hour, p.minute)
}
