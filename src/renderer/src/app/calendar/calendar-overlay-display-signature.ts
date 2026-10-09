import type { MailListItem, UserNoteListItem } from '@shared/types'

/** Verhindert unnötige React-/FullCalendar-Updates bei identischen Overlay-Daten. */
export function mailTodoCalendarDisplaySignature(items: MailListItem[]): string {
  const parts = items.map(
    (m) =>
      `${m.todoId ?? m.id}\t${m.todoStartAt ?? ''}\t${m.todoEndAt ?? ''}\t${m.todoDueAt ?? ''}\t${m.subject ?? ''}`
  )
  parts.sort()
  return parts.join('\n')
}

export function userNoteCalendarDisplaySignature(items: UserNoteListItem[]): string {
  const parts = items.map(
    (n) =>
      `${n.id}\t${n.scheduledStartIso ?? ''}\t${n.scheduledEndIso ?? ''}\t${n.title ?? ''}\t${n.updatedAt ?? ''}`
  )
  parts.sort()
  return parts.join('\n')
}
