import { readTasksSettingsPrefs } from '@/lib/tasks-settings-prefs'

const KEY = 'mailclient.tasks.calendar.fcView.v1'

const VALID = new Set([
  'dayGridMonth',
  'timeGridWeek',
  'timeGridDay',
  'listWeek',
  ...Array.from({ length: 20 }, (_, i) => `timeGrid${i + 2}Day`)
])

export function readTasksCalendarFcView(): string {
  try {
    const raw = window.localStorage.getItem(KEY)?.trim()
    if (raw && VALID.has(raw)) return raw
  } catch {
    // ignore
  }
  const fromSettings = readTasksSettingsPrefs().defaultCalendarFcView
  return VALID.has(fromSettings) ? fromSettings : 'dayGridMonth'
}

export function persistTasksCalendarFcView(viewId: string): void {
  try {
    if (VALID.has(viewId)) window.localStorage.setItem(KEY, viewId)
  } catch {
    // ignore
  }
}
