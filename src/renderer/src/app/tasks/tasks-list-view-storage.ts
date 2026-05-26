import type {
  TaskListArrangeBy,
  TaskListChronoOrder,
  TaskListFilter
} from '@/app/tasks/task-list-arrange'
import { readTasksSettingsPrefs } from '@/lib/tasks-settings-prefs'

const KEY = 'mailclient.tasks.listView.v1'

export interface TasksListViewPrefsV1 {
  arrange: TaskListArrangeBy
  chrono: TaskListChronoOrder
  filter: TaskListFilter
}

function settingsDefaults(): TasksListViewPrefsV1 {
  const s = readTasksSettingsPrefs()
  return {
    arrange: s.defaultArrange,
    chrono: s.defaultChrono,
    filter: s.defaultFilter
  }
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

export function readTasksListViewPrefs(): TasksListViewPrefsV1 {
  const DEFAULTS = settingsDefaults()
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return { ...DEFAULTS }
    const o = JSON.parse(raw) as unknown
    if (!o || typeof o !== 'object' || Array.isArray(o)) return { ...DEFAULTS }
    const rec = o as Record<string, unknown>
    const arrange = VALID_ARRANGE.has(rec.arrange as TaskListArrangeBy)
      ? (rec.arrange as TaskListArrangeBy)
      : DEFAULTS.arrange
    const filter = VALID_FILTER.has(rec.filter as TaskListFilter)
      ? (rec.filter as TaskListFilter)
      : DEFAULTS.filter
    const chrono = VALID_CHRONO.has(rec.chrono as TaskListChronoOrder)
      ? (rec.chrono as TaskListChronoOrder)
      : DEFAULTS.chrono
    return { arrange, filter, chrono }
  } catch {
    return { ...DEFAULTS }
  }
}

export function persistTasksListViewPrefs(prefs: TasksListViewPrefsV1): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(prefs))
  } catch {
    // ignore
  }
}
