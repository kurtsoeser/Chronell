import { useCallback, useEffect, useMemo, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { Virtuoso } from 'react-virtuoso'
import { CheckCircle2, ChevronDown, ChevronRight, Circle, Mail } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { format, parseISO } from 'date-fns'
import { useDateFnsLocale } from '@/lib/date-fns-locale'
import type { ConnectedAccount } from '@shared/types'
import type { WorkItem } from '@shared/work-item'
import { cn } from '@/lib/utils'
import { resolvedAccountColorCss } from '@/lib/avatar-color'
import { AccountColorStripe } from '@/components/AccountColorStripe'
import { TodoDueBucketBadge } from '@/components/TodoDueBucketBadge'
import {
  computeWorkItemListLayout,
  workListGroupCollapseKey,
  type WorkListArrangeBy,
  type WorkListArrangeContext,
  type WorkListChronoOrder,
  type WorkListFilter
} from '@/app/work-items/work-item-list-arrange'
import { workItemsToViews } from '@/app/work-items/work-item-mapper'
import { GROUPED_LIST_VIRTUALIZE_THRESHOLD } from '@/lib/grouped-list-virtuoso'
import { dueDateInputValue } from '@/app/work-items/work-item-datetime'
import {
  mailReadingPopoutOptsFromClick,
  openMailReadingPopout
} from '@/lib/open-mail-reading-popout'
import { useTasksSettingsPrefs } from '@/lib/use-tasks-settings-prefs'
import { resolveTaskOverdueRowStyle } from '@/lib/task-row-overdue-style'

function dueDateLabel(dueIso: string | null): string {
  return dueIso ? dueDateInputValue(dueIso) : ''
}

export interface WorkItemsGroupedListProps {
  items: WorkItem[]
  accounts: ConnectedAccount[]
  arrange: WorkListArrangeBy
  chrono: WorkListChronoOrder
  filter: WorkListFilter
  selectedKey: string | null
  checkedKeys: Set<string>
  onSelect: (item: WorkItem) => void
  onItemClick: (item: WorkItem, event: ReactMouseEvent) => void
  onToggleCompleted: (item: WorkItem) => void
  onContextMenu?: (item: WorkItem, event: ReactMouseEvent) => void
}

export function WorkItemsGroupedList({
  items,
  accounts,
  arrange,
  chrono,
  filter,
  selectedKey,
  checkedKeys,
  onSelect,
  onItemClick,
  onToggleCompleted,
  onContextMenu
}: WorkItemsGroupedListProps): JSX.Element {
  const { t, i18n } = useTranslation()
  const tasksSettings = useTasksSettingsPrefs()
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const accountById = useMemo(() => new Map(accounts.map((a) => [a.id, a] as const)), [accounts])
  const itemByKey = useMemo(() => new Map(items.map((i) => [i.stableKey, i] as const)), [items])
  const dfLocale = useDateFnsLocale()

  const arrangeCtx = useMemo((): WorkListArrangeContext => {
    return {
      accountLabel: (accountId: string): string => {
        const a = accountById.get(accountId)
        return a?.displayName?.trim() || a?.email || accountId
      },
      todoBucketLabel: (kind) => t(`mail.todoBucket.${kind}` as const),
      noDueLabel: t('work.listArrange.noDue'),
      openLabel: t('work.listArrange.statusOpen'),
      doneLabel: t('work.listArrange.statusDone'),
      mailSourceLabel: t('work.listArrange.sourceMail'),
      formatCalendarDayGroupLabel: (dayKey: string): string => {
        try {
          return format(parseISO(`${dayKey}T12:00:00`), 'EEEE, d. MMMM yyyy', { locale: dfLocale })
        } catch {
          return dayKey
        }
      }
    }
  }, [accountById, t, dfLocale])

  const views = useMemo(
    () => workItemsToViews(items, accountById, timeZone),
    [items, accountById, timeZone]
  )

  const groups = useMemo(
    () => computeWorkItemListLayout(views, arrange, chrono, filter, arrangeCtx),
    [views, arrange, chrono, filter, arrangeCtx]
  )

  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set())

  useEffect(() => {
    setCollapsed(new Set())
  }, [arrange])

  function toggleGroup(collapseKey: string): void {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(collapseKey)) next.delete(collapseKey)
      else next.add(collapseKey)
      return next
    })
  }

  const flat = arrange === 'none'

  const renderWorkRow = useCallback(
    (item: WorkItem): JSX.Element | null => {
      const view = workItemsToViews([item], accountById, timeZone)[0]
      if (!view) return null
      const active = selectedKey === view.stableKey
      const checked = checkedKeys.has(view.stableKey)
      const acc = accountById.get(view.accountId)
      const accountStripe = acc ? resolvedAccountColorCss(acc.color) : undefined
      const overdueStyle =
        !view.completed && view.bucket === 'overdue'
          ? resolveTaskOverdueRowStyle(
              { dueIso: view.dueAtIso, completed: view.completed },
              tasksSettings,
              timeZone,
              accountStripe
            )
          : { stripeColor: accountStripe, rowStyle: undefined }
      const isMail = view.kind === 'mail_todo'
      return (
        <div
          key={view.stableKey}
          style={overdueStyle.rowStyle}
          className={cn(
            'relative border-b border-border/60',
            checked && 'bg-primary/8',
            active && !checked && !overdueStyle.rowStyle && 'bg-secondary/30'
          )}
          onContextMenu={
            onContextMenu ? (e): void => onContextMenu(item, e) : undefined
          }
        >
          {overdueStyle.stripeColor ? (
            <span
              className="pointer-events-none absolute left-0 top-1 bottom-1 w-0.5 rounded-full opacity-90"
              style={{ backgroundColor: overdueStyle.stripeColor }}
              aria-hidden
            />
          ) : acc ? (
            <AccountColorStripe
              color={acc.color}
              className="left-0 top-1 bottom-1 w-0.5 rounded-full opacity-70"
            />
          ) : null}
          <div className="flex items-start gap-1.5 px-2">
            <button
              type="button"
              onClick={(e): void => onItemClick(item, e)}
              onDoubleClick={(e): void => {
                if (!isMail) {
                  onSelect(item)
                  return
                }
                e.stopPropagation()
                if (item.kind === 'mail_todo') {
                  openMailReadingPopout(item.messageId, mailReadingPopoutOptsFromClick(e))
                }
              }}
              className={cn(
                'min-w-0 flex-1 py-2 pl-1 pr-1 text-left text-xs',
                active ? 'font-semibold text-foreground' : 'text-foreground/90',
                view.completed && 'text-muted-foreground line-through'
              )}
            >
              <span className="line-clamp-2">{view.title}</span>
              <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground">
                {isMail ? <Mail className="h-3 w-3 shrink-0 opacity-70" aria-hidden /> : null}
                {view.dueAtIso ? <span>{dueDateLabel(view.dueAtIso)}</span> : null}
                <span className="truncate">{view.sourceLabel}</span>
              </span>
            </button>
            <button
              type="button"
              title={view.completed ? t('work.shell.markOpen') : t('work.shell.markDone')}
              onClick={(e): void => {
                e.stopPropagation()
                onToggleCompleted(item)
              }}
              className="shrink-0 self-start py-2 pl-0.5 text-muted-foreground hover:text-foreground"
            >
              {view.completed ? (
                <CheckCircle2 className="h-4 w-4 text-primary" aria-hidden />
              ) : (
                <Circle className="h-4 w-4" aria-hidden />
              )}
            </button>
          </div>
        </div>
      )
    },
    [accountById, checkedKeys, onContextMenu, onItemClick, onSelect, onToggleCompleted, selectedKey, t, timeZone, tasksSettings]
  )

  if (groups.length === 0) {
    return <p className="p-4 text-xs text-muted-foreground">{t('work.shell.emptyFiltered')}</p>
  }

  if (flat && items.length >= GROUPED_LIST_VIRTUALIZE_THRESHOLD) {
    return (
      <div className="h-full min-h-0">
        <Virtuoso
          style={{ height: '100%' }}
          totalCount={items.length}
          itemContent={(index): JSX.Element | null => renderWorkRow(items[index]!)}
        />
      </div>
    )
  }

  return (
    <div>
      {groups.map((group) => {
        const collapseKey = workListGroupCollapseKey(arrange, group)
        const isCollapsed = !flat && collapsed.has(collapseKey)
        return (
          <section key={collapseKey}>
            {!flat && group.label ? (
              <button
                type="button"
                aria-expanded={!isCollapsed}
                className="sticky top-0 z-[1] flex w-full items-center gap-1.5 border-b border-border/60 bg-card/95 px-2 py-1.5 text-left backdrop-blur hover:bg-muted/20"
                onClick={(): void => toggleGroup(collapseKey)}
              >
                {isCollapsed ? (
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                )}
                {group.todoKind != null ? (
                  <TodoDueBucketBadge kind={group.todoKind} />
                ) : (
                  <span className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {group.label}
                  </span>
                )}
                <span className="ml-auto text-2xs tabular-nums text-muted-foreground">
                  {group.items.length}
                </span>
              </button>
            ) : null}
            {!isCollapsed ? (
              <ul>
                {group.items.map((view) => {
                  const item = itemByKey.get(view.stableKey)
                  if (!item) return null
                  const active = selectedKey === view.stableKey
                  const checked = checkedKeys.has(view.stableKey)
                  const acc = accountById.get(view.accountId)
                  const stripe = acc ? resolvedAccountColorCss(acc.color) : undefined
                  const isMail = view.kind === 'mail_todo'
                  return (
                    <li
                      key={view.stableKey}
                      className={cn(
                        'relative border-b border-border/60',
                        checked && 'bg-primary/8',
                        active && !checked && 'bg-secondary/30'
                      )}
                      onContextMenu={
                        onContextMenu
                          ? (e): void => onContextMenu(item, e)
                          : undefined
                      }
                    >
                      {acc ? (
                        <AccountColorStripe
                          color={acc.color}
                          className="left-0 top-1 bottom-1 w-0.5 rounded-full opacity-70"
                        />
                      ) : stripe ? (
                        <span
                          className="pointer-events-none absolute left-0 top-1 bottom-1 w-0.5 rounded-full opacity-70"
                          style={{ backgroundColor: stripe }}
                          aria-hidden
                        />
                      ) : null}
                      <div className="flex items-start gap-1.5 px-2">
                        <button
                          type="button"
                          onClick={(e): void => onItemClick(item, e)}
                          onDoubleClick={(e): void => {
                if (!isMail) {
                  onSelect(item)
                  return
                }
                e.stopPropagation()
                if (item.kind === 'mail_todo') {
                  openMailReadingPopout(item.messageId, mailReadingPopoutOptsFromClick(e))
                }
              }}
                          className={cn(
                            'min-w-0 flex-1 py-2 pl-1 pr-1 text-left text-xs',
                            active ? 'font-semibold text-foreground' : 'text-foreground/90',
                            view.completed && 'text-muted-foreground line-through'
                          )}
                        >
                          <span className="line-clamp-2">{view.title}</span>
                          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground">
                            {isMail ? (
                              <Mail className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
                            ) : null}
                            {view.dueAtIso ? <span>{dueDateLabel(view.dueAtIso)}</span> : null}
                            <span className="truncate">{view.sourceLabel}</span>
                          </span>
                        </button>
                        <button
                          type="button"
                          title={
                            view.completed ? t('work.shell.markOpen') : t('work.shell.markDone')
                          }
                          onClick={(e): void => {
                            e.stopPropagation()
                            onToggleCompleted(item)
                          }}
                          className="shrink-0 self-start py-2 pl-0.5 text-muted-foreground hover:text-foreground"
                        >
                          {view.completed ? (
                            <CheckCircle2 className="h-4 w-4 text-primary" aria-hidden />
                          ) : (
                            <Circle className="h-4 w-4" aria-hidden />
                          )}
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            ) : null}
          </section>
        )
      })}
    </div>
  )
}
