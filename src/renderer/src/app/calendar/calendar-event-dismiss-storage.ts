import { readCalendarSettingsPrefs } from '@/lib/calendar-settings-prefs'

const DISMISSED_KEY = 'mailclient.calendarEventDismissed.v1'
const FORCE_OPEN_KEY = 'mailclient.calendarEventForceOpen.v1'
const AUTO_DISMISS_ENDED_KEY = 'mailclient.timelineAutoDismissEndedEvents.v1'

function readDismissedRecord(): Record<string, true> {
  try {
    const raw = window.localStorage.getItem(DISMISSED_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return {}
    const out: Record<string, true> = {}
    for (const [k, v] of Object.entries(parsed)) {
      if (v === true && typeof k === 'string' && k.length > 0) out[k] = true
    }
    return out
  } catch {
    return {}
  }
}

function writeDismissedRecord(record: Record<string, true>): void {
  try {
    window.localStorage.setItem(DISMISSED_KEY, JSON.stringify(record))
  } catch {
    // ignore
  }
}

export function isCalendarEventDismissed(stableKey: string): boolean {
  return readDismissedRecord()[stableKey] === true
}

export function setCalendarEventDismissed(stableKey: string, dismissed: boolean): void {
  const record = readDismissedRecord()
  if (dismissed) record[stableKey] = true
  else delete record[stableKey]
  writeDismissedRecord(record)
}

function readForceOpenRecord(): Record<string, true> {
  try {
    const raw = window.localStorage.getItem(FORCE_OPEN_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return {}
    const out: Record<string, true> = {}
    for (const [k, v] of Object.entries(parsed)) {
      if (v === true && typeof k === 'string' && k.length > 0) out[k] = true
    }
    return out
  } catch {
    return {}
  }
}

function writeForceOpenRecord(record: Record<string, true>): void {
  try {
    window.localStorage.setItem(FORCE_OPEN_KEY, JSON.stringify(record))
  } catch {
    // ignore
  }
}

export function isCalendarEventForceOpen(stableKey: string): boolean {
  return readForceOpenRecord()[stableKey] === true
}

export function setCalendarEventForceOpen(stableKey: string, forceOpen: boolean): void {
  const record = readForceOpenRecord()
  if (forceOpen) record[stableKey] = true
  else delete record[stableKey]
  writeForceOpenRecord(record)
}

export function readTimelineAutoDismissEndedEvents(): boolean {
  try {
    const raw = window.localStorage.getItem(AUTO_DISMISS_ENDED_KEY)
    if (raw === null) return readCalendarSettingsPrefs().timelineAutoDismissEndedEvents
    return raw === '1'
  } catch {
    return readCalendarSettingsPrefs().timelineAutoDismissEndedEvents
  }
}

export function persistTimelineAutoDismissEndedEvents(value: boolean): void {
  try {
    window.localStorage.setItem(AUTO_DISMISS_ENDED_KEY, value ? '1' : '0')
  } catch {
    // ignore
  }
}
