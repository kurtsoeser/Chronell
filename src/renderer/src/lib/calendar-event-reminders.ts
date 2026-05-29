export const CAL_EVENT_REMINDER_DEFAULT_MINUTES = 15

export type CalendarEventReminderConfig =
  | { enabled: false }
  | { enabled: true; minutesBefore: number }

const PREFIX = 'mailclient.calendar.eventReminder.v1'

export function calendarEventReminderKey(accountId: string, graphEventId: string): string {
  return `${PREFIX}:${accountId}:${graphEventId}`
}

export function readCalendarEventReminder(key: string): CalendarEventReminderConfig | null {
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return null
    const o = JSON.parse(raw) as { enabled?: unknown; minutesBefore?: unknown }
    if (o.enabled === false) return { enabled: false }
    if (o.enabled === true) {
      const m = typeof o.minutesBefore === 'number' && Number.isFinite(o.minutesBefore) ? o.minutesBefore : null
      return { enabled: true, minutesBefore: Math.max(0, Math.min(10_080, Math.round(m ?? CAL_EVENT_REMINDER_DEFAULT_MINUTES))) }
    }
    return null
  } catch {
    return null
  }
}

export function writeCalendarEventReminder(key: string, cfg: CalendarEventReminderConfig): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(cfg))
  } catch {
    // ignore
  }
}

