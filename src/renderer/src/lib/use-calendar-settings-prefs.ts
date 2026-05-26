import { useEffect, useState } from 'react'
import {
  CALENDAR_SETTINGS_PREFS_CHANGED_EVENT,
  readCalendarSettingsPrefs,
  type CalendarSettingsPrefsV1
} from '@/lib/calendar-settings-prefs'

export function useCalendarSettingsPrefs(): CalendarSettingsPrefsV1 {
  const [prefs, setPrefs] = useState<CalendarSettingsPrefsV1>(() => readCalendarSettingsPrefs())

  useEffect(() => {
    const onChanged = (): void => setPrefs(readCalendarSettingsPrefs())
    window.addEventListener(CALENDAR_SETTINGS_PREFS_CHANGED_EVENT, onChanged)
    return (): void => window.removeEventListener(CALENDAR_SETTINGS_PREFS_CHANGED_EVENT, onChanged)
  }, [])

  return prefs
}
