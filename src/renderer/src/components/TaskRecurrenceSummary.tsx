import { Repeat2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { TaskItemRow, TaskSaveRecurrence } from '@shared/types'

function freqLabel(
  t: (key: string) => string,
  frequency: TaskSaveRecurrence['frequency']
): string {
  switch (frequency) {
    case 'daily':
      return t('tasks.recurrence.freqDaily')
    case 'weekly':
      return t('tasks.recurrence.freqWeekly')
    case 'biweekly':
      return t('tasks.recurrence.freqBiweekly')
    case 'monthly':
      return t('tasks.recurrence.freqMonthly')
    case 'yearly':
      return t('tasks.recurrence.freqYearly')
    default:
      return frequency
  }
}

export function TaskRecurrenceSummary({
  recurrence,
  recurrenceLocalOnly
}: {
  recurrence: TaskSaveRecurrence
  recurrenceLocalOnly?: boolean
}): JSX.Element {
  const { t } = useTranslation()
  let end = t('tasks.recurrence.endNever')
  if (recurrence.rangeEnd === 'until' && recurrence.untilDate) {
    end = t('tasks.recurrence.endUntil', { date: recurrence.untilDate })
  } else if (recurrence.rangeEnd === 'count' && recurrence.count != null) {
    end = t('tasks.recurrence.endCount', { count: recurrence.count })
  }

  return (
    <div className="rounded-md border border-border/80 bg-muted/30 px-2.5 py-2 text-xs text-muted-foreground">
      <div className="flex items-center gap-1.5 font-medium text-foreground">
        <Repeat2 className="h-3.5 w-3.5 shrink-0" />
        {freqLabel(t, recurrence.frequency)}
      </div>
      <p className="mt-1">{end}</p>
      {recurrenceLocalOnly ? (
        <p className="mt-1 text-[10px] leading-snug">{t('tasks.recurrence.googleLocalHint')}</p>
      ) : null}
    </div>
  )
}

export function TaskRecurrenceSummaryFromItem({ task }: { task: TaskItemRow }): JSX.Element | null {
  if (!task.recurrence) return null
  return (
    <TaskRecurrenceSummary
      recurrence={task.recurrence}
      recurrenceLocalOnly={task.recurrenceLocalOnly}
    />
  )
}
