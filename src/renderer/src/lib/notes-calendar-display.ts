import { readCalendarSettingsPrefs } from '@/lib/calendar-settings-prefs'
import type { NotesSettingsPrefsV1 } from '@/lib/notes-settings-prefs'

/** Kalender-Raster in Notizen: eigene Werte oder Hauptkalender. */
export function resolveNotesCalendarDisplayPrefs(
  prefs: NotesSettingsPrefsV1
): Pick<
  NotesSettingsPrefsV1,
  | 'weekStartsOn'
  | 'defaultTimeGridSlotMinutes'
  | 'slotMinTime'
  | 'slotMaxTime'
  | 'scrollTime'
  | 'hideWeekends'
> {
  if (!prefs.useMainCalendarDisplaySettings) {
    return {
      weekStartsOn: prefs.weekStartsOn,
      defaultTimeGridSlotMinutes: prefs.defaultTimeGridSlotMinutes,
      slotMinTime: prefs.slotMinTime,
      slotMaxTime: prefs.slotMaxTime,
      scrollTime: prefs.scrollTime,
      hideWeekends: prefs.hideWeekends
    }
  }
  const cal = readCalendarSettingsPrefs()
  return {
    weekStartsOn: cal.weekStartsOn,
    defaultTimeGridSlotMinutes: cal.defaultTimeGridSlotMinutes,
    slotMinTime: cal.slotMinTime,
    slotMaxTime: cal.slotMaxTime,
    scrollTime: cal.scrollTime,
    hideWeekends: cal.hideWeekends
  }
}
