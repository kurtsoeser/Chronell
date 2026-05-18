import { Paperclip, Star } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { outlookCategoryDotClass } from '@/lib/outlook-category-colors'
import type { MailListTableColumnId } from '@/lib/mail-list-table-columns'
import { formatMailListDate, threadSubFirstToDisplay } from '@/lib/mail-list-format'
import type { ConnectedAccount, MailListItem } from '@shared/types'
import { TodoDueBucketBadge } from '@/components/TodoDueBucketBadge'
import { parseOpenTodoDueKind, shortTitleTodoDueBucketDe } from '@/lib/todo-due-bucket'

export function MailListTableHeader({
  columns,
  gridTemplate
}: {
  columns: MailListTableColumnId[]
  gridTemplate: string
}): JSX.Element {
  const { t } = useTranslation()
  return (
    <div
      className="grid shrink-0 items-center gap-x-1 border-b border-border bg-card/90 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur"
      style={{ gridTemplateColumns: `28px ${gridTemplate}` }}
    >
      <span aria-hidden />
      {columns.map((col) => (
        <span key={col} className="min-w-0 truncate px-1">
          {t(`mail.listTableColumns.${col}` as const)}
        </span>
      ))}
    </div>
  )
}

export interface MailTableCellCtx {
  message: MailListItem
  root: MailListItem
  senderLabel: string
  isUnread: boolean
  showPreviewInSubject: boolean
  account?: ConnectedAccount | null
}

export function MailListTableCell({
  columnId,
  ctx,
  compactCategories
}: {
  columnId: MailListTableColumnId
  ctx: MailTableCellCtx
  compactCategories?: boolean
}): JSX.Element {
  const { t } = useTranslation()
  const m = ctx.message
  const base = 'min-w-0 truncate px-1 text-[11px]'

  switch (columnId) {
    case 'from':
      return (
        <div className={cn(base, ctx.isUnread ? 'font-semibold text-foreground' : 'text-foreground/90')}>
          {ctx.senderLabel}
        </div>
      )
    case 'to': {
      const to = threadSubFirstToDisplay(m.toAddrs)
      return (
        <div className={cn(base, 'text-muted-foreground')}>{to || t('mail.list.noRecipient')}</div>
      )
    }
    case 'subject':
      return (
        <div className={cn(base, 'min-w-0', ctx.isUnread ? 'font-medium text-foreground' : 'text-foreground/90')}>
          <span className="truncate">{m.subject?.trim() || t('common.noSubject')}</span>
          {ctx.showPreviewInSubject && m.snippet ? (
            <span className="ml-1 text-muted-foreground/85">— {m.snippet}</span>
          ) : null}
        </div>
      )
    case 'preview':
      return <div className={cn(base, 'text-muted-foreground/85')}>{m.snippet ?? ''}</div>
    case 'received': {
      const iso = m.receivedAt ?? m.sentAt
      return (
        <div className={cn(base, 'text-right tabular-nums text-muted-foreground')}>
          {iso ? formatMailListDate(iso) : ''}
        </div>
      )
    }
    case 'sent': {
      const iso = m.sentAt
      return (
        <div className={cn(base, 'text-right tabular-nums text-muted-foreground')}>
          {iso ? formatMailListDate(iso) : ''}
        </div>
      )
    }
    case 'categories':
      return (
        <MailListTableCategoryCell categories={m.categories} compact={compactCategories} className={base} />
      )
    case 'importance': {
      const imp = (m.importance ?? '').toLowerCase()
      const label =
        imp === 'high'
          ? t('mail.listTableColumns.importanceHigh')
          : imp === 'low'
            ? t('mail.listTableColumns.importanceLow')
            : ''
      return <div className={cn(base, 'text-muted-foreground')}>{label}</div>
    }
    case 'attachments':
      return (
        <div className={cn(base, 'flex justify-center text-muted-foreground')}>
          {m.hasAttachments ? (
            <Paperclip className="h-3 w-3" aria-label={t('mail.listTableColumns.attachments')} />
          ) : null}
        </div>
      )
    case 'todoDue': {
      const iso = m.todoEndAt ?? m.todoStartAt
      return (
        <div className={cn(base, 'tabular-nums text-muted-foreground')}>
          {iso ? formatMailListDate(iso) : ''}
        </div>
      )
    }
    case 'todoBucket': {
      const kind = m.todoId != null ? parseOpenTodoDueKind(m.todoDueKind) : null
      if (!kind) return <div className={base} />
      return compactCategories ? (
        <TodoDueBucketBadge kind={kind} compact className="mx-1 shrink-0" />
      ) : (
        <div className={cn(base, 'text-muted-foreground')}>{shortTitleTodoDueBucketDe(kind)}</div>
      )
    }
    case 'waiting': {
      const iso = m.waitingForReplyUntil
      return (
        <div className={cn(base, 'tabular-nums text-muted-foreground')}>
          {iso ? formatMailListDate(iso) : ''}
        </div>
      )
    }
    case 'snoozed': {
      const iso = m.snoozedUntil
      return (
        <div className={cn(base, 'tabular-nums text-muted-foreground')}>
          {iso ? formatMailListDate(iso) : ''}
        </div>
      )
    }
    case 'account': {
      const label = ctx.account?.displayName ?? ctx.account?.email ?? m.accountId
      return <div className={cn(base, 'text-muted-foreground')}>{label}</div>
    }
    case 'read':
      return (
        <div className={cn(base, 'text-center text-muted-foreground')}>
          {m.isRead ? t('mail.list.read') : t('mail.list.unread')}
        </div>
      )
    default:
      return <div className={base} />
  }
}

export function MailListTableRowIcons({
  flagged,
  hasAttachments
}: {
  flagged: boolean
  hasAttachments: boolean
}): JSX.Element {
  return (
    <div className="flex w-7 shrink-0 flex-col items-center justify-center gap-0.5">
      {flagged ? (
        <Star className="h-3 w-3 fill-status-flagged text-status-flagged" aria-hidden />
      ) : (
        <span className="h-3 w-3" aria-hidden />
      )}
      {hasAttachments ? (
        <Paperclip className="h-3 w-3 text-muted-foreground" aria-hidden />
      ) : (
        <span className="h-3 w-3" aria-hidden />
      )}
    </div>
  )
}

function MailListTableCategoryCell({
  categories,
  compact,
  className
}: {
  categories?: string[]
  compact?: boolean
  className?: string
}): JSX.Element {
  const cats = (categories ?? []).map((c) => c.trim()).filter((c) => c.length > 0)
  if (cats.length === 0) return <div className={className} />
  if (compact) {
    const max = 4
    const shown = cats.slice(0, max)
    return (
      <span className={cn('inline-flex items-center gap-px', className)}>
        {shown.map((c, i) => (
          <span
            key={`${c}:${i}`}
            className={cn('h-1.5 w-1.5 rounded-full', outlookCategoryDotClass(null))}
            title={c}
          />
        ))}
        {cats.length > max ? <span className="text-[8px] text-muted-foreground">+</span> : null}
      </span>
    )
  }
  const max = 2
  const shown = cats.slice(0, max)
  return (
    <div className={cn('flex flex-wrap gap-0.5', className)}>
      {shown.map((c, i) => (
        <span
          key={`${c}:${i}`}
          title={c}
          className="inline-flex max-w-[5rem] items-center gap-0.5 truncate rounded border border-border/50 bg-secondary/30 px-1 py-px text-[9px]"
        >
          <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', outlookCategoryDotClass(null))} />
          {c}
        </span>
      ))}
      {cats.length > max ? (
        <span className="text-[9px] text-muted-foreground">+{cats.length - max}</span>
      ) : null}
    </div>
  )
}
