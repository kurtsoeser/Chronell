import type { TaskListArrangeBy, TaskListChronoOrder, TaskListFilter } from '@/app/tasks/task-list-arrange'
import type { TasksContentViewMode } from '@/app/tasks/tasks-view-mode-storage'
import type { CloudTaskCalendarDateMode } from '@/app/calendar/cloud-task-calendar'
import type { TasksDetailPanelPlacement } from '@/stores/tasks-detail-panel-layout'

const STORAGE_KEY = 'mailclient.tasks.settingsPrefs.v2'

export const TASKS_OVERDUE_HIGHLIGHT_DEFAULT_COLOR = '#ef4444'

export type TasksOverdueMode = 'start_of_day' | 'due_datetime'
export type TasksNoDuePlacement = 'group' | 'bottom' | 'hide'
export type TasksDefaultDueOnCreate = 'none' | 'today' | 'tomorrow' | 'next_week'
export type TasksCollapsedGroupsMode = 'done_only' | 'done_and_later' | 'none'

export interface TasksSettingsPrefsV1 {
  overdueHighlightEnabled: boolean
  overdueHighlightColor: string
  overdueMode: TasksOverdueMode
  defaultContentViewMode: TasksContentViewMode
  defaultArrange: TaskListArrangeBy
  defaultChrono: TaskListChronoOrder
  defaultFilter: TaskListFilter
  compactListRows: boolean
  showAccountStripe: boolean
  collapsedGroupsMode: TasksCollapsedGroupsMode
  noDuePlacement: TasksNoDuePlacement
  defaultDueOnCreate: TasksDefaultDueOnCreate
  dueReminderEnabled: boolean
  dueReminderMinutesBefore: number
  kanbanHideDoneColumn: boolean
  defaultCalendarFcView: string
  defaultCalendarDateMode: CloudTaskCalendarDateMode
  includeMailTodosInList: boolean
  unflagMailOnComplete: boolean
  defaultDetailPlacement: TasksDetailPanelPlacement
  defaultDetailOpen: boolean
  listDragEnabled: boolean
  inlineCreateShowNotes: boolean
  rememberLastListSelection: boolean
  backgroundSyncIntervalMinutes: number
}

export const TASKS_SETTINGS_PREFS_CHANGED_EVENT = 'mailclient:tasks-settings-prefs-changed'

const DEFAULT_CALENDAR_FC_VIEW = 'dayGridMonth'

const DEFAULTS: TasksSettingsPrefsV1 = {
  overdueHighlightEnabled: true,
  overdueHighlightColor: TASKS_OVERDUE_HIGHLIGHT_DEFAULT_COLOR,
  overdueMode: 'start_of_day',
  defaultContentViewMode: 'list',
  defaultArrange: 'calendar_day',
  defaultChrono: 'newest_on_top',
  defaultFilter: 'all',
  compactListRows: false,
  showAccountStripe: true,
  collapsedGroupsMode: 'done_only',
  noDuePlacement: 'group',
  defaultDueOnCreate: 'none',
  dueReminderEnabled: false,
  dueReminderMinutesBefore: 60,
  kanbanHideDoneColumn: false,
  defaultCalendarFcView: DEFAULT_CALENDAR_FC_VIEW,
  defaultCalendarDateMode: 'due',
  includeMailTodosInList: false,
  unflagMailOnComplete: true,
  defaultDetailPlacement: 'dock',
  defaultDetailOpen: true,
  listDragEnabled: true,
  inlineCreateShowNotes: false,
  rememberLastListSelection: true,
  backgroundSyncIntervalMinutes: 5
}

const VALID_ARRANGE = new Set<TaskListArrangeBy>([
  'calendar_day',
  'todo_bucket',
  'due_date',
  'item_type',
  'title',
  'account',
  'list',
  'status',
  'none'
])
const VALID_FILTER = new Set<TaskListFilter>(['all', 'open', 'completed', 'overdue'])
const VALID_CHRONO = new Set<TaskListChronoOrder>(['newest_on_top', 'oldest_on_top'])

function normalizeHexColor(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const s = raw.trim()
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return s.toLowerCase()
  if (/^#[0-9a-fA-F]{3}$/.test(s)) {
    const h = s.slice(1)
    return `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`.toLowerCase()
  }
  return null
}

function migrateLegacyPrefs(base: TasksSettingsPrefsV1): TasksSettingsPrefsV1 {
  try {
    const v1 = window.localStorage.getItem('mailclient.tasks.displayPrefs.v1')
    if (v1) {
      const o = JSON.parse(v1) as Record<string, unknown>
      if (typeof o.overdueHighlightEnabled === 'boolean') {
        base.overdueHighlightEnabled = o.overdueHighlightEnabled
      }
      const c = normalizeHexColor(o.overdueHighlightColor)
      if (c) base.overdueHighlightColor = c
    }
    const listView = window.localStorage.getItem('mailclient.tasks.listView.v1')
    if (listView) {
      const o = JSON.parse(listView) as Record<string, unknown>
      if (VALID_ARRANGE.has(o.arrange as TaskListArrangeBy)) {
        base.defaultArrange = o.arrange as TaskListArrangeBy
      }
      if (VALID_FILTER.has(o.filter as TaskListFilter)) {
        base.defaultFilter = o.filter as TaskListFilter
      }
      if (VALID_CHRONO.has(o.chrono as TaskListChronoOrder)) {
        base.defaultChrono = o.chrono as TaskListChronoOrder
      }
    }
    const viewMode = window.localStorage.getItem('mailclient.tasks.contentViewMode.v1')
    if (viewMode === 'kanban') base.defaultContentViewMode = 'kanban'
    const fc = window.localStorage.getItem('mailclient.tasks.calendar.fcView.v1')?.trim()
    if (fc) base.defaultCalendarFcView = fc
    const dm = window.localStorage.getItem('mailclient.tasks.calendarDateMode.v1')
    if (dm === 'planned') base.defaultCalendarDateMode = 'planned'
    const dp = window.localStorage.getItem('mailclient.tasksPanel.detailPlacement')
    if (dp === 'dock' || dp === 'float') base.defaultDetailPlacement = dp
  } catch {
    // ignore
  }
  return base
}

function parsePrefs(raw: string): TasksSettingsPrefsV1 {
  const o = JSON.parse(raw) as Record<string, unknown>
  const base = { ...DEFAULTS }
  if (typeof o.overdueHighlightEnabled === 'boolean') {
    base.overdueHighlightEnabled = o.overdueHighlightEnabled
  }
  const color = normalizeHexColor(o.overdueHighlightColor)
  if (color) base.overdueHighlightColor = color
  if (o.overdueMode === 'start_of_day' || o.overdueMode === 'due_datetime') {
    base.overdueMode = o.overdueMode
  }
  if (o.defaultContentViewMode === 'list' || o.defaultContentViewMode === 'kanban') {
    base.defaultContentViewMode = o.defaultContentViewMode
  }
  if (VALID_ARRANGE.has(o.defaultArrange as TaskListArrangeBy)) {
    base.defaultArrange = o.defaultArrange as TaskListArrangeBy
  }
  if (VALID_FILTER.has(o.defaultFilter as TaskListFilter)) {
    base.defaultFilter = o.defaultFilter as TaskListFilter
  }
  if (VALID_CHRONO.has(o.defaultChrono as TaskListChronoOrder)) {
    base.defaultChrono = o.defaultChrono as TaskListChronoOrder
  }
  if (typeof o.compactListRows === 'boolean') base.compactListRows = o.compactListRows
  if (typeof o.showAccountStripe === 'boolean') base.showAccountStripe = o.showAccountStripe
  if (
    o.collapsedGroupsMode === 'done_only' ||
    o.collapsedGroupsMode === 'done_and_later' ||
    o.collapsedGroupsMode === 'none'
  ) {
    base.collapsedGroupsMode = o.collapsedGroupsMode
  }
  if (o.noDuePlacement === 'group' || o.noDuePlacement === 'bottom' || o.noDuePlacement === 'hide') {
    base.noDuePlacement = o.noDuePlacement
  }
  if (
    o.defaultDueOnCreate === 'none' ||
    o.defaultDueOnCreate === 'today' ||
    o.defaultDueOnCreate === 'tomorrow' ||
    o.defaultDueOnCreate === 'next_week'
  ) {
    base.defaultDueOnCreate = o.defaultDueOnCreate
  }
  if (typeof o.dueReminderEnabled === 'boolean') base.dueReminderEnabled = o.dueReminderEnabled
  if (typeof o.dueReminderMinutesBefore === 'number' && o.dueReminderMinutesBefore >= 0) {
    base.dueReminderMinutesBefore = Math.min(10_080, Math.round(o.dueReminderMinutesBefore))
  }
  if (typeof o.kanbanHideDoneColumn === 'boolean') base.kanbanHideDoneColumn = o.kanbanHideDoneColumn
  if (typeof o.defaultCalendarFcView === 'string' && o.defaultCalendarFcView.trim()) {
    base.defaultCalendarFcView = o.defaultCalendarFcView.trim()
  }
  if (o.defaultCalendarDateMode === 'due' || o.defaultCalendarDateMode === 'planned') {
    base.defaultCalendarDateMode = o.defaultCalendarDateMode
  }
  if (typeof o.includeMailTodosInList === 'boolean') {
    base.includeMailTodosInList = o.includeMailTodosInList
  }
  if (typeof o.unflagMailOnComplete === 'boolean') base.unflagMailOnComplete = o.unflagMailOnComplete
  if (o.defaultDetailPlacement === 'dock' || o.defaultDetailPlacement === 'float') {
    base.defaultDetailPlacement = o.defaultDetailPlacement
  }
  if (typeof o.defaultDetailOpen === 'boolean') base.defaultDetailOpen = o.defaultDetailOpen
  if (typeof o.listDragEnabled === 'boolean') base.listDragEnabled = o.listDragEnabled
  if (typeof o.inlineCreateShowNotes === 'boolean') base.inlineCreateShowNotes = o.inlineCreateShowNotes
  if (typeof o.rememberLastListSelection === 'boolean') {
    base.rememberLastListSelection = o.rememberLastListSelection
  }
  if (typeof o.backgroundSyncIntervalMinutes === 'number' && o.backgroundSyncIntervalMinutes >= 0) {
    base.backgroundSyncIntervalMinutes = Math.min(1440, Math.round(o.backgroundSyncIntervalMinutes))
  }
  return base
}

export function readTasksSettingsPrefs(): TasksSettingsPrefsV1 {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw) return parsePrefs(raw)
    return migrateLegacyPrefs({ ...DEFAULTS })
  } catch {
    return { ...DEFAULTS }
  }
}

export function persistTasksSettingsPrefs(prefs: TasksSettingsPrefsV1): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
    window.dispatchEvent(new CustomEvent(TASKS_SETTINGS_PREFS_CHANGED_EVENT))
  } catch {
    // ignore
  }
}

export function patchTasksSettingsPrefs(patch: Partial<TasksSettingsPrefsV1>): TasksSettingsPrefsV1 {
  const next = { ...readTasksSettingsPrefs(), ...patch }
  persistTasksSettingsPrefs(next)
  return next
}

export function resetTasksSettingsPrefs(): void {
  persistTasksSettingsPrefs({ ...DEFAULTS })
}
