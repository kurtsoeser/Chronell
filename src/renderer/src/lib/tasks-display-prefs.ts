/** @deprecated Nutze `tasks-settings-prefs`. */
export {
  TASKS_OVERDUE_HIGHLIGHT_DEFAULT_COLOR,
  TASKS_SETTINGS_PREFS_CHANGED_EVENT as TASKS_DISPLAY_PREFS_CHANGED_EVENT,
  readTasksSettingsPrefs as readTasksDisplayPrefs,
  persistTasksSettingsPrefs as persistTasksDisplayPrefs,
  resetTasksSettingsPrefs as resetTasksDisplayPrefs,
  type TasksSettingsPrefsV1 as TasksDisplayPrefsV1
} from '@/lib/tasks-settings-prefs'
