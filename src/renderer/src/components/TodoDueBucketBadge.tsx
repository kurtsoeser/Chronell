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
        'inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium',
        badgeToneClass(kind),
        className
      )}
      title={title}
    >
      <Icon className="h-3 w-3 shrink-0" aria-hidden />
      {!compact && <span className="max-w-[5.5rem] truncate">{shortLabel}</span>}
    </span>
  )
}
