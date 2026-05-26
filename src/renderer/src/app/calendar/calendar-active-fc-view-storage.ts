import {
  isValidCalendarFcView,
  readCalendarSettingsPrefs
} from '@/lib/calendar-settings-prefs'

const KEY = 'mailclient.calendar.activeFcView.v1'

export function readCalendarActiveFcView(): string {
  const settings = readCalendarSettingsPrefs()
  if (settings.rememberLastFcView) {
    try {
      const raw = window.localStorage.getItem(KEY)?.trim()
      if (raw && isValidCalendarFcView(raw)) return raw
    } catch {
      // ignore
    }
  }
  return settings.defaultFcView
}

export function persistCalendarActiveFcView(viewId: string): void {
  if (!isValidCalendarFcView(viewId)) return
  try {
    window.localStorage.setItem(KEY, viewId)
  } catch {
    // ignore
  }
}
