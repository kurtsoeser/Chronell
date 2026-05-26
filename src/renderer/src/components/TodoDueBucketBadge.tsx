import type { TodoDueKindList } from '@shared/types'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { TODO_DUE_BUCKET_ICONS } from '@/lib/todo-due-bucket-icons'

interface Props {
  kind: TodoDueKindList
  /** Nur Icon, kein Kurztext. */
  compact?: boolean
  className?: string
}

/**
 * ToDo-Faelligkeit wie Schnellzugriff (Icon + Kurzlabel), Tooltip mit vollem Titel.
 */
function badgeToneClass(kind: TodoDueKindList): string {
  if (kind === 'overdue') return 'bg-destructive/15 text-destructive'
  if (kind === 'done') return 'bg-status-done/15 text-status-done'
  return 'bg-status-todo/15 text-status-todo'
}

export function TodoDueBucketBadge({ kind, compact = false, className }: Props): JSX.Element {
  const { t } = useTranslation()
  const Icon = TODO_DUE_BUCKET_ICONS[kind]
  const title = t(`mail.todoBucket.${kind}`)
  const shortLabel = t(`mail.todoNav.${kind}`)
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-0.5 rounded px-1 py-px text-2xs font-medium leading-tight',
        badgeToneClass(kind),
        className
      )}
      title={title}
    >
      <Icon className="h-2.5 w-2.5 shrink-0" aria-hidden />
      {!compact && <span className="max-w-[4.25rem] truncate">{shortLabel}</span>}
    </span>
  )
}
