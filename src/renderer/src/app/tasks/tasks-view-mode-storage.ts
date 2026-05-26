import { readTasksSettingsPrefs } from '@/lib/tasks-settings-prefs'

/** Liste + Kalender (Standard) oder Kanban. */
export type TasksContentViewMode = 'list' | 'kanban'

const KEY = 'mailclient.tasks.contentViewMode.v1'

export function readTasksContentViewMode(): TasksContentViewMode {
  try {
    const raw = window.localStorage.getItem(KEY)
    if (raw === 'kanban') return 'kanban'
    if (raw === 'list') return 'list'
  } catch {
    // ignore
  }
  return readTasksSettingsPrefs().defaultContentViewMode
}

export function persistTasksContentViewMode(mode: TasksContentViewMode): void {
  try {
    window.localStorage.setItem(KEY, mode)
  } catch {
    // ignore
  }
}
