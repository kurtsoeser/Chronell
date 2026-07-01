import { ipcRenderer, type IpcRendererEvent } from 'electron'
import { mergeMailChangedPayload } from '@shared/mail-changed-merge'
import type { MailChangedPayload } from '@shared/types'
import type { ZoomShortcutIntent } from '@shared/zoom-shortcut-keys'

const MAIL_CHANGED_RENDERER_DEBOUNCE_MS = 200
const CALENDAR_CHANGED_RENDERER_DEBOUNCE_MS = 350
const TASKS_CHANGED_RENDERER_DEBOUNCE_MS = 350

const mailChangedHandlers = new Set<(payload: MailChangedPayload) => void>()
const calendarChangedHandlers = new Set<(payload: { accountId: string }) => void>()
const tasksChangedHandlers = new Set<(payload: { accountId: string }) => void>()

const pendingMailChangedByAccount = new Map<string, MailChangedPayload>()
const pendingCalendarChangedAccounts = new Set<string>()
const pendingTasksChangedAccounts = new Set<string>()

let mailChangedRendererFlushTimer: ReturnType<typeof setTimeout> | null = null
let calendarChangedRendererFlushTimer: ReturnType<typeof setTimeout> | null = null
let tasksChangedRendererFlushTimer: ReturnType<typeof setTimeout> | null = null

function flushMailChangedToHandlers(): void {
  mailChangedRendererFlushTimer = null
  if (pendingMailChangedByAccount.size === 0) return
  const batch = [...pendingMailChangedByAccount.values()]
  pendingMailChangedByAccount.clear()
  for (const payload of batch) {
    for (const handler of mailChangedHandlers) handler(payload)
  }
}

function scheduleMailChangedRendererFlush(): void {
  if (mailChangedRendererFlushTimer != null) return
  mailChangedRendererFlushTimer = setTimeout(
    flushMailChangedToHandlers,
    MAIL_CHANGED_RENDERER_DEBOUNCE_MS
  )
}

function flushCalendarChangedToHandlers(): void {
  calendarChangedRendererFlushTimer = null
  if (pendingCalendarChangedAccounts.size === 0) return
  const accountIds = [...pendingCalendarChangedAccounts]
  pendingCalendarChangedAccounts.clear()
  for (const accountId of accountIds) {
    const payload = { accountId }
    for (const handler of calendarChangedHandlers) handler(payload)
  }
}

function scheduleCalendarChangedRendererFlush(): void {
  if (calendarChangedRendererFlushTimer != null) return
  calendarChangedRendererFlushTimer = setTimeout(
    flushCalendarChangedToHandlers,
    CALENDAR_CHANGED_RENDERER_DEBOUNCE_MS
  )
}

function flushTasksChangedToHandlers(): void {
  tasksChangedRendererFlushTimer = null
  if (pendingTasksChangedAccounts.size === 0) return
  const accountIds = [...pendingTasksChangedAccounts]
  pendingTasksChangedAccounts.clear()
  for (const accountId of accountIds) {
    const payload = { accountId }
    for (const handler of tasksChangedHandlers) handler(payload)
  }
}

function scheduleTasksChangedRendererFlush(): void {
  if (tasksChangedRendererFlushTimer != null) return
  tasksChangedRendererFlushTimer = setTimeout(
    flushTasksChangedToHandlers,
    TASKS_CHANGED_RENDERER_DEBOUNCE_MS
  )
}

ipcRenderer.on('mail:changed', (_e: IpcRendererEvent, payload: MailChangedPayload) => {
  const prev = pendingMailChangedByAccount.get(payload.accountId)
  pendingMailChangedByAccount.set(
    payload.accountId,
    prev
      ? mergeMailChangedPayload(prev, {
          kind: payload.kind,
          folderIds: payload.folderIds
        })
      : payload
  )
  scheduleMailChangedRendererFlush()
})

ipcRenderer.on('calendar:changed', (_e: IpcRendererEvent, payload: { accountId: string }) => {
  if (!payload?.accountId) return
  pendingCalendarChangedAccounts.add(payload.accountId)
  scheduleCalendarChangedRendererFlush()
})

ipcRenderer.on('tasks:changed', (_e: IpcRendererEvent, payload: { accountId: string }) => {
  if (!payload?.accountId) return
  pendingTasksChangedAccounts.add(payload.accountId)
  scheduleTasksChangedRendererFlush()
})

const zoomShortcutHandlers = new Set<
  (intent: import('@shared/zoom-shortcut-keys').ZoomShortcutIntent) => void
>()

ipcRenderer.on(
  'app:zoom-shortcut',
  (_e: IpcRendererEvent, intent: import('@shared/zoom-shortcut-keys').ZoomShortcutIntent) => {
    if (!intent?.scope || !intent?.action) return
    for (const handler of zoomShortcutHandlers) handler(intent)
  }
)

export {
  mailChangedHandlers,
  calendarChangedHandlers,
  tasksChangedHandlers,
  zoomShortcutHandlers
}
