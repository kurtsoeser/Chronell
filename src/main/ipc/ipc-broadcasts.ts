import { BrowserWindow } from 'electron'
import type { EntityEmbeddingProgress } from '@shared/entity-embeddings'
import type { MailBodyIndexProgress } from '@shared/mail-body-index'
import type { ConnectedAccount, MailChangedPayload, UserNoteKind } from '@shared/types'
import { mergeMailChangedPayload } from '@shared/mail-changed-merge'

const MAIL_CHANGED_COALESCE_MS = 100

const pendingMailChanged = new Map<string, MailChangedPayload>()
let mailChangedFlushTimer: ReturnType<typeof setTimeout> | null = null

function flushMailChanged(): void {
  mailChangedFlushTimer = null
  if (pendingMailChanged.size === 0) return
  const batch = [...pendingMailChanged.values()]
  pendingMailChanged.clear()
  for (const win of BrowserWindow.getAllWindows()) {
    for (const payload of batch) {
      win.webContents.send('mail:changed', payload)
    }
  }
}

function scheduleMailChangedFlush(): void {
  if (mailChangedFlushTimer != null) return
  mailChangedFlushTimer = setTimeout(flushMailChanged, MAIL_CHANGED_COALESCE_MS)
}

export function broadcastAccountsChanged(accounts: ConnectedAccount[]): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('accounts:changed', accounts)
  }
}

export function broadcastSyncStatus(status: {
  accountId: string
  state: 'idle' | 'syncing-folders' | 'syncing-messages' | 'error'
  message?: string
}): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('sync:status', status)
  }
}

export function broadcastMailChanged(
  accountId: string,
  extra: Omit<MailChangedPayload, 'accountId'> = {}
): void {
  const incoming: MailChangedPayload = { accountId, ...extra }
  const prev = pendingMailChanged.get(accountId)
  pendingMailChanged.set(
    accountId,
    prev ? mergeMailChangedPayload(prev, extra) : incoming
  )
  scheduleMailChangedFlush()
}

export function broadcastMailBulkUnflagProgress(payload: {
  accountId: string
  done: number
  total: number
}): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('mail:bulk-unflag-progress', payload)
  }
}

export function broadcastCalendarChanged(accountId: string): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('calendar:changed', { accountId })
  }
}

export function broadcastCalendarSyncStatus(status: {
  accountId: string
  state: 'idle' | 'syncing-folders' | 'syncing-messages' | 'error'
  message?: string
}): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('calendar:sync-status', status)
  }
}

export function broadcastTasksChanged(accountId: string): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('tasks:changed', { accountId })
  }
}

export function broadcastNotesChanged(payload: {
  kind?: UserNoteKind
  noteId?: number
  messageId?: number | null
  accountId?: string | null
}): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('notes:changed', payload)
  }
  void import('../sync-profile/profile-sync-scheduler').then((m) => {
    void m.markProfileDataDirty()
    m.scheduleProfileSyncDebounced()
  })
}

/** Ungerichtete entity_links geaendert — alle ConnectionsPanel-Instanzen neu laden. */
export function broadcastEntityLinksChanged(): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('entity-links:changed', {})
  }
  void import('../sync-profile/profile-sync-scheduler').then((m) => {
    void m.markProfileDataDirty()
    m.scheduleProfileSyncDebounced()
  })
}

export function broadcastEntityLinkAiScanProgress(
  status: import('@shared/entity-links').EntityLinkAiScanStatus
): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('entity-links:ai-scan-progress', status)
  }
}

export function broadcastEntityEmbeddingProgress(progress: EntityEmbeddingProgress | null): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('entity-embeddings:index-progress', progress)
  }
}

export function broadcastMailBodyIndexProgress(progress: MailBodyIndexProgress | null): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('mail-body-index:progress', progress)
  }
}

export function broadcastProfileSyncStatus(): void {
  void import('../sync-profile/profile-sync-service').then((m) =>
    m.getProfileSyncStatus().then((status) => {
      for (const win of BrowserWindow.getAllWindows()) {
        win.webContents.send('profile-sync:status', status)
      }
    })
  )
}

export function broadcastProfileSyncApplied(localStorage: Record<string, string>): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('profile-sync:applied', { localStorage })
  }
}

export function broadcastTeamsChatPopoutClosed(payload: {
  accountId: string
  chatId: string
}): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('teams-chat-popout:closed', payload)
  }
}

export function broadcastMailReadingPopoutClosed(payload: { messageId: number }): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('mail-reading-popout:closed', payload)
  }
}
