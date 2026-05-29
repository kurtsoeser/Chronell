import type { CalendarEventView } from '@shared/types'
import { calendarEventReminderKey, readCalendarEventReminder } from '@/lib/calendar-event-reminders'

type FiredCache = Map<string, number>

function nowMs(): number {
  return Date.now()
}

function eventStartMs(ev: CalendarEventView): number | null {
  if (ev.isAllDay) return null
  const ms = Date.parse(ev.startIso)
  if (!Number.isFinite(ms)) return null
  return ms
}

export async function runCalendarEventReminders(
  events: CalendarEventView[],
  productName: string,
  firedCache: FiredCache
): Promise<void> {
  if (typeof Notification === 'undefined') return
  if (Notification.permission === 'default') {
    try {
      await Notification.requestPermission()
    } catch {
      return
    }
  }
  if (Notification.permission !== 'granted') return

  const now = nowMs()
  const windowMs = 2 * 60_000 // kleine Toleranz, da wir periodisch pollen

  for (const ev of events) {
    const gid = ev.graphEventId?.trim()
    if (!gid) continue
    const start = eventStartMs(ev)
    if (start == null) continue

    const cfg = readCalendarEventReminder(calendarEventReminderKey(ev.accountId, gid))
    if (!cfg || cfg.enabled !== true) continue

    const fireAt = start - cfg.minutesBefore * 60_000
    if (fireAt > now + windowMs) continue
    if (fireAt < now - 10 * 60_000) continue

    const cacheKey = `${ev.accountId}:${gid}:${cfg.minutesBefore}`
    const lastFired = firedCache.get(cacheKey)
    if (lastFired && now - lastFired < 60 * 60_000) continue

    firedCache.set(cacheKey, now)
    new Notification(productName, {
      body: ev.title?.trim() ? ev.title.trim() : 'Termin',
      silent: true
    })
  }
}

