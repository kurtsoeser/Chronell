import type {
  CalendarRecurrenceFrequency,
  CalendarRecurrenceRangeEndMode,
  TaskItemRow,
  TaskSaveRecurrence
} from '@shared/types'

export type TaskRecurrenceUiFrequency = 'none' | CalendarRecurrenceFrequency

export interface TaskRecurrenceFormState {
  recurFreq: TaskRecurrenceUiFrequency
  recurEnd: CalendarRecurrenceRangeEndMode
  recurUntilDate: string
  recurCount: string
  recurWeekdays: Array<
    'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'
  >
}

export type TaskRecurrenceValidationError =
  | 'dueRequired'
  | 'untilInvalid'
  | 'untilBeforeDue'
  | 'countInvalid'

export function validateTaskRecurrenceForm(
  state: TaskRecurrenceFormState,
  dueDateYmd: string
): TaskRecurrenceValidationError | null {
  if (state.recurFreq === 'none') return null
  if (!dueDateYmd.trim()) return 'dueRequired'
  if (state.recurEnd === 'until') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(state.recurUntilDate)) return 'untilInvalid'
    if (state.recurUntilDate < dueDateYmd) return 'untilBeforeDue'
  }
  if (state.recurEnd === 'count') {
    const n = parseInt(state.recurCount, 10)
    if (!Number.isFinite(n) || n < 1 || n > 999) return 'countInvalid'
  }
  return null
}

export function buildTaskSaveRecurrence(state: TaskRecurrenceFormState): TaskSaveRecurrence | undefined {
  if (state.recurFreq === 'none') return undefined
  return {
    frequency: state.recurFreq,
    rangeEnd: state.recurEnd,
    ...((state.recurFreq === 'weekly' || state.recurFreq === 'biweekly') &&
    state.recurWeekdays.length > 0
      ? { weekdays: state.recurWeekdays }
      : {}),
    ...(state.recurEnd === 'until' ? { untilDate: state.recurUntilDate } : {}),
    ...(state.recurEnd === 'count' ? { count: parseInt(state.recurCount, 10) } : {})
  }
}

export function taskRecurrenceToFormState(
  task: Pick<TaskItemRow, 'recurrence'> | null | undefined
): TaskRecurrenceFormState {
  const recurrence = task?.recurrence
  if (!recurrence) {
    return {
      recurFreq: 'none',
      recurEnd: 'never',
      recurUntilDate: '',
      recurCount: '10',
      recurWeekdays: []
    }
  }
  return {
    recurFreq: recurrence.frequency,
    recurEnd: recurrence.rangeEnd,
    recurUntilDate: recurrence.untilDate ?? '',
    recurCount: recurrence.count != null ? String(recurrence.count) : '10',
    recurWeekdays: recurrence.weekdays ?? []
  }
}

export function defaultWeekdayFromDueYmd(dueYmd: string): TaskRecurrenceFormState['recurWeekdays'] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueYmd)) return []
  const d = new Date(`${dueYmd}T12:00:00`)
  const idx = d.getUTCDay()
  const keys = [
    'sunday',
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday'
  ] as const
  const key = keys[idx]
  return key && key !== 'sunday' ? [key] : key ? [key] : []
}
