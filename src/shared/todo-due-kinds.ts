import type { TodoDueKindList, TodoDueKindOpen } from './types'

/** Offene ToDo-Buckets (ohne erledigt/überfällig), Standard-Reihenfolge in der UI. */
export const OPEN_TODO_KIND_ORDER: readonly TodoDueKindOpen[] = [
  'today',
  'tomorrow',
  'this_week',
  'later'
]

export const OPEN_TODO_KIND_SET = new Set<TodoDueKindOpen>(OPEN_TODO_KIND_ORDER)

/** Dashboard-Kachel: überfällig + offene Buckets zusammenführen. */
export const DASHBOARD_TODO_MERGE_BUCKETS: readonly TodoDueKindList[] = [
  'overdue',
  ...OPEN_TODO_KIND_ORDER
]

export function isOpenTodoDueKind(value: string): value is TodoDueKindOpen {
  return OPEN_TODO_KIND_SET.has(value as TodoDueKindOpen)
}
