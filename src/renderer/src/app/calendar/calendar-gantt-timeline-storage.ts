import type { GanttTimelineScale } from '@/app/calendar/calendar-gantt-scale'
import { GANTT_TIMELINE_SCALES } from '@/app/calendar/calendar-gantt-scale'
import { readCalendarSettingsPrefs } from '@/lib/calendar-settings-prefs'

const KEY = 'mailclient.calendar.ganttTimelineScale.v1'

export const DEFAULT_GANTT_TIMELINE_SCALE: GanttTimelineScale = 'twoWeeks'

const SCALES = new Set<GanttTimelineScale>(GANTT_TIMELINE_SCALES)

export function readGanttTimelineScale(): GanttTimelineScale {
  try {
    const raw = window.localStorage.getItem(KEY)
    if (raw && SCALES.has(raw as GanttTimelineScale)) return raw as GanttTimelineScale
  } catch {
    // ignore
  }
  return readCalendarSettingsPrefs().defaultGanttTimelineScale
}

export function persistGanttTimelineScale(scale: GanttTimelineScale): void {
  try {
    window.localStorage.setItem(KEY, scale)
  } catch {
    // ignore
  }
}
