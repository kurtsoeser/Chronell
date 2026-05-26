import { addDays, startOfDay } from 'date-fns'
import type { TasksDefaultDueOnCreate } from '@/lib/tasks-settings-prefs'

/** `datetime-local` Wert für Inline-Neuanlage. */
export function defaultDueInputForCreate(preset: TasksDefaultDueOnCreate): string {
  if (preset === 'none') return ''
  const base = startOfDay(new Date())
  const d =
    preset === 'today'
      ? base
      : preset === 'tomorrow'
        ? addDays(base, 1)
        : addDays(base, 7)
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T09:00`
}
