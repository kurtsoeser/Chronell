import { useCallback, useEffect, useMemo, useState } from 'react'
import { Circle, Loader2, Mail } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { ConnectedAccount } from '@shared/types'
import type { WorkItem } from '@shared/work-item'
import { cn } from '@/lib/utils'
import { AccountColorStripe } from '@/components/AccountColorStripe'
import { TodoDueBucketBadge } from '@/components/TodoDueBucketBadge'
import { loadMasterWorkItems } from '@/app/work-items/load-master-work-items'
import {
  computeWorkItemListLayout,
  type WorkListArrangeContext
} from '@/app/work-items/work-item-list-arrange'
import { workItemsToViews } from '@/app/work-items/work-item-mapper'
import { toggleWorkItemCompleted } from '@/app/work-items/work-item-actions'
import { dueDateInputValue } from '@/app/work-items/work-item-datetime'

const WORK_FETCH_LIMIT = 200
const WORK_TILE_MAX = 14

function dueDateLabel(dueIso: string | null): string {
  return dueIso ? dueDateInputValue(dueIso) : ''
}

interface Props {
  accounts: ConnectedAccount[]
  reloadSignal: number
  onOpenItem: (item: WorkItem) => void
  onReloaded?: () => void
}

export function DashboardWorkAllTile({
  accounts,
  reloadSignal,
  onOpenItem,
  onReloaded
}: Props): JSX.Element {
  const { t } = useTranslation()
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const taskAccounts = useMemo(
    () => accounts.filter((a) => a.provider === 'microsoft' || a.provider === 'google'),
    [accounts]
  )
  const accountById = useMemo(() => new Map(accounts.map((a) => [a.id, a] as const)), [accounts])
  const [items, setItems] = useState<WorkItem[]>([])
  const [loading, setLoading] = useState(true)

  const loadWork = useCallback(async (): Promise<void> => {
    setLoading(true)
    try {
      const { items: loaded } = await loadMasterWorkItems(taskAccounts, {
        includeCompletedMail: false
      })
      const open = loaded.filter((i) => !i.completed).slice(0, WORK_FETCH_LIMIT)
      setItems(open)
    } catch {
      setItems([])
    } finally {
      setLoading(false)
      onReloaded?.()
    }
  }, [onReloaded, taskAccounts])

  useEffect(() => {
    void loadWork()
  }, [loadWork, reloadSignal])

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
      mailSourceLabel: t('work.listArrange.sourceMail')
    }
  }, [accountById, t])

  const views = useMemo(
    () => workItemsToViews(items, accountById, timeZone),
    [items, accountById, timeZone]
  )

  const groups = useMemo(
    () => computeWorkItemListLayout(views, 'todo_bucket', 'oldest_on_top', 'open', arrangeCtx),
    [views, arrangeCtx]
  )

  const flatRows = useMemo(() => {
    const rows: { item: WorkItem; groupTodoKind: typeof groups[0]['todoKind'] }[] = []
    const itemByKey = new Map(items.map((i) => [i.stableKey, i] as const))
    for (const g of groups) {
      for (const v of g.items) {
        const item = itemByKey.get(v.stableKey)
        if (item) rows.push({ item, groupTodoKind: g.todoKind })
        if (rows.length >= WORK_TILE_MAX) return rows
      }
    }
    return rows
  }, [groups, items])

  const handleToggle = useCallback(
    async (item: WorkItem, e: React.MouseEvent): Promise<void> => {
      e.stopPropagation()
      try {
        await toggleWorkItemCompleted(item)
        await loadWork()
      } catch {
        // ignore
      }
    },
    [loadWork]
  )

  if (loading) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center gap-2 py-12 text-xs text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        {t('dashboard.loading.work')}
      </div>
    )
  }

  if (flatRows.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center px-3 py-8 text-center text-xs text-muted-foreground">
        {t('dashboard.workAll.empty')}
      </div>
    )
  }

  let lastBucket: string | null = null

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {flatRows.map(({ item, groupTodoKind }) => {
          const view = workItemsToViews([item], accountById, timeZone)[0]
          if (!view) return null
          const acc = accountById.get(view.accountId)
          const showHeader = groupTodoKind != null && groupTodoKind !== lastBucket
          if (groupTodoKind != null) lastBucket = groupTodoKind
          const isMail = view.kind === 'mail_todo'
          return (
            <li key={view.stableKey}>
              {showHeader && groupTodoKind != null ? (
                <div className="bg-muted/40 px-3 py-1.5">
                  <TodoDueBucketBadge kind={groupTodoKind} />
                </div>
              ) : null}
              <div className="relative border-b border-border/40">
                {acc ? (
                  <AccountColorStripe
                    color={acc.color}
                    className="pointer-events-none absolute left-0 top-0 bottom-0 z-[1] w-[3px] rounded-r opacity-90"
                  />
                ) : null}
                <div className="flex items-start gap-1.5 pl-1 pr-2">
                  <button
                    type="button"
                    onClick={(): void => onOpenItem(item)}
                    className="min-w-0 flex-1 py-2 pl-2 text-left text-xs hover:bg-secondary/50"
                  >
                    <span className="line-clamp-2 font-medium text-foreground">{view.title}</span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground">
                      {isMail ? <Mail className="h-3 w-3 shrink-0 opacity-70" aria-hidden /> : null}
                      {view.dueAtIso ? <span>{dueDateLabel(view.dueAtIso)}</span> : null}
                      <span className="truncate">{view.sourceLabel}</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    title={t('work.shell.markDone')}
                    onClick={(e): void => void handleToggle(item, e)}
                    className="shrink-0 self-start py-2 text-muted-foreground hover:text-foreground"
                  >
                    <Circle className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
