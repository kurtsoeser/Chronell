import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'
import { resolveCalendarTimeZone } from './todo-due-buckets'

let cachedCalendarTz: string | undefined

/** Kalender-Zeitzone aus config.json (sync, fuer DB-Labels im Main-Prozess). */
export function getCalendarDisplayTimeZoneSync(): string {
  if (cachedCalendarTz) return cachedCalendarTz
  try {
    const path = join(app.getPath('userData'), 'config.json')
    if (existsSync(path)) {
      const raw = JSON.parse(readFileSync(path, 'utf8')) as {
        calendarTimeZone?: string | null
      }
      cachedCalendarTz = resolveCalendarTimeZone(raw.calendarTimeZone ?? null)
      return cachedCalendarTz
    }
  } catch {
    /* ignore */
  }
  cachedCalendarTz = resolveCalendarTimeZone(null)
  return cachedCalendarTz
}

export function invalidateCalendarDisplayTimeZoneCache(): void {
  cachedCalendarTz = undefined
}

export function getAppDisplayLocaleCode(): 'de' | 'en' {
  try {
    return app.getLocale().toLowerCase().startsWith('de') ? 'de' : 'en'
  } catch {
    return 'de'
  }
}
