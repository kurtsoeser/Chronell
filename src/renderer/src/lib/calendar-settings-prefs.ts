import type { TimeGridSlotMinutes } from '@/app/calendar/calendar-shell-storage'
import { isTimeGridSlotMinutes, TIME_GRID_SLOT_MINUTES_OPTIONS } from '@/app/calendar/calendar-shell-storage'
import type { GanttTimelineScale } from '@/app/calendar/calendar-gantt-scale'
import { GANTT_TIMELINE_SCALES } from '@/app/calendar/calendar-gantt-scale'
import type { TimelineWindowSize } from '@/app/calendar/timeline-window-storage'

const STORAGE_KEY = 'mailclient.calendar.settingsPrefs.v1'

export type CalendarWeekStart = 0 | 1

export interface CalendarSettingsPrefsV1 {
  defaultFcView: string
  weekStartsOn: CalendarWeekStart
  defaultTimeGridSlotMinutes: TimeGridSlotMinutes
  slotMinTime: string
  slotMaxTime: string
  scrollTime: string
  hideWeekends: boolean
  defaultGanttTimelineScale: GanttTimelineScale
  defaultMailTodoOverlay: boolean
  defaultCloudTaskOverlay: boolean
  defaultUserNoteOverlay: boolean
  defaultRightInboxOpen: boolean
  defaultRightPreviewOpen: boolean
  defaultLeftSidebarCollapsed: boolean
  defaultTimelineWindowSize: TimelineWindowSize
  timelineAutoDismissEndedEvents: boolean
  rememberLastFcView: boolean
}

export const CALENDAR_SETTINGS_PREFS_CHANGED_EVENT = 'mailclient:calendar-settings-prefs-changed'

const VALID_FC_VIEWS = new Set([
  'timeGridWeek',
  'timeGridDay',
  'dayGridMonth',
  'listWeek',
  'multiMonthYear',
  'multiMonthQuarter',
  'ganttTimeline',
  ...Array.from({ length: 20 }, (_, i) => `timeGrid${i + 2}Day`)
])

/** Frühere Standard-Tagesansicht (7–20 Uhr); wird beim Lesen auf 24 h hochgestuft. */
const LEGACY_DEFAULT_SLOT_MIN = '07:00:00'
const LEGACY_DEFAULT_SLOT_MAX = '20:00:00'

const DEFAULTS: CalendarSettingsPrefsV1 = {
  defaultFcView: 'timeGridWeek',
  weekStartsOn: 1,
  defaultTimeGridSlotMinutes: 15,
  slotMinTime: '00:00:00',
  slotMaxTime: '24:00:00',
  scrollTime: '07:00:00',
  hideWeekends: false,
  defaultGanttTimelineScale: 'twoWeeks',
  defaultMailTodoOverlay: true,
  defaultCloudTaskOverlay: true,
  defaultUserNoteOverlay: true,
  defaultRightInboxOpen: true,
  defaultRightPreviewOpen: true,
  defaultLeftSidebarCollapsed: false,
  defaultTimelineWindowSize: 'month',
  timelineAutoDismissEndedEvents: true,
  rememberLastFcView: true
}

function normalizeTimeHms(raw: unknown, fallback: string): string {
  if (typeof raw !== 'string') return fallback
  const s = raw.trim()
  if (/^\d{2}:\d{2}(:\d{2})?$/.test(s)) {
    return s.length === 5 ? `${s}:00` : s
  }
  return fallback
}

function migrateLegacyPrefs(base: CalendarSettingsPrefsV1): CalendarSettingsPrefsV1 {
  try {
    const slot = window.localStorage.getItem('mailclient.calendar.timeGridSlotMinutes')
    const n = slot != null ? Number(slot) : NaN
    if (Number.isInteger(n) && isTimeGridSlotMinutes(n)) {
      base.defaultTimeGridSlotMinutes = n
    }
    if (window.localStorage.getItem('mailclient.calendar.mailTodoOverlay') === '0') {
      base.defaultMailTodoOverlay = false
    }
    if (window.localStorage.getItem('mailclient.calendar.cloudTaskOverlay') === '0') {
      base.defaultCloudTaskOverlay = false
    }
    if (window.localStorage.getItem('mailclient.calendar.notesOverlay') === '0') {
      base.defaultUserNoteOverlay = false
    }
    const tw = window.localStorage.getItem('mailclient.calendarTimelineWindow.v1')
    if (tw === 'week' || tw === 'month' || tw === 'quarter') {
      base.defaultTimelineWindowSize = tw
    }
    const gantt = window.localStorage.getItem('mailclient.calendar.ganttTimelineScale.v1')
    if (gantt && (GANTT_TIMELINE_SCALES as readonly string[]).includes(gantt)) {
      base.defaultGanttTimelineScale = gantt as GanttTimelineScale
    }
    const autoDismiss = window.localStorage.getItem('mailclient.timelineAutoDismissEndedEvents.v1')
    if (autoDismiss === '0') base.timelineAutoDismissEndedEvents = false
  } catch {
    // ignore
  }
  return base
}

function parsePrefs(raw: string): CalendarSettingsPrefsV1 {
  const o = JSON.parse(raw) as Record<string, unknown>
  const base = { ...DEFAULTS }
  if (typeof o.defaultFcView === 'string' && VALID_FC_VIEWS.has(o.defaultFcView)) {
    base.defaultFcView = o.defaultFcView
  }
  if (o.weekStartsOn === 0 || o.weekStartsOn === 1) base.weekStartsOn = o.weekStartsOn
  const slotN = Number(o.defaultTimeGridSlotMinutes)
  if (Number.isInteger(slotN) && isTimeGridSlotMinutes(slotN)) {
    base.defaultTimeGridSlotMinutes = slotN
  }
  base.slotMinTime = normalizeTimeHms(o.slotMinTime, base.slotMinTime)
  base.slotMaxTime = normalizeTimeHms(o.slotMaxTime, base.slotMaxTime)
  base.scrollTime = normalizeTimeHms(o.scrollTime, base.scrollTime)
  if (typeof o.hideWeekends === 'boolean') base.hideWeekends = o.hideWeekends
  if (
    typeof o.defaultGanttTimelineScale === 'string' &&
    (GANTT_TIMELINE_SCALES as readonly string[]).includes(o.defaultGanttTimelineScale)
  ) {
    base.defaultGanttTimelineScale = o.defaultGanttTimelineScale as GanttTimelineScale
  }
  if (typeof o.defaultMailTodoOverlay === 'boolean') {
    base.defaultMailTodoOverlay = o.defaultMailTodoOverlay
  }
  if (typeof o.defaultCloudTaskOverlay === 'boolean') {
    base.defaultCloudTaskOverlay = o.defaultCloudTaskOverlay
  }
  if (typeof o.defaultUserNoteOverlay === 'boolean') {
    base.defaultUserNoteOverlay = o.defaultUserNoteOverlay
  }
  if (typeof o.defaultRightInboxOpen === 'boolean') {
    base.defaultRightInboxOpen = o.defaultRightInboxOpen
  }
  if (typeof o.defaultRightPreviewOpen === 'boolean') {
    base.defaultRightPreviewOpen = o.defaultRightPreviewOpen
  }
  if (typeof o.defaultLeftSidebarCollapsed === 'boolean') {
    base.defaultLeftSidebarCollapsed = o.defaultLeftSidebarCollapsed
  }
  if (o.defaultTimelineWindowSize === 'week' || o.defaultTimelineWindowSize === 'month' || o.defaultTimelineWindowSize === 'quarter') {
    base.defaultTimelineWindowSize = o.defaultTimelineWindowSize
  }
  if (typeof o.timelineAutoDismissEndedEvents === 'boolean') {
    base.timelineAutoDismissEndedEvents = o.timelineAutoDismissEndedEvents
  }
  if (typeof o.rememberLastFcView === 'boolean') base.rememberLastFcView = o.rememberLastFcView
  return base
}

/** Hebt alte 7–20-Uhr-Standards auf scrollbare 24 h an (einmalig persistiert). */
function migrateLegacySlotRange(prefs: CalendarSettingsPrefsV1): CalendarSettingsPrefsV1 {
  if (
    prefs.slotMinTime === LEGACY_DEFAULT_SLOT_MIN &&
    prefs.slotMaxTime === LEGACY_DEFAULT_SLOT_MAX
  ) {
    const next: CalendarSettingsPrefsV1 = {
      ...prefs,
      slotMinTime: DEFAULTS.slotMinTime,
      slotMaxTime: DEFAULTS.slotMaxTime
    }
    persistCalendarSettingsPrefs(next)
    return next
  }
  return prefs
}

export function readCalendarSettingsPrefs(): CalendarSettingsPrefsV1 {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw) return migrateLegacySlotRange(parsePrefs(raw))
    return migrateLegacySlotRange(migrateLegacyPrefs({ ...DEFAULTS }))
  } catch {
    return { ...DEFAULTS }
  }
}

export function persistCalendarSettingsPrefs(prefs: CalendarSettingsPrefsV1): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
    window.dispatchEvent(new CustomEvent(CALENDAR_SETTINGS_PREFS_CHANGED_EVENT))
  } catch {
    // ignore
  }
}

export function patchCalendarSettingsPrefs(patch: Partial<CalendarSettingsPrefsV1>): CalendarSettingsPrefsV1 {
  const next = { ...readCalendarSettingsPrefs(), ...patch }
  persistCalendarSettingsPrefs(next)
  return next
}

export function resetCalendarSettingsPrefs(): void {
  persistCalendarSettingsPrefs({ ...DEFAULTS })
}

export function isValidCalendarFcView(viewId: string): boolean {
  return VALID_FC_VIEWS.has(viewId)
}

export const CALENDAR_FC_VIEW_OPTIONS = [
  'timeGridWeek',
  'timeGridDay',
  'dayGridMonth',
  'listWeek',
  'multiMonthYear',
  'ganttTimeline'
] as const
