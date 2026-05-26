import type { CloudTaskCalendarDateMode } from '@/app/calendar/cloud-task-calendar'
import { readTasksSettingsPrefs } from '@/lib/tasks-settings-prefs'

const KEY = 'mailclient.tasks.calendarDateMode.v1'

export function readTasksCalendarDateMode(): CloudTaskCalendarDateMode {
  try {
    const raw = window.localStorage.getItem(KEY)
    if (raw === 'planned') return 'planned'
    if (raw === 'due') return 'due'
  } catch {
    // ignore
  }
  return readTasksSettingsPrefs().defaultCalendarDateMode
}

export function persistTasksCalendarDateMode(mode: CloudTaskCalendarDateMode): void {
  try {
    window.localStorage.setItem(KEY, mode)
  } catch {
    // ignore
  }
}
