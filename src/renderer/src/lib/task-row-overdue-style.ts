import type { CSSProperties } from 'react'
import type { TaskItemRow } from '@shared/types'
import { classifyTaskItemDueBucket } from '@/app/tasks/task-due-bucket'
import type { TasksSettingsPrefsV1 } from '@/lib/tasks-settings-prefs'

export function isOpenOverdueTask(
  task: Pick<TaskItemRow, 'dueIso' | 'completed'>,
  timeZone: string,
  nowMs = Date.now(),
  overdueMode: TasksSettingsPrefsV1['overdueMode'] = 'start_of_day'
): boolean {
  if (task.completed) return false
  return classifyTaskItemDueBucket(task, timeZone, nowMs, overdueMode) === 'overdue'
}

export function resolveTaskOverdueRowStyle(
  task: Pick<TaskItemRow, 'dueIso' | 'completed'>,
  prefs: Pick<TasksSettingsPrefsV1, 'overdueHighlightEnabled' | 'overdueHighlightColor' | 'overdueMode'>,
  timeZone: string,
  accountStripeColor: string | undefined
): { stripeColor: string | undefined; rowStyle: CSSProperties | undefined } {
  if (
    !prefs.overdueHighlightEnabled ||
    !isOpenOverdueTask(task, timeZone, Date.now(), prefs.overdueMode)
  ) {
    return { stripeColor: accountStripeColor, rowStyle: undefined }
  }
  const color = prefs.overdueHighlightColor
  return {
    stripeColor: color,
    rowStyle: { backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)` }
  }
}
