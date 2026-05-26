import type { TasksListItem } from '@/app/tasks/tasks-types'
import { classifyTaskItemDueBucket } from '@/app/tasks/task-due-bucket'
import { readTasksSettingsPrefs } from '@/lib/tasks-settings-prefs'

const notifiedKeys = new Set<string>()

function reminderKey(item: TasksListItem): string | null {
  if (item.completed || !item.dueIso?.trim()) return null
  return `${item.source}:${item.accountId}:${item.listId}:${item.id}:${item.dueIso}`
}

export function resetTasksDueReminderCache(): void {
  notifiedKeys.clear()
}

export async function runTasksDueReminders(
  items: TasksListItem[],
  productName: string
): Promise<void> {
  const prefs = readTasksSettingsPrefs()
  if (!prefs.dueReminderEnabled) return
  if (typeof Notification === 'undefined') return
  if (Notification.permission === 'default') {
    await Notification.requestPermission()
  }
  if (Notification.permission !== 'granted') return

  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
  const now = Date.now()
  const windowMs = prefs.dueReminderMinutesBefore * 60_000

  for (const item of items) {
    if (item.completed || !item.dueIso?.trim()) continue
    const dueMs = Date.parse(item.dueIso)
    if (Number.isNaN(dueMs)) continue
    const delta = dueMs - now
    if (delta < 0 || delta > windowMs) continue
    if (classifyTaskItemDueBucket(item, tz, now, prefs.overdueMode) === 'done') continue
    const key = reminderKey(item)
    if (!key || notifiedKeys.has(key)) continue
    notifiedKeys.add(key)
    new Notification(productName, {
      body: `${item.title}\n${dueReminderBody(prefs.dueReminderMinutesBefore)}`,
      silent: false
    })
  }
}

function dueReminderBody(minutes: number): string {
  if (minutes >= 1440) {
    const days = Math.round(minutes / 1440)
    return `Fällig in ca. ${days} Tag${days === 1 ? '' : 'en'}`
  }
  if (minutes >= 60) {
    const h = Math.round(minutes / 60)
    return `Fällig in ca. ${h} Stunde${h === 1 ? '' : 'n'}`
  }
  return `Fällig in ca. ${minutes} Minuten`
}
