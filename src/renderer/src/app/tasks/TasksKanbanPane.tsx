import { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { ConnectedAccount, TodoDueKindList } from '@shared/types'
import { AccountColorStripe } from '@/components/AccountColorStripe'
import { TaskDisplayIcon } from '@/components/TaskDisplayIcon'
import {
  DueBucketKanbanBoard,
  type DueBucketKanbanCardModel
} from '@/components/due-bucket-kanban/DueBucketKanbanBoard'
import { moveCloudTaskToBucket } from '@/lib/move-todo-bucket'
import { cn } from '@/lib/utils'
import { classifyTaskItemDueBucket } from '@/app/tasks/task-due-bucket'
import {
  flattenVisibleTaskItems,
  type TaskListArrangeContext,
  type TaskListChronoOrder,
  type TaskListFilter,
  type TaskListLayoutOptions
} from '@/app/tasks/task-list-arrange'
import { isCloudTaskListItem, isMailTodoListItem, tasksListItemKey, type TasksListItem } from '@/app/tasks/tasks-types'
import { dueDateInputValue } from '@/app/work-items/work-item-datetime'
import { useTasksSettingsPrefs } from '@/lib/use-tasks-settings-prefs'
import { resolveTaskOverdueRowStyle } from '@/lib/task-row-overdue-style'

function dueDateLabel(dueIso: string | null): string {
  return dueIso ? dueDateInputValue(dueIso) : ''
}

export interface TasksKanbanPaneProps {
  items: TasksListItem[]
  accounts: ConnectedAccount[]
  filter: TaskListFilter
  chrono: TaskListChronoOrder
  arrangeCtx: TaskListArrangeContext
  layoutOpts?: TaskListLayoutOptions
  showAccountHint: boolean
  selectedKey: string | null
  onSelect: (item: TasksListItem) => void
  onTasksMutated: () => void
}

export function TasksKanbanPane({
  items,
  accounts,
  filter,
  chrono,
  arrangeCtx,
  layoutOpts,
  showAccountHint,
  selectedKey,
  onSelect,
  onTasksMutated
}: TasksKanbanPaneProps): JSX.Element {
  const { t } = useTranslation()
  const settings = useTasksSettingsPrefs()
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const accountById = useMemo(() => new Map(accounts.map((a) => [a.id, a] as const)), [accounts])

  const visible = useMemo(
    () =>
      flattenVisibleTaskItems(items, 'none', chrono, filter, arrangeCtx, timeZone, {
        overdueMode: settings.overdueMode,
        noDuePlacement: settings.noDuePlacement,
        ...layoutOpts
      }),
    [items, chrono, filter, arrangeCtx, timeZone, settings.overdueMode, settings.noDuePlacement, layoutOpts]
  )

  const itemByKey = useMemo(
    () => new Map(visible.map((item) => [tasksListItemKey(item), item] as const)),
    [visible]
  )

  const cards = useMemo((): DueBucketKanbanCardModel[] => {
    return visible.map((item) => ({
      id: tasksListItemKey(item),
      bucket: classifyTaskItemDueBucket(item, timeZone, Date.now(), settings.overdueMode),
      completed: item.completed
    }))
  }, [visible, timeZone, settings.overdueMode])

  const showDoneColumn = !settings.kanbanHideDoneColumn && (filter === 'all' || filter === 'completed')
  const hiddenBuckets = useMemo((): ReadonlySet<TodoDueKindList> | undefined => {
    if (!settings.kanbanHideDoneColumn) return undefined
    return new Set<TodoDueKindList>(['done'])
  }, [settings.kanbanHideDoneColumn])

  const handleMove = useCallback(
    async (id: string, bucket: TodoDueKindList): Promise<void> => {
      const item = itemByKey.get(id)
      if (!item || !isCloudTaskListItem(item)) return
      try {
        await moveCloudTaskToBucket(
          { accountId: item.accountId, listId: item.listId, taskId: item.id },
          bucket,
          timeZone
        )
        onTasksMutated()
      } catch {
        onTasksMutated()
      }
    },
    [itemByKey, timeZone, onTasksMutated]
  )

  return (
    <DueBucketKanbanBoard
      cards={cards}
      showDoneColumn={showDoneColumn}
      hiddenBuckets={hiddenBuckets}
      selectedId={selectedKey}
      emptyHint={t('tasks.shell.emptyFiltered')}
      onSelect={(id): void => {
        const item = itemByKey.get(id)
        if (item) onSelect(item)
      }}
      onMoveToBucket={handleMove}
      renderCard={(id): JSX.Element => {
        const item = itemByKey.get(id)
        if (!item) return <span className="text-xs text-muted-foreground">—</span>
        const acc = accountById.get(item.accountId)
        const due = dueDateLabel(item.dueIso)
        const overdueStyle = resolveTaskOverdueRowStyle(item, settings, timeZone, undefined)
        return (
          <div className="space-y-0.5" style={overdueStyle.rowStyle}>
            {overdueStyle.stripeColor ? (
              <span
                className="mb-1 block h-0.5 w-full rounded-full"
                style={{ backgroundColor: overdueStyle.stripeColor }}
              />
            ) : null}
            <p
              className={cn(
                'flex items-start gap-1 line-clamp-2 text-xs font-medium',
                item.completed && 'text-muted-foreground line-through'
              )}
            >
              {!isMailTodoListItem(item) ? (
                <TaskDisplayIcon iconId={item.iconId} iconColor={item.iconColor} />
              ) : null}
              <span className="min-w-0 flex-1">
                {item.title.trim() || t('tasks.shell.untitled')}
              </span>
            </p>
            {showAccountHint && acc ? (
              <div className="flex items-center gap-1 text-2xs text-muted-foreground">
                {settings.showAccountStripe ? (
                  <AccountColorStripe color={acc.color} className="h-3 w-0.5" />
                ) : null}
                <span className="truncate">{acc.displayName?.trim() || acc.email}</span>
              </div>
            ) : null}
            {due ? <p className="text-2xs text-muted-foreground">{due}</p> : null}
            {!showAccountHint && item.listName ? (
              <p className="truncate text-2xs text-muted-foreground">{item.listName}</p>
            ) : null}
          </div>
        )
      }}
    />
  )
}
