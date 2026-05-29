import { BrowserWindow } from 'electron'
import { yieldToMainThread } from './lib/yield-main-thread'
import {
  syncAccountInitial,
  syncFolders,
  syncMessagesInFolder,
  pollMessagesInFolder
} from './microsoft-mail-sync-dispatch'
import {
  syncGoogleAccountInitial,
  syncGoogleMessagesInFolder,
  pollGoogleFolderIfNeeded
} from './google/gmail-sync'
import {
  findFolderById,
  findFolderByWellKnown,
  listFavoriteFolderIdsForAccount,
  listFoldersByAccount
} from './db/folders-repo'
import { countMessagesInFolder, listMessageIdsByRemoteIds } from './db/messages-repo'
import { getFolderSyncState } from './db/sync-state-repo'
import { listAccounts } from './accounts'
import { runInboxRulesForNewMessages } from './rule-runner'
import { broadcastMailChanged } from './ipc/ipc-broadcasts'
import { queueEntityEmbeddingsAfterMailSync } from './ai/entity-embeddings-queue'
import { queueMailBodyIndexAfterSync } from './mail-body-index-queue'
import { queueMailAttachmentIndexAfterSync } from './mail-attachment-index-queue'
import {
  touchAccountMailSyncError,
  touchAccountMailSyncFinished
} from './db/account-mail-sync-meta-repo'
import {
  isProviderAuthUnavailable,
  providerAuthUnavailableUserMessage,
  warnProviderAuthOnce
} from './auth/auth-errors'

export type SyncState = 'idle' | 'syncing-folders' | 'syncing-messages' | 'error'

export interface SyncStatus {
  accountId: string
  state: SyncState
  message?: string
}

function broadcast(status: SyncStatus): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('sync:status', status)
  }
}

function syncErrorMessage(e: unknown): string {
  return isProviderAuthUnavailable(e)
    ? providerAuthUnavailableUserMessage(e)
    : e instanceof Error
      ? e.message
      : String(e)
}

const initialSyncInFlight = new Map<
  string,
  Promise<{ folders: number; inboxMessages: number }>
>()

async function runInitialSyncInner(
  accountId: string
): Promise<{ folders: number; inboxMessages: number }> {
  broadcast({ accountId, state: 'syncing-folders' })
  await yieldToMainThread()
  try {
    const accounts = await listAccounts()
    const acc = accounts.find((a) => a.id === accountId)
    let result: { folders: number; inboxMessages: number; sentMessages?: number }
    if (acc?.provider === 'google') {
      result = await syncGoogleAccountInitial(accountId)
    } else {
      result = await syncAccountInitial(accountId)
    }
    touchAccountMailSyncFinished(accountId)
    broadcast({ accountId, state: 'idle' })
    broadcastMailChanged(accountId)
    queueEntityEmbeddingsAfterMailSync(accountId)
    queueMailBodyIndexAfterSync(accountId)
    queueMailAttachmentIndexAfterSync(accountId)
    return { folders: result.folders, inboxMessages: result.inboxMessages }
  } catch (e) {
    const message = isProviderAuthUnavailable(e)
      ? providerAuthUnavailableUserMessage(e)
      : e instanceof Error
        ? e.message
        : String(e)
    if (isProviderAuthUnavailable(e)) {
      warnProviderAuthOnce('sync', accountId, e)
    } else {
      console.error('[sync] initial sync failed:', e)
    }
    touchAccountMailSyncError(accountId, message)
    broadcast({ accountId, state: 'error', message })
    throw e
  }
}

/** Voller Initial-Sync (Ordner + Top-Nachrichten). Pro Konto nur ein Lauf gleichzeitig. */
export async function runInitialSync(
  accountId: string
): Promise<{ folders: number; inboxMessages: number }> {
  const existing = initialSyncInFlight.get(accountId)
  if (existing) return existing

  const promise = runInitialSyncInner(accountId).finally(() => {
    initialSyncInFlight.delete(accountId)
  })
  initialSyncInFlight.set(accountId, promise)
  return promise
}

function collectPollFolderIdsForAccount(
  accountId: string,
  extraFolderIds: number[] = [],
  options?: { allPopulatedFolders?: boolean }
): number[] {
  const visited = new Set<number>()
  const toPoll: number[] = []

  for (const alias of ['inbox', 'sentitems', 'drafts'] as const) {
    const folder = findFolderByWellKnown(accountId, alias)
    if (folder && !visited.has(folder.id)) {
      visited.add(folder.id)
      toPoll.push(folder.id)
    }
  }
  for (const fid of listFavoriteFolderIdsForAccount(accountId)) {
    if (visited.has(fid)) continue
    visited.add(fid)
    toPoll.push(fid)
  }
  for (const fid of extraFolderIds) {
    if (visited.has(fid)) continue
    const folder = findFolderById(fid)
    if (!folder || folder.accountId !== accountId) continue
    visited.add(fid)
    toPoll.push(fid)
  }

  if (options?.allPopulatedFolders) {
    const populated = listFoldersByAccount(accountId)
      .filter((f) => (f.totalCount ?? 0) > 0)
      .sort((a, b) => (b.totalCount ?? 0) - (a.totalCount ?? 0))
      .slice(0, 48)
    for (const f of populated) {
      if (visited.has(f.id)) continue
      visited.add(f.id)
      toPoll.push(f.id)
    }
  }

  return toPoll
}

/** Ordner oeffnen / manuell: Voll-Sync wenn lokal leer, sonst Delta-Poll. */
export async function runFolderSyncOrPoll(folderId: number): Promise<number> {
  const folder = findFolderById(folderId)
  if (!folder) throw new Error(`Folder ${folderId} not found in DB.`)

  const localCount = countMessagesInFolder(folderId)
  const state = getFolderSyncState(folder.accountId, folder.id)

  broadcast({ accountId: folder.accountId, state: 'syncing-messages' })
  try {
    let added: number
    if (localCount === 0 || !state?.lastSyncedAt) {
      added = await runFolderSync(folderId, 100)
    } else {
      try {
        added = await runFolderPoll(folderId)
      } catch (e) {
        console.warn('[sync] folder poll failed, retry with full sync:', folderId, e)
        added = await runFolderSync(folderId, 100)
      }
    }
    touchAccountMailSyncFinished(folder.accountId)
    broadcast({ accountId: folder.accountId, state: 'idle' })
    broadcastMailChanged(folder.accountId, { kind: 'poll', folderIds: [folder.id] })
    return added
  } catch (e) {
    const message = isProviderAuthUnavailable(e)
      ? providerAuthUnavailableUserMessage(e)
      : e instanceof Error
        ? e.message
        : String(e)
    touchAccountMailSyncError(folder.accountId, message)
    broadcast({ accountId: folder.accountId, state: 'error', message })
    throw e
  }
}

/**
 * Manueller Konto-Sync (Sidebar/Einstellungen): zuerst Posteingang/Gesendet/Entwuerfe
 * per Vollabruf, damit Mails zuverlaessig ankommen; Fehler werden sichtbar gemacht.
 */
export async function runManualAccountSync(accountId: string): Promise<void> {
  const accounts = await listAccounts()
  const acc = accounts.find((a) => a.id === accountId)
  if (!acc) throw new Error('Konto nicht gefunden.')

  broadcast({ accountId, state: 'syncing-messages' })
  const errors: string[] = []
  let anySuccess = false

  try {
    if (acc.provider === 'google') {
      await syncGoogleAccountInitial(accountId)
      touchAccountMailSyncFinished(accountId)
      broadcast({ accountId, state: 'idle' })
      broadcastMailChanged(accountId)
      return
    }

    await syncFolders(accountId)

    const priorityFolders = [
      findFolderByWellKnown(accountId, 'inbox'),
      findFolderByWellKnown(accountId, 'sentitems'),
      findFolderByWellKnown(accountId, 'drafts')
    ].filter((f): f is NonNullable<typeof f> => f != null)

    if (priorityFolders.length === 0) {
      await runInitialSync(accountId)
      return
    }

    for (const folder of priorityFolders) {
      try {
        await runFolderSync(folder.id, 100)
        const local = countMessagesInFolder(folder.id)
        const freshFolder = findFolderById(folder.id)
        const serverTotal = freshFolder?.totalCount ?? 0
        console.log(
          `[sync] manual ${folder.wellKnown ?? folder.name}: ${local} lokal` +
            (serverTotal > 0 ? `, Server ${serverTotal}` : '')
        )
        if (local > 0) {
          anySuccess = true
        } else if (serverTotal === 0) {
          anySuccess = true
        } else {
          errors.push(
            `${folder.name}: Server meldet ${serverTotal} Mails, lokal wurden 0 geladen.`
          )
        }
      } catch (e) {
        const message = syncErrorMessage(e)
        errors.push(message)
        console.error(`[sync] manual sync folder ${folder.id} (${folder.wellKnown ?? folder.name}):`, e)
        if (isProviderAuthUnavailable(e)) {
          warnProviderAuthOnce('sync', accountId, e)
        }
      }
    }

    if (anySuccess) {
      touchAccountMailSyncFinished(accountId)
      broadcast({ accountId, state: 'idle' })
      broadcastMailChanged(accountId, {
        kind: 'poll',
        folderIds: priorityFolders.map((f) => f.id)
      })
    } else {
      const message =
        errors[0] ??
        'Mail-Synchronisation fehlgeschlagen. Bitte Konto in den Einstellungen erneut verbinden.'
      touchAccountMailSyncError(accountId, message)
      broadcast({ accountId, state: 'error', message })
      throw new Error(message)
    }

    const priorityIds = new Set(priorityFolders.map((f) => f.id))
    const rest = collectPollFolderIdsForAccount(accountId, [], { allPopulatedFolders: true }).filter(
      (fid) => !priorityIds.has(fid)
    )
    if (rest.length > 0) {
      void runFolderPollsWithConcurrency(rest, 2).catch((e) =>
        console.warn('[sync] manual sync background folders:', accountId, e)
      )
    }
  } catch (e) {
    if (!anySuccess) {
      const message = syncErrorMessage(e)
      touchAccountMailSyncError(accountId, message)
      broadcast({ accountId, state: 'error', message })
      throw e
    }
    broadcast({ accountId, state: 'idle' })
  }
}

/**
 * Inkrementeller Sync fuer ein Konto (Hintergrund / leichter Abruf).
 */
export async function runAccountPoll(
  accountId: string,
  extraFolderIds: number[] = [],
  options?: { allPopulatedFolders?: boolean }
): Promise<void> {
  const toPoll = collectPollFolderIdsForAccount(accountId, extraFolderIds, options)
  if (toPoll.length === 0) {
    await runInitialSync(accountId)
    return
  }

  const erroredAccounts = new Set<string>()
  const lastErrorByAccount = new Map<string, string>()
  broadcast({ accountId, state: 'syncing-messages' })
  try {
    const succeededAccounts = new Set<string>()
    await runFolderPollsWithConcurrency(
      toPoll,
      3,
      erroredAccounts,
      succeededAccounts,
      lastErrorByAccount
    )
    if (succeededAccounts.has(accountId)) {
      touchAccountMailSyncFinished(accountId)
      broadcast({ accountId, state: 'idle' })
      broadcastMailChanged(accountId)
    } else if (erroredAccounts.has(accountId)) {
      const message =
        lastErrorByAccount.get(accountId) ??
        'Mail-Synchronisation fehlgeschlagen. Bitte Konto erneut verbinden.'
      touchAccountMailSyncError(accountId, message)
      broadcast({ accountId, state: 'error', message })
      console.error('[sync] account poll failed:', accountId, message)
    } else {
      broadcast({ accountId, state: 'idle' })
    }
  } catch (e) {
    const message = syncErrorMessage(e)
    touchAccountMailSyncError(accountId, message)
    broadcast({ accountId, state: 'error', message })
    console.error('[sync] account poll error:', accountId, e)
    throw e
  }
}

export async function runFolderSync(folderId: number, limit = 50): Promise<number> {
  const folder = findFolderById(folderId)
  if (!folder) throw new Error(`Folder ${folderId} not found in DB.`)

  broadcast({ accountId: folder.accountId, state: 'syncing-messages' })
  await yieldToMainThread()
  try {
    const accounts = await listAccounts()
    const acc = accounts.find((a) => a.id === folder.accountId)
    const count =
      acc?.provider === 'google'
        ? await syncGoogleMessagesInFolder(folder.accountId, folder.remoteId, limit)
        : await syncMessagesInFolder(folder.accountId, folder.remoteId, limit)
    touchAccountMailSyncFinished(folder.accountId)
    broadcast({ accountId: folder.accountId, state: 'idle' })
    broadcastMailChanged(folder.accountId)
    queueEntityEmbeddingsAfterMailSync(folder.accountId)
    queueMailBodyIndexAfterSync(folder.accountId)
    queueMailAttachmentIndexAfterSync(folder.accountId)
    return count
  } catch (e) {
    const message = isProviderAuthUnavailable(e)
      ? providerAuthUnavailableUserMessage(e)
      : e instanceof Error
        ? e.message
        : String(e)
    if (isProviderAuthUnavailable(e)) {
      warnProviderAuthOnce('sync', folder.accountId, e)
    } else {
      console.error(`[sync] folder sync failed (id=${folderId}):`, e)
    }
    touchAccountMailSyncError(folder.accountId, message)
    broadcast({ accountId: folder.accountId, state: 'error', message })
    throw e
  }
}

/**
 * Inkrementelles Polling fuer einen Folder. Macht keinen vollen Sync,
 * sondern holt nur Aenderungen seit dem letzten Watermark.
 */
export async function runFolderPoll(folderId: number): Promise<number> {
  const folder = findFolderById(folderId)
  if (!folder) throw new Error(`Folder ${folderId} not found in DB.`)

  try {
    const accounts = await listAccounts()
    const acc = accounts.find((a) => a.id === folder.accountId)
    const result =
      acc?.provider === 'google'
        ? await pollGoogleFolderIfNeeded(folder.accountId, folder.remoteId)
        : await pollMessagesInFolder(folder.accountId, folder.remoteId)
    const added = typeof result === 'number' ? result : result.added
    const remoteIds = typeof result === 'number' ? [] : result.remoteIds
    if (added > 0) {
      broadcastMailChanged(folder.accountId, { kind: 'poll', folderIds: [folder.id] })
      queueEntityEmbeddingsAfterMailSync(folder.accountId)
      queueMailBodyIndexAfterSync(folder.accountId)
      queueMailAttachmentIndexAfterSync(folder.accountId)
      if (folder.wellKnown === 'inbox' && remoteIds.length > 0) {
        const idMap = listMessageIdsByRemoteIds(folder.accountId, remoteIds)
        const ids = [...idMap.values()]
        if (ids.length > 0) {
          void runInboxRulesForNewMessages(folder.accountId, ids).catch((e) =>
            console.warn('[sync] inbox rules:', e)
          )
        }
      }
    }
    touchAccountMailSyncFinished(folder.accountId)
    broadcastMailChanged(folder.accountId, { kind: 'poll', folderIds: [folder.id] })
    return added
  } catch (e) {
    const message = isProviderAuthUnavailable(e)
      ? providerAuthUnavailableUserMessage(e)
      : e instanceof Error
        ? e.message
        : String(e)
    if (isProviderAuthUnavailable(e)) {
      warnProviderAuthOnce('sync', folder.accountId, e)
    } else {
      console.error(`[sync] folder poll failed (id=${folderId}):`, e)
    }
    touchAccountMailSyncError(folder.accountId, message)
    broadcast({ accountId: folder.accountId, state: 'error', message })
    throw e
  }
}

/**
 * Pollt fuer alle Konten: Posteingang, Gesendet, Entwuerfe, alle als Favorit markierten Ordner,
 * plus den aktuell ausgewaehlten Folder (extraFolderIds vom Renderer).
 */
function accountIdsForFolderIds(folderIds: number[]): string[] {
  const ids = new Set<string>()
  for (const fid of folderIds) {
    const folder = findFolderById(fid)
    if (folder) ids.add(folder.accountId)
  }
  return [...ids]
}

async function runFolderPollsWithConcurrency(
  folderIds: number[],
  concurrency = 3,
  erroredAccounts?: Set<string>,
  succeededAccounts?: Set<string>,
  lastErrorByAccount?: Map<string, string>
): Promise<void> {
  let index = 0
  const workers = Array.from({ length: Math.min(concurrency, folderIds.length) }, async () => {
    while (index < folderIds.length) {
      const fid = folderIds[index++]!
      const folder = findFolderById(fid)
      try {
        await runFolderPoll(fid)
        if (folder) succeededAccounts?.add(folder.accountId)
        await yieldToMainThread()
      } catch (e) {
        const message = syncErrorMessage(e)
        if (folder) {
          lastErrorByAccount?.set(folder.accountId, message)
          if (isProviderAuthUnavailable(e)) {
            warnProviderAuthOnce('sync', folder.accountId, e)
          } else {
            console.error('[sync] poll folder failed', fid, folder.wellKnown ?? folder.name, e)
          }
          erroredAccounts?.add(folder.accountId)
        } else {
          console.error('[sync] poll folder failed', fid, e)
        }
      }
    }
  })
  await Promise.all(workers)
}

export async function runBackgroundPoll(extraFolderIds: number[] = []): Promise<void> {
  const accounts = await listAccounts()
  const visited = new Set<number>()
  const toPoll: number[] = []

  for (const acc of accounts) {
    for (const fid of collectPollFolderIdsForAccount(acc.id)) {
      if (visited.has(fid)) continue
      visited.add(fid)
      toPoll.push(fid)
    }
  }

  for (const fid of extraFolderIds) {
    if (visited.has(fid)) continue
    if (!findFolderById(fid)) continue
    visited.add(fid)
    toPoll.push(fid)
  }

  const accountIds = accountIdsForFolderIds(toPoll)
  const erroredAccounts = new Set<string>()
  const succeededAccounts = new Set<string>()

  if (toPoll.length === 0) {
    for (const acc of accounts) {
      void runAccountPoll(acc.id).catch((e) => {
        console.warn('[sync] account poll fallback (no folders):', acc.id, e)
      })
    }
    return
  }

  if (accountIds.length > 0) {
    for (const accountId of accountIds) {
      broadcast({ accountId, state: 'syncing-messages' })
    }
  }

  try {
    await runFolderPollsWithConcurrency(toPoll, 3, erroredAccounts, succeededAccounts)
  } finally {
    for (const accountId of succeededAccounts) {
      touchAccountMailSyncFinished(accountId)
      broadcastMailChanged(accountId, { kind: 'poll' })
    }
    for (const accountId of accountIds) {
      broadcast({ accountId, state: 'idle' })
    }
  }
}
