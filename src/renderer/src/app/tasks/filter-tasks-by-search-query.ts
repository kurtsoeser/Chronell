import type { TasksListItem } from '@/app/tasks/tasks-types'

/** Clientseitiger Textfilter (Titel + Notizen), Token-AND, mind. 2 Zeichen. */
export function filterTasksBySearchQuery(
  items: TasksListItem[],
  rawQuery: string
): TasksListItem[] {
  const q = rawQuery.trim().toLowerCase()
  if (q.length < 2) return items
  const tokens = q.split(/\s+/).filter((t) => t.length > 0)
  if (tokens.length === 0) return items
  return items.filter((item) => {
    const hay = `${item.title} ${item.notes ?? ''}`.toLowerCase()
    return tokens.every((token) => hay.includes(token))
  })
}
