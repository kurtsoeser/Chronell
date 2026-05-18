import type { ConnectedAccount, MailListItem } from '@shared/types'
import { mailListItemTodoScheduleWindow } from '@/app/calendar/mail-todo-calendar'
import { loadUnifiedCloudTasks } from '@/app/tasks/tasks-calendar-load'
import { loadPlannedScheduleMapForTasks } from '@/app/work-items/load-planned-schedules'
import { listMailCloudTaskLinks } from '@/app/work-items/load-master-work-items'
import { buildMasterWorkItemList } from '@/app/work-items/work-item-dedup'
import { attachLinkedMessageIds } from '@/app/work-items/work-item-links'
import { mailListItemsToWorkItems, taskItemToWorkItem } from '@/app/work-items/work-item-mapper'
import type { MasterWorkItemsLoadResult } from '@/app/work-items/load-master-work-items'

/** Puffer um das sichtbare Fenster — Rand-Einträge und Planungsverschiebungen. */
const MEGA_RANGE_BUFFER_DAYS = 14

export function megaFetchRangeWithBuffer(
  rangeStart: Date,
  rangeEnd: Date
): { fetchStart: Date; fetchEnd: Date } {
  const bufferMs = MEGA_RANGE_BUFFER_DAYS * 24 * 60 * 60 * 1000
  return {
    fetchStart: new Date(rangeStart.getTime() - bufferMs),
    fetchEnd: new Date(rangeEnd.getTime() + bufferMs)
  }
}

function mailOverlapsRange(
  mail: MailListItem,
  rangeStart: Date,
  rangeEnd: Date
): boolean {
  const window = mailListItemTodoScheduleWindow(mail)
  if (window) {
    const startMs = rangeStart.getTime()
    const endMs = rangeEnd.getTime()
    return window.endMs > startMs && window.startMs < endMs
  }
  const received = mail.receivedAt ?? mail.sentAt
  if (!received) return false
  const t = Date.parse(received)
  if (!Number.isFinite(t)) return false
  return t >= rangeStart.getTime() && t < rangeEnd.getTime()
}

function mergeMailListsUnique(primary: MailListItem[], extra: MailListItem[]): MailListItem[] {
  const seen = new Set(primary.map((m) => m.id))
  const merged = [...primary]
  for (const m of extra) {
    if (seen.has(m.id)) continue
    seen.add(m.id)
    merged.push(m)
  }
  return merged
}

async function loadMailTodosForMegaRange(
  rangeStart: Date,
  rangeEnd: Date,
  includeCompleted: boolean
): Promise<MailListItem[]> {
  const { fetchStart, fetchEnd } = megaFetchRangeWithBuffer(rangeStart, rangeEnd)

  const [scheduled, laterBucket, overdueBucket] = await Promise.all([
    window.mailClient.mail.listTodoMessagesInRange({
      accountId: null,
      rangeStartIso: fetchStart.toISOString(),
      rangeEndIso: fetchEnd.toISOString(),
      limit: 800
    }),
    window.mailClient.mail
      .listTodoMessages({ accountId: null, dueKind: 'later', limit: 400 })
      .catch((): MailListItem[] => []),
    window.mailClient.mail
      .listTodoMessages({ accountId: null, dueKind: 'overdue', limit: 400 })
      .catch((): MailListItem[] => [])
  ])

  const undatedInRange = laterBucket.filter((m) => {
    if (m.todoCompletedAt?.trim()) return false
    if (m.todoDueAt?.trim() || m.todoStartAt?.trim()) return false
    return mailOverlapsRange(m, fetchStart, fetchEnd)
  })

  let merged = mergeMailListsUnique(scheduled, undatedInRange)
  merged = mergeMailListsUnique(merged, overdueBucket)

  if (includeCompleted) {
    const done = await window.mailClient.mail
      .listTodoMessages({ accountId: null, dueKind: 'done', limit: 400 })
      .catch((): MailListItem[] => [])
    const doneInRange = done.filter((m) => mailOverlapsRange(m, fetchStart, fetchEnd))
    merged = mergeMailListsUnique(merged, doneInRange)
  }

  return merged
}

export interface MasterWorkItemsForMegaRangeOptions {
  includeCompletedMail?: boolean
  /** SQLite-Task-Cache zuerst (schneller erster Paint). */
  cacheOnlyTasks?: boolean
}

/**
 * Master-Arbeitseinträge nur für ein Zeitfenster (Zeitliste / MEGA).
 * Statt aller offenen ToDos + aller Tasks: bereichsbezogene Mails, Tasks aus Cache optional.
 */
export async function loadMasterWorkItemsForMegaRange(
  taskAccounts: ConnectedAccount[],
  rangeStart: Date,
  rangeEnd: Date,
  opts?: MasterWorkItemsForMegaRangeOptions
): Promise<MasterWorkItemsLoadResult> {
  const includeCompleted = opts?.includeCompletedMail ?? true
  const cacheOnly = opts?.cacheOnlyTasks === true

  const [mails, cloudRows, links] = await Promise.all([
    loadMailTodosForMegaRange(rangeStart, rangeEnd, includeCompleted),
    loadUnifiedCloudTasks(taskAccounts, { cacheOnly }),
    listMailCloudTaskLinks()
  ])

  const planned = await loadPlannedScheduleMapForTasks(cloudRows)
  const mailWork = mailListItemsToWorkItems(mails)
  const cloudWork = cloudRows.map((task) =>
    taskItemToWorkItem(task, { plannedByTaskKey: planned })
  )
  const cloudWithLinks = attachLinkedMessageIds(cloudWork, links)
  const { items, hiddenMailMessageIds } = buildMasterWorkItemList(mailWork, cloudWithLinks, links)
  return { items, hiddenMailMessageIds, links }
}
