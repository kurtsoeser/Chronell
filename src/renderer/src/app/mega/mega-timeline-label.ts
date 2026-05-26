import { format, parseISO } from 'date-fns'
import { de, enUS } from 'date-fns/locale'
import type { WorkItem } from '@shared/work-item'
import { workItemEffectiveSortIso } from '@/app/work-items/work-item-bucket'

export type MegaItemTimeDisplay =
  | { variant: 'empty' }
  | { variant: 'label'; text: string }
  | { variant: 'range'; start: string; end: string }

function dateFnsLocale(localeCode: string) {
  return localeCode.startsWith('de') ? de : enUS
}

function formatHm(iso: string, localeCode: string): string | null {
  try {
    const d = parseISO(iso)
    if (Number.isNaN(d.getTime())) return null
    return format(d, 'HH:mm', { locale: dateFnsLocale(localeCode) })
  } catch {
    return null
  }
}

function formatRangeHm(
  startIso: string,
  endIso: string,
  localeCode: string
): { variant: 'range'; start: string; end: string } | { variant: 'label'; text: string } | null {
  const start = formatHm(startIso, localeCode)
  const end = formatHm(endIso, localeCode)
  if (!start || !end) return null
  if (start === end) return { variant: 'label', text: start }
  return { variant: 'range', start, end }
}

export function megaItemTimeDisplay(item: WorkItem, localeCode: string): MegaItemTimeDisplay {
  if (item.kind === 'calendar_event') {
    const ev = item.event
    if (ev.isAllDay) {
      return { variant: 'label', text: localeCode.startsWith('de') ? 'Ganztägig' : 'All day' }
    }
    const range = formatRangeHm(ev.startIso, ev.endIso, localeCode)
    if (range) return range
    const start = formatHm(ev.startIso, localeCode)
    return start ? { variant: 'label', text: start } : { variant: 'empty' }
  }

  const plannedStart = item.planned.plannedStartIso?.trim()
  const plannedEnd = item.planned.plannedEndIso?.trim()
  if (plannedStart && plannedEnd) {
    const range = formatRangeHm(plannedStart, plannedEnd, localeCode)
    if (range) return range
  }

  const due = item.dueAtIso?.trim()
  if (due) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(due)) {
      return { variant: 'label', text: localeCode.startsWith('de') ? 'Fällig' : 'Due' }
    }
    const hm = formatHm(due, localeCode)
    return hm ? { variant: 'label', text: hm } : { variant: 'label', text: due.slice(0, 10) }
  }

  const eff = workItemEffectiveSortIso(item)
  if (eff && item.kind === 'mail_todo') {
    return { variant: 'label', text: localeCode.startsWith('de') ? 'Empfangen' : 'Received' }
  }
  return { variant: 'empty' }
}

/** Flache Darstellung (z. B. Tooltip); Range als „HH:mm – HH:mm“. */
export function megaItemTimeLabel(item: WorkItem, localeCode: string): string {
  const d = megaItemTimeDisplay(item, localeCode)
  if (d.variant === 'empty') return ''
  if (d.variant === 'label') return d.text
  return `${d.start} – ${d.end}`
}
