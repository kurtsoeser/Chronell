import type { MailListItem } from '@shared/types'
import {
  MAIL_TASK_LIST_ID,
  type MailTodoListItem,
  type TasksListItem
} from '@/app/tasks/tasks-types'

function mailTodoTitle(mail: MailListItem): string {
  const s = mail.subject?.trim()
  return s || '(Ohne Betreff)'
}

export function mailListItemToTaskListItem(
  mail: MailListItem,
  listName: string
): MailTodoListItem {
  return {
    source: 'mail',
    accountId: mail.accountId,
    listId: MAIL_TASK_LIST_ID,
    id: String(mail.id),
    listName,
    title: mailTodoTitle(mail),
    dueIso: mail.todoDueAt?.trim() || null,
    completed: Boolean(mail.todoCompletedAt?.trim()),
    notes: null,
    iconId: null,
    iconColor: null,
    messageId: mail.id,
    mail
  }
}

export async function loadOpenMailTodosForTasksList(
  mailLabel: string
): Promise<MailTodoListItem[]> {
  const kinds = ['overdue', 'today', 'tomorrow', 'this_week', 'later'] as const
  const seen = new Set<number>()
  const out: MailTodoListItem[] = []
  const buckets = await Promise.all(
    kinds.map((dueKind) =>
      window.mailClient.mail.listTodoMessages({
        accountId: null,
        dueKind,
        limit: 400
      })
    )
  )
  for (const rows of buckets) {
    for (const mail of rows) {
      if (mail.todoCompletedAt?.trim()) continue
      if (seen.has(mail.id)) continue
      seen.add(mail.id)
      out.push(mailListItemToTaskListItem(mail, mailLabel))
    }
  }
  return out
}

export function mergeCloudAndMailTaskItems(
  cloud: TasksListItem[],
  mail: MailTodoListItem[]
): TasksListItem[] {
  return [...cloud, ...mail]
}
