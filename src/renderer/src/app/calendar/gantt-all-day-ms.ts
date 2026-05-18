import { parseISO } from 'date-fns'

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/

/** Kalenderdatum (YYYY-MM-DD) aus ISO – bei Datum+Uhrzeit in lokaler Zeitzone. */
export function isoToLocalDateOnly(iso: string): string | null {
  const t = iso.trim()
  if (!t) return null
  if (DATE_ONLY_RE.test(t)) return t
  const d = parseISO(t)
  if (Number.isNaN(d.getTime())) return null
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${mo}-${day}`
}

/** Lokaler Tagesbeginn (00:00) als Unix-ms. */
export function localDayStartMsFromIso(iso: string): number | null {
  const dateOnly = isoToLocalDateOnly(iso)
  if (!dateOnly) return null
  const [y, mo, d] = dateOnly.split('-').map(Number)
  if (!y || !mo || !d) return null
  return new Date(y, mo - 1, d).getTime()
}

/** Exklusives Ende (00:00 des Endtages) in lokaler Zeit. */
export function localDayEndMsExclusiveFromIso(endIso: string, fallbackStartMs: number): number {
  const ms = localDayStartMsFromIso(endIso)
  if (ms != null && ms > fallbackStartMs) return ms
  return fallbackStartMs + 24 * 60 * 60 * 1000
}

export function localDayStartMsFromDateOnly(dateOnly: string): number | null {
  return localDayStartMsFromIso(dateOnly)
}

export function addLocalCalendarDays(dateOnly: string, days: number): string {
  const start = localDayStartMsFromDateOnly(dateOnly)
  if (start == null) return dateOnly
  const d = new Date(start)
  d.setDate(d.getDate() + days)
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${mo}-${day}`
}
