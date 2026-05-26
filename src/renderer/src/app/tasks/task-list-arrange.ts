import type { ConnectedAccount, TodoDueKindList } from '@shared/types'
import { format, parseISO } from 'date-fns'
import { dateBucketFor } from '@/lib/mail-list-arrange'
import { groupLabelTodoDueBucketDe, rankOpenTodoBucket } from '@/lib/todo-due-bucket'
import { classifyTaskItemDueBucket } from '@/app/tasks/task-due-bucket'
import { isMailTodoListItem, type TasksListItem } from '@/app/tasks/tasks-types'
import type { TasksCollapsedGroupsMode, TasksNoDuePlacement, TasksOverdueMode } from '@/lib/tasks-settings-prefs'

export type TaskListArrangeBy =
  | 'calendar_day'
  | 'todo_bucket'
  | 'due_date'
  | 'item_type'
  | 'title'
  | 'account'
  | 'list'
  | 'status'
  | 'none'

export type TaskListFilter = 'all' | 'open' | 'completed' | 'overdue'

export type TaskListChronoOrder = 'newest_on_top' | 'oldest_on_top'

export interface TaskListGroup {
  key: string
  label: string
  todoKind: TodoDueKindList | null
  items: TasksListItem[]
}

export interface TaskListArrangeContext {
  accountLabel: (accountId: string) => string
  todoBucketLabel?: (kind: TodoDueKindList) => string
  noDueLabel: string
  openLabel: string
  doneLabel: string
  typeMailLabel?: string
  typeTaskLabel?: string
  mailSourceLabel?: string
  /** Gruppe „Kalendertag“: Überschrift aus yyyy-MM-dd (Tasks-Liste). */
  formatCalendarDayGroupLabel?: (dayKeyYyyyMmDd: string) => string
}

function dueSortKey(dueIso: string | null): string {
  if (!dueIso?.trim()) return 'zzzz-no-due'
  return dueIso.trim()
}

export function compareTaskItems(
  a: TasksListItem,
  b: TasksListItem,
  chrono: TaskListChronoOrder
): number {
  const ad = dueSortKey(a.dueIso)
  const bd = dueSortKey(b.dueIso)
  if (ad !== bd) {
    const newer = ad > bd
    if (chrono === 'newest_on_top') return newer ? -1 : 1
    return newer ? 1 : -1
  }
  return a.title.localeCompare(b.title, 'de', { sensitivity: 'base' })
}

function filterTasks(
  items: TasksListItem[],
  filter: TaskListFilter,
  timeZone: string,
  overdueMode: TasksOverdueMode
): TasksListItem[] {
  return items.filter((item) => {
    switch (filter) {
      case 'all':
        return true
      case 'open':
        return !item.completed
      case 'completed':
        return item.completed
      case 'overdue': {
        if (item.completed) return false
        const kind = classifyTaskItemDueBucket(item, timeZone, Date.now(), overdueMode)
        return kind === 'overdue'
      }
      default:
        return true
    }
  })
}

function hideNoDueItems(
  items: TasksListItem[],
  arrange: TaskListArrangeBy,
  noDuePlacement: TasksNoDuePlacement
): TasksListItem[] {
  if (noDuePlacement !== 'hide') return items
  if (arrange !== 'calendar_day' && arrange !== 'due_date') return items
  return items.filter((item) => Boolean(item.dueIso?.trim()))
}

function bucketKey(label: string, sortKey: string | number): string {
  return `${typeof sortKey === 'number' ? `n:${sortKey}` : `s:${sortKey}`}\t${label}`
}

function groupKeyForItem(
  item: TasksListItem,
  arrange: TaskListArrangeBy,
  ctx: TaskListArrangeContext,
  timeZone: string,
  overdueMode: TasksOverdueMode
): { key: string; label: string; sortKey: string | number; todoKind: TodoDueKindList | null } {
  switch (arrange) {
    case 'item_type': {
      if (isMailTodoListItem(item)) {
        return {
          key: 'mail_todo',
          label: ctx.typeMailLabel ?? ctx.mailSourceLabel ?? 'Mail-ToDo',
          sortKey: 1,
          todoKind: null
        }
      }
      return {
        key: 'cloud_task',
        label: ctx.typeTaskLabel ?? 'Aufgaben',
        sortKey: 2,
        todoKind: null
      }
    }
    case 'todo_bucket': {
      const kind = classifyTaskItemDueBucket(item, timeZone, Date.now(), overdueMode)
      const label = ctx.todoBucketLabel
        ? ctx.todoBucketLabel(kind)
        : groupLabelTodoDueBucketDe(kind)
      return { key: kind, label, sortKey: rankOpenTodoBucket(kind), todoKind: kind }
    }
    case 'due_date': {
      if (!item.dueIso?.trim()) {
        return {
          key: 'no-due',
          label: ctx.noDueLabel,
          sortKey: 'zzzz-no-due',
          todoKind: null
        }
      }
      const b = dateBucketFor(item.dueIso)
      return { key: b.key, label: b.label, sortKey: b.key, todoKind: null }
    }
    case 'calendar_day': {
      const raw = item.dueIso?.trim()
      if (!raw) {
        return {
          key: 'zzzz-no-date',
          label: ctx.noDueLabel,
          sortKey: 'zzzz-no-date',
          todoKind: null
        }
      }
      let dayKey: string
      if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
        dayKey = raw.slice(0, 10)
      } else {
        try {
          const d = parseISO(raw)
          if (Number.isNaN(d.getTime())) {
            return {
              key: 'zzzz-no-date',
              label: ctx.noDueLabel,
              sortKey: 'zzzz-no-date',
              todoKind: null
            }
          }
          dayKey = format(d, 'yyyy-MM-dd')
        } catch {
          return {
            key: 'zzzz-no-date',
            label: ctx.noDueLabel,
            sortKey: 'zzzz-no-date',
            todoKind: null
          }
        }
      }
      const label = ctx.formatCalendarDayGroupLabel?.(dayKey) ?? dayKey
      return { key: dayKey, label, sortKey: dayKey, todoKind: null }
    }
    case 'title': {
      const t = (item.title.trim() || '?')[0]!.toUpperCase()
      const letter = /[A-ZÄÖÜ]/.test(t) ? t : '#'
      return { key: letter, label: letter, sortKey: letter, todoKind: null }
    }
    case 'account': {
      const label = ctx.accountLabel(item.accountId)
      return { key: item.accountId, label, sortKey: label.toLowerCase(), todoKind: null }
    }
    case 'list': {
      const label = item.listName.trim() || item.listId
      return {
        key: `${item.accountId}:${item.listId}`,
        label,
        sortKey: label.toLowerCase(),
        todoKind: null
      }
    }
    case 'status': {
      const open = !item.completed
      return {
        key: open ? 'open' : 'done',
        label: open ? ctx.openLabel : ctx.doneLabel,
        sortKey: open ? 0 : 1,
        todoKind: null
      }
    }
    case 'none':
    default:
      return { key: 'all', label: '', sortKey: 0, todoKind: null }
  }
}

function sortGroups(
  groups: TaskListGroup[],
  arrange: TaskListArrangeBy,
  chrono: TaskListChronoOrder
): TaskListGroup[] {
  const g = [...groups]
  if (arrange === 'todo_bucket') {
    g.sort((a, b) => {
      const ar = a.todoKind != null ? rankOpenTodoBucket(a.todoKind) : 99
      const br = b.todoKind != null ? rankOpenTodoBucket(b.todoKind) : 99
      return ar - br
    })
    return g
  }
  if (arrange === 'status') {
    g.sort((a, b) => a.key.localeCompare(b.key))
    return g
  }
  if (arrange === 'due_date' || arrange === 'calendar_day') {
    g.sort((a, b) => {
      const empty = (k: string): boolean => k.startsWith('zzzz') || k === 'unknown'
      if (empty(a.key) && !empty(b.key)) return 1
      if (!empty(a.key) && empty(b.key)) return -1
      if (chrono === 'newest_on_top') return b.key.localeCompare(a.key)
      return a.key.localeCompare(b.key)
    })
    return g
  }
  g.sort((a, b) => a.label.localeCompare(b.label, 'de', { sensitivity: 'base' }))
  return g
}

export interface TaskListLayoutOptions {
  overdueMode?: TasksOverdueMode
  noDuePlacement?: TasksNoDuePlacement
}

export function computeTaskListLayout(
  items: TasksListItem[],
  arrange: TaskListArrangeBy,
  chrono: TaskListChronoOrder,
  filter: TaskListFilter,
  ctx: TaskListArrangeContext,
  timeZone: string,
  opts: TaskListLayoutOptions = {}
): TaskListGroup[] {
  const overdueMode = opts.overdueMode ?? 'start_of_day'
  const noDuePlacement = opts.noDuePlacement ?? 'group'
  let filtered = filterTasks(items, filter, timeZone, overdueMode)
  filtered = hideNoDueItems(filtered, arrange, noDuePlacement)
  if (arrange === 'none') {
    const sorted = [...filtered].sort((a, b) => compareTaskItems(a, b, chrono))
    if (sorted.length === 0) return []
    return [{ key: 'all', label: '', todoKind: null, items: sorted }]
  }

  const map = new Map<string, TaskListGroup>()
  for (const item of filtered) {
    const { key, label, sortKey, todoKind } = groupKeyForItem(
      item,
      arrange,
      ctx,
      timeZone,
      overdueMode
    )
    const mapKey = bucketKey(label, sortKey)
    const ex = map.get(mapKey)
    if (ex) ex.items.push(item)
    else map.set(mapKey, { key, label, todoKind, items: [item] })
  }

  const groups = sortGroups([...map.values()], arrange, chrono)
  for (const g of groups) {
    g.items.sort((a, b) => compareTaskItems(a, b, chrono))
  }
  return groups.filter((g) => g.items.length > 0)
}

export function taskListFilterCounts(
  items: TasksListItem[],
  timeZone: string,
  overdueMode: TasksOverdueMode = 'start_of_day'
): {
  all: number
  open: number
  completed: number
  overdue: number
} {
  let open = 0
  let completed = 0
  let overdue = 0
  for (const item of items) {
    if (item.completed) completed++
    else {
      open++
      if (classifyTaskItemDueBucket(item, timeZone, Date.now(), overdueMode) === 'overdue') {
        overdue++
      }
    }
  }
  return { all: items.length, open, completed, overdue }
}

export function taskListGroupCollapseKey(arrange: TaskListArrangeBy, group: TaskListGroup): string {
  return `${arrange}:${group.key}`
}

/** Standardmäßig eingeklappte Gruppen (Einstellungen → Aufgaben). */
export function isTaskListGroupCollapsedByDefault(
  arrange: TaskListArrangeBy,
  group: Pick<TaskListGroup, 'key' | 'todoKind'>,
  mode: TasksCollapsedGroupsMode = 'done_only'
): boolean {
  if (arrange === 'none' || mode === 'none') return false
  if (group.key === 'done' || group.todoKind === 'done') return true
  if (mode === 'done_and_later') {
    return group.todoKind === 'later' || group.todoKind === 'this_week'
  }
  return false
}

export function defaultCollapsedTaskListGroupKeys(
  arrange: TaskListArrangeBy,
  groups: TaskListGroup[],
  mode: TasksCollapsedGroupsMode = 'done_only'
): Set<string> {
  const keys = new Set<string>()
  for (const group of groups) {
    if (isTaskListGroupCollapsedByDefault(arrange, group, mode)) {
      keys.add(taskListGroupCollapseKey(arrange, group))
    }
  }
  return keys
}

/** Visible tasks in list order (respects filter, arrange, and sort). */
export function flattenVisibleTaskItems(
  items: TasksListItem[],
  arrange: TaskListArrangeBy,
  chrono: TaskListChronoOrder,
  filter: TaskListFilter,
  ctx: TaskListArrangeContext,
  timeZone: string,
  opts: TaskListLayoutOptions = {}
): TasksListItem[] {
  return computeTaskListLayout(items, arrange, chrono, filter, ctx, timeZone, opts).flatMap(
    (g) => g.items
  )
}

export function rangeSelectTaskKeys(
  orderedKeys: readonly string[],
  anchorKey: string,
  targetKey: string
): string[] {
  const a = orderedKeys.indexOf(anchorKey)
  const b = orderedKeys.indexOf(targetKey)
  if (a < 0 || b < 0) return [targetKey]
  const lo = Math.min(a, b)
  const hi = Math.max(a, b)
  return orderedKeys.slice(lo, hi + 1)
}
