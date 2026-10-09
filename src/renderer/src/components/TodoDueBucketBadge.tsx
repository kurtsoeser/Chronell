import type { TodoDueKindList } from '@shared/types'
import { useTranslation } from 'react-i18next'
import { chronellPillBadgeClass } from '@/lib/chronell-ui-classes'
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
  if (kind === 'overdue') {
    return 'bg-destructive/18 text-destructive'
  }
  if (kind === 'done') {
    return 'bg-status-done/15 text-status-done'
  }
  if (kind === 'today') {
    return 'bg-primary/18 text-primary'
  }
  if (kind === 'this_week') {
    return 'bg-sky-500/12 text-sky-700 dark:text-sky-300'
  }
  if (kind === 'tomorrow') {
    return 'bg-violet-500/12 text-violet-700 dark:text-violet-300'
  }
  return 'bg-muted/70 text-muted-foreground'
}

export function TodoDueBucketBadge({ kind, compact = false, className }: Props): JSX.Element {
  const { t } = useTranslation()
  const Icon = TODO_DUE_BUCKET_ICONS[kind]
  const title = t(`mail.todoBucket.${kind}`)
  const shortLabel = t(`mail.todoNav.${kind}`)
  return (
    <span
      className={cn(chronellPillBadgeClass, badgeToneClass(kind), className)}
      title={title}
    >
      <Icon className="h-2 w-2 shrink-0" aria-hidden />
      {!compact && <span className="max-w-[3.5rem] truncate">{shortLabel}</span>}
    </span>
  )
}
