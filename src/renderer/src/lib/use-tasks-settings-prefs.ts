import { useEffect, useState } from 'react'
import {
  TASKS_SETTINGS_PREFS_CHANGED_EVENT,
  readTasksSettingsPrefs,
  type TasksSettingsPrefsV1
} from '@/lib/tasks-settings-prefs'

export function useTasksSettingsPrefs(): TasksSettingsPrefsV1 {
  const [prefs, setPrefs] = useState<TasksSettingsPrefsV1>(() => readTasksSettingsPrefs())

  useEffect(() => {
    const onChanged = (): void => setPrefs(readTasksSettingsPrefs())
    window.addEventListener(TASKS_SETTINGS_PREFS_CHANGED_EVENT, onChanged)
    return (): void => window.removeEventListener(TASKS_SETTINGS_PREFS_CHANGED_EVENT, onChanged)
  }, [])

  return prefs
}
