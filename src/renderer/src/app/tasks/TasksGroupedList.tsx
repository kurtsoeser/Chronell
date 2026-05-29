import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'

import { CheckCircle2, ChevronDown, ChevronRight, Circle, Mail } from 'lucide-react'

import { useTranslation } from 'react-i18next'

import { format, parseISO } from 'date-fns'

import { de, enUS } from 'date-fns/locale'

import type { ConnectedAccount } from '@shared/types'

import { listSubtleBorderClass } from '@/lib/chronell-ui-classes'
import { cn } from '@/lib/utils'

import { motionListItemExit } from '@/lib/motion'

import { resolvedAccountColorCss } from '@/lib/avatar-color'

import { AccountColorStripe } from '@/components/AccountColorStripe'

import { TaskDisplayIcon } from '@/components/TaskDisplayIcon'

import { TodoDueBucketBadge } from '@/components/TodoDueBucketBadge'

import {

  computeTaskListLayout,

  defaultCollapsedTaskListGroupKeys,

  isTaskListGroupCollapsedByDefault,

  taskListGroupCollapseKey,

  type TaskListArrangeBy,

  type TaskListArrangeContext,

  type TaskListChronoOrder,

  type TaskListFilter

} from '@/app/tasks/task-list-arrange'

import { setCloudTaskDragData } from '@/app/tasks/tasks-cloud-task-dnd'

import {
  isCloudTaskListItem,
  isMailTodoListItem,
  tasksListItemKey,
  type TasksListItem
} from '@/app/tasks/tasks-types'

import {

  TasksInlineCreateRow,

  type TasksInlineCreateRowProps

} from '@/app/tasks/TasksInlineCreateRow'
import { dueDateInputValue } from '@/app/work-items/work-item-datetime'
import { useTasksSettingsPrefs } from '@/lib/use-tasks-settings-prefs'
import type { TaskListLayoutOptions } from '@/app/tasks/task-list-arrange'
import { resolveTaskOverdueRowStyle } from '@/lib/task-row-overdue-style'
import { TaskCategoryBadges } from '@/components/TaskCategoryBadges'

function dueDateLabel(dueIso: string | null): string {
  return dueIso ? dueDateInputValue(dueIso) : ''
}



export interface TasksGroupedListProps {

  items: TasksListItem[]

  accounts: ConnectedAccount[]

  arrange: TaskListArrangeBy

  chrono: TaskListChronoOrder

  filter: TaskListFilter

  layoutOpts?: TaskListLayoutOptions

  showAccountHint: boolean

  selectedKey: string | null

  checkedKeys: Set<string>

  onSelect: (item: TasksListItem) => void

  onTaskClick: (item: TasksListItem, event: MouseEvent) => void

  onToggleCompleted: (item: TasksListItem) => void

  onTaskContextMenu?: (item: TasksListItem, event: MouseEvent) => void

  enableDrag?: boolean

  isItemExiting?: (key: string) => boolean

  inlineCreate?: Omit<TasksInlineCreateRowProps, 'showAccountPicker'> & {

    showAccountPicker: boolean

  }

}



export function TasksGroupedList({

  items,

  accounts,

  arrange,

  chrono,

  filter,

  showAccountHint,

  selectedKey,

  checkedKeys,

  onSelect,

  onTaskClick,

  onToggleCompleted,

  onTaskContextMenu,

  enableDrag = false,

  isItemExiting,

  layoutOpts,

  inlineCreate

}: TasksGroupedListProps): JSX.Element {

  const { t, i18n } = useTranslation()
  const settings = useTasksSettingsPrefs()

  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone

  const accountById = useMemo(() => new Map(accounts.map((a) => [a.id, a] as const)), [accounts])

  const [categoryColorByAccountId, setCategoryColorByAccountId] = useState<
    Map<string, Map<string, string>>
  >(() => new Map())

  useEffect(() => {
    const msAccounts = accounts.filter((a) => a.provider === 'microsoft')
    if (msAccounts.length === 0) {
      setCategoryColorByAccountId(new Map())
      return
    }
    let cancelled = false
    void Promise.all(
      msAccounts.map(async (acc) => {
        try {
          const masters = await window.mailClient.mail.listMasterCategories(acc.id)
          const colorByName = new Map<string, string>()
          for (const m of masters) colorByName.set(m.displayName, m.color)
          return [acc.id, colorByName] as const
        } catch {
          return [acc.id, new Map<string, string>()] as const
        }
      })
    ).then((entries) => {
      if (cancelled) return
      setCategoryColorByAccountId(new Map(entries))
    })
    return (): void => {
      cancelled = true
    }
  }, [accounts])

  const dfLocale = i18n.language.startsWith('de') ? de : enUS



  const arrangeCtx = useMemo((): TaskListArrangeContext => {

    return {

      accountLabel: (accountId: string): string => {

        const a = accountById.get(accountId)

        return a?.displayName?.trim() || a?.email || accountId

      },

      todoBucketLabel: (kind) => t(`mail.todoBucket.${kind}` as const),

      noDueLabel: t('tasks.listArrange.noDue'),

      openLabel: t('tasks.listArrange.statusOpen'),

      doneLabel: t('tasks.listArrange.statusDone'),
      typeMailLabel: t('tasks.listArrange.typeMail'),
      typeTaskLabel: t('tasks.listArrange.typeTask'),
      mailSourceLabel: t('tasks.listArrange.mailSource'),

      formatCalendarDayGroupLabel: (dayKey: string): string => {

        try {

          return format(parseISO(`${dayKey}T12:00:00`), 'EEEE, d. MMMM yyyy', { locale: dfLocale })

        } catch {

          return dayKey

        }

      }

    }

  }, [accountById, t, dfLocale])



  const groups = useMemo(

    () =>
      computeTaskListLayout(items, arrange, chrono, filter, arrangeCtx, timeZone, {
        overdueMode: settings.overdueMode,
        noDuePlacement: settings.noDuePlacement,
        ...layoutOpts
      }),

    [items, arrange, chrono, filter, arrangeCtx, timeZone, settings.overdueMode, settings.noDuePlacement, layoutOpts]

  )



  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set())
  const userToggledCollapseRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    userToggledCollapseRef.current = new Set()
    setCollapsed(defaultCollapsedTaskListGroupKeys(arrange, groups, settings.collapsedGroupsMode))
  }, [arrange, settings.collapsedGroupsMode])

  useEffect(() => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      for (const group of groups) {
        if (!isTaskListGroupCollapsedByDefault(arrange, group, settings.collapsedGroupsMode)) {
          continue
        }
        const key = taskListGroupCollapseKey(arrange, group)
        if (userToggledCollapseRef.current.has(key)) continue
        next.add(key)
      }
      return next
    })
  }, [groups, arrange, settings.collapsedGroupsMode])

  function toggleGroup(collapseKey: string): void {
    userToggledCollapseRef.current.add(collapseKey)
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(collapseKey)) next.delete(collapseKey)
      else next.add(collapseKey)
      return next
    })
  }



  const flat = arrange === 'none'

  const filteredEmpty = groups.length === 0 && items.length > 0



  return (

    <div>

      {filteredEmpty ? (

        <p className="p-4 text-xs text-muted-foreground">{t('tasks.shell.emptyFiltered')}</p>

      ) : null}

      {groups.map((group) => {

        const collapseKey = taskListGroupCollapseKey(arrange, group)

        const isCollapsed = !flat && collapsed.has(collapseKey)

        return (

          <section key={collapseKey}>

            {!flat && group.label ? (

              <button

                type="button"

                aria-expanded={!isCollapsed}

                className={cn(
                  'sticky top-0 z-[1] flex w-full items-center gap-1.5 border-b bg-card/95 px-2 py-1.5 text-left backdrop-blur hover:bg-muted/20',
                  listSubtleBorderClass
                )}

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

                {group.items.map((task) => {

                  const key = tasksListItemKey(task)

                  const active = selectedKey === key

                  const checked = checkedKeys.has(key)

                  const acc = accountById.get(task.accountId)

                  const accountStripe =
                    settings.showAccountStripe && acc
                      ? resolvedAccountColorCss(acc.color)
                      : undefined
                  const overdueStyle = resolveTaskOverdueRowStyle(
                    task,
                    settings,
                    timeZone,
                    accountStripe
                  )
                  const isMail = isMailTodoListItem(task)
                  const taskCategories =
                    !isMail && isCloudTaskListItem(task) ? task.categories : undefined
                  const taskCategoryColors = categoryColorByAccountId.get(task.accountId)
                  const dragEnabled = enableDrag && settings.listDragEnabled && !isMail

                  return (

                    <li

                      key={key}

                      draggable={dragEnabled}

                      onDragStart={

                        dragEnabled && !isMail

                          ? (e): void => {

                              if (e.dataTransfer && task.source === 'cloud') {
                                setCloudTaskDragData(e.dataTransfer, task)
                              }

                            }

                          : undefined

                      }

                      onClick={(e): void => onTaskClick(task, e)}

                      onContextMenu={
                        onTaskContextMenu
                          ? (e): void => onTaskContextMenu(task, e)
                          : undefined
                      }

                      onDoubleClick={(): void => onSelect(task)}

                      style={overdueStyle.rowStyle}

                      className={cn(

                        'relative cursor-default border-b select-none',
                        listSubtleBorderClass,

                        checked && 'bg-primary/8',

                        active && !checked && !overdueStyle.rowStyle && 'bg-secondary/30',

                        dragEnabled && 'cursor-grab active:cursor-grabbing',

                        isItemExiting?.(key) && motionListItemExit

                      )}

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

                        <div

                          className={cn(

                            'min-w-0 flex-1 pl-1 pr-1 text-xs',
                            settings.compactListRows ? 'py-1' : 'py-2',

                            active ? 'font-semibold text-foreground' : 'text-foreground/90',

                            task.completed && 'text-muted-foreground line-through'

                          )}

                        >

                          <span className="flex items-start gap-1.5 line-clamp-2">

                            {isMail ? (
                              <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                            ) : (
                              <TaskDisplayIcon iconId={task.iconId} iconColor={task.iconColor} />
                            )}

                            <span className="min-w-0 flex-1">{task.title}</span>

                          </span>

                          {taskCategories?.length ? (
                            <TaskCategoryBadges
                              categories={taskCategories}
                              categoryColorByName={taskCategoryColors}
                              compact={settings.compactListRows}
                              className="mt-0.5"
                            />
                          ) : null}

                          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-2xs text-muted-foreground">

                            {task.dueIso ? <span>{dueDateLabel(task.dueIso)}</span> : null}

                            {showAccountHint ? (

                              <span className="truncate">

                                {acc?.displayName?.trim() || acc?.email || task.accountId}

                                {task.listName ? ` · ${task.listName}` : ''}

                              </span>

                            ) : task.listName ? (

                              <span className="truncate">{task.listName}</span>

                            ) : null}

                          </span>

                        </div>

                        <button

                          type="button"

                          title={

                            task.completed ? t('tasks.shell.markOpen') : t('tasks.shell.markDone')

                          }

                          onClick={(e): void => {

                            e.stopPropagation()

                            onToggleCompleted(task)

                          }}

                          onMouseDown={(e): void => e.stopPropagation()}

                          className={cn(
                            'shrink-0 self-start pl-0.5 text-muted-foreground hover:text-foreground',
                            settings.compactListRows ? 'py-1' : 'py-2'
                          )}

                        >

                          {task.completed ? (

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

      {inlineCreate ? (

        <ul>

          <TasksInlineCreateRow {...inlineCreate} />

        </ul>

      ) : null}

    </div>

  )

}


