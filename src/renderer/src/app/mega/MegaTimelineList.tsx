import { useCallback, useEffect, useState } from 'react'
import { Calendar, CheckSquare, ChevronDown, ChevronRight, Mail, Square, type LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { ConnectedAccount } from '@shared/types'
import type { WorkItem } from '@shared/work-item'
import { MIME_THREAD_IDS } from '@/lib/workflow-dnd'
import { setCloudTaskDragData } from '@/app/tasks/tasks-cloud-task-dnd'
import { cn } from '@/lib/utils'
import { resolvedAccountColorCss } from '@/lib/avatar-color'
import { AccountColorStripe } from '@/components/AccountColorStripe'
import { TodoDueBucketBadge } from '@/components/TodoDueBucketBadge'
import { classifyWorkItemBucket } from '@/app/work-items/work-item-bucket'
import { workItemSourceLabel } from '@/app/work-items/work-item-mapper'
import type { MegaDayGroup } from '@/app/mega/mega-timeline-arrange'
import { megaItemTimeLabel } from '@/app/mega/mega-timeline-label'
import type { TaskListArrangeBy } from '@/app/tasks/task-list-arrange'

function kindIconComponent(item: WorkItem): LucideIcon {
  if (item.kind === 'mail_todo') return Mail
  if (item.kind === 'calendar_event') return Calendar
  /** Cloud-Aufgabe; bei Mail-Verknüpfung ebenfalls Mail-Symbol (inhaltlich aus Postfach). */
  if (item.kind === 'cloud_task' && item.linkedMessageIds.length > 0) return Mail
  return Square
}

function toggleCompletedAriaLabel(
  item: WorkItem,
  completed: boolean,
  t: (key: string) => string
): string {
  if (item.kind === 'calendar_event') {
    return completed ? t('mega.shell.markAppointmentOpen') : t('mega.shell.markAppointmentDone')
  }
  if (item.kind === 'mail_todo') {
    return completed ? t('mega.shell.markMailTodoOpen') : t('mega.shell.markMailTodoDone')
  }
  return completed ? t('mega.shell.markTaskOpen') : t('mega.shell.markTaskDone')
}

export interface MegaTimelineListProps {
  groups: MegaDayGroup[]
  arrange: TaskListArrangeBy
  accounts: ConnectedAccount[]
  selectedKey: string | null
  onSelect: (item: WorkItem) => void
  onItemClick: (item: WorkItem) => void
  onToggleCompleted?: (item: WorkItem) => void
  onContextMenu?: (item: WorkItem, event: React.MouseEvent) => void
}

export function MegaTimelineList({
  groups,
  arrange,
  accounts,
  selectedKey,
  onSelect,
  onItemClick,
  onToggleCompleted,
  onContextMenu
}: MegaTimelineListProps): JSX.Element {
  const { t, i18n } = useTranslation()
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const accountById = new Map(accounts.map((a) => [a.id, a] as const))
  const flat = arrange === 'none'

  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set())

  useEffect(() => {
    setCollapsed(new Set())
  }, [arrange])

  const toggleGroup = useCallback((collapseKey: string): void => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(collapseKey)) next.delete(collapseKey)
      else next.add(collapseKey)
      return next
    })
  }, [])

  if (groups.length === 0) {
    return (
      <p className="p-4 text-xs text-muted-foreground">{t('mega.shell.emptyFiltered')}</p>
    )
  }

  return (
    <ul className="divide-y divide-border">
      {groups.map((group) => {
        const isCollapsed = !flat && collapsed.has(group.groupCollapseKey)
        const showHeader = !flat && group.dayLabel.trim().length > 0
        return (
        <li key={group.dayKey}>
          {showHeader ? (
            <button
              type="button"
              aria-expanded={!isCollapsed}
              className="sticky top-0 z-[1] flex w-full items-center gap-1.5 border-b border-border bg-card/95 px-3 py-1.5 text-left backdrop-blur-sm hover:bg-muted/20"
              onClick={(): void => toggleGroup(group.groupCollapseKey)}
            >
              {isCollapsed ? (
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
              ) : (
                <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
              )}
              {group.todoKind != null ? (
                <TodoDueBucketBadge kind={group.todoKind} />
              ) : (
                <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {group.dayLabel}
                </span>
              )}
              <span className="ml-auto text-[10px] tabular-nums text-muted-foreground">
                {group.itemCount}
              </span>
            </button>
          ) : null}
          {!isCollapsed ? (
          <ul>
            {group.items.map((item) => {
              const KindIcon = kindIconComponent(item)
              const active = selectedKey === item.stableKey
              const account = accountById.get(item.accountId)
              const accountColorCss = account ? resolvedAccountColorCss(account.color) : undefined
              const bucket = classifyWorkItemBucket(item, timeZone)
              const canToggle = Boolean(onToggleCompleted)
              const showBucketBadge = item.kind !== 'calendar_event' || arrange === 'todo_bucket'
              const draggable = item.kind === 'mail_todo' || item.kind === 'cloud_task'
              const onDragStart = (e: React.DragEvent): void => {
                if (!draggable || !e.dataTransfer) return
                if (item.kind === 'mail_todo') {
                  const id = String(item.messageId)
                  e.dataTransfer.setData(MIME_THREAD_IDS, JSON.stringify([item.messageId]))
                  e.dataTransfer.setData('text/plain', id)
                  e.dataTransfer.setData('text/mailclient-message-id', id)
                  e.dataTransfer.setData('application/x-mailclient-message-id', id)
                  e.dataTransfer.effectAllowed = 'move'
                  return
                }
                if (item.kind === 'cloud_task') {
                  setCloudTaskDragData(e.dataTransfer, {
                    accountId: item.accountId,
                    listId: item.listId,
                    id: item.task.id
                  })
                }
              }
              return (
                <li key={item.stableKey}>
                  <div
                    role="button"
                    tabIndex={0}
                    draggable={draggable}
                    onDragStart={onDragStart}
                    className={cn(
                      'group relative flex w-full cursor-pointer items-start gap-2 border-b border-border/40 px-3 py-2 text-left transition-colors',
                      draggable && 'cursor-grab active:cursor-grabbing',
                      active ? 'bg-primary/10' : 'hover:bg-secondary/40'
                    )}
                    onClick={(): void => {
                      onSelect(item)
                      onItemClick(item)
                    }}
                    onContextMenu={
                      onContextMenu
                        ? (e): void => {
                            e.preventDefault()
                            onContextMenu(item, e)
                          }
                        : undefined
                    }
                  >
                    {account ? (
                      <AccountColorStripe
                        color={account.color}
                        className="absolute bottom-1 left-0 top-1 w-0.5 rounded-full"
                      />
                    ) : null}
                    <div className="mt-0.5 shrink-0">
                      <span
                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-secondary/50 ring-1 ring-border/60"
                        style={
                          accountColorCss
                            ? { color: accountColorCss, boxShadow: `inset 0 0 0 1px ${accountColorCss}33` }
                            : undefined
                        }
                        aria-hidden
                      >
                        <KindIcon
                          className={cn(
                            'h-3.5 w-3.5',
                            !accountColorCss && 'text-muted-foreground'
                          )}
                        />
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={cn(
                            'truncate text-xs font-medium',
                            item.completed && 'text-muted-foreground line-through'
                          )}
                        >
                          {item.title}
                        </span>
                        {showBucketBadge && bucket !== 'done' ? (
                          <TodoDueBucketBadge kind={bucket} />
                        ) : null}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground">
                        <span>{megaItemTimeLabel(item, i18n.language)}</span>
                        <span className="opacity-60">·</span>
                        <span className="truncate">{workItemSourceLabel(item, accountById)}</span>
                      </div>
                    </div>
                    {canToggle ? (
                      <button
                        type="button"
                        draggable={false}
                        title={toggleCompletedAriaLabel(item, item.completed, t)}
                        className="ml-1 shrink-0 self-center rounded p-1 text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                        aria-label={toggleCompletedAriaLabel(item, item.completed, t)}
                        onClick={(e): void => {
                          e.stopPropagation()
                          onToggleCompleted?.(item)
                        }}
                      >
                        <CheckSquare
                          className={cn(
                            'h-4 w-4',
                            item.completed && 'fill-emerald-500/20 text-emerald-500'
                          )}
                        />
                      </button>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ul>
          ) : null}
        </li>
        )
      })}
    </ul>
  )
}
