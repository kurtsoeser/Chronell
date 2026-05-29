import { loadConfig } from '../config'
import { listAccounts } from '../accounts'
import {
  findFolderByRemoteId,
  findFolderByWellKnown,
  listFoldersByAccount,
  setFolderMailboxCountsLocal
} from '../db/folders-repo'
import {
  clearWaitingForReplyOnThreads,
  deleteMessagesByAccountRemoteIds,
  countMessagesInFolder,
  listMessageIdsByRemoteIds,
  setMessageReadLocal,
  type UpsertMessageInput
} from '../db/messages-repo'
import { getFolderSyncState, upsertFolderSyncState } from '../db/sync-state-repo'
import { upsertMailMessagesReconcilingTodos } from '../mail-upsert-with-todo-reconcile'
import {
  decodeEwsSyncStateToken,
  encodeEwsSyncStateToken,
  fetchEwsSyncFolderItemsPage,
  isEwsSyncableMailFolder,
  isEwsSyncStateToken
} from './ews-sync-folder-items'
import { parseEwsMessageFields, type EwsSyncChange } from './ews-sync-parse'
import { translateEwsIdsToRestIds } from './translate-exchange-ids'
import { createGraphClient } from '../graph/client'

function normalizeMailbox(addr: string | null): string | null {
  if (!addr) return null
  let s = addr.trim().toLowerCase()
  const angle = s.match(/<([^>]+)>/)
  if (angle) s = angle[1]!.trim().toLowerCase()
  if (!s.includes('@')) return null
  return s
}

function syncWindowCutoffIso(days: number | null | undefined): string | null {
  if (days == null || !Number.isFinite(days) || days <= 0) return null
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
}

function ewsFieldsToUpsert(
  fields: NonNullable<ReturnType<typeof parseEwsMessageFields>>,
  accountId: string,
  folderId: number,
  restId: string
): UpsertMessageInput {
  const followUp = fields.followUpFlagStatus
  return {
    accountId,
    folderId,
    threadId: null,
    remoteId: restId,
    remoteThreadId: fields.conversationId,
    subject: fields.subject,
    fromAddr: fields.fromAddr,
    fromName: fields.fromName,
    toAddrs: fields.toAddrs,
    ccAddrs: fields.ccAddrs,
    bccAddrs: null,
    snippet: fields.preview,
    bodyHtml: null,
    bodyText: null,
    sentAt: fields.sentAt,
    receivedAt: fields.receivedAt,
    isRead: fields.isRead ? 1 : 0,
    isFlagged: followUp === 'flagged' ? 1 : 0,
    followUpFlagStatus: followUp,
    hasAttachments: fields.hasAttachments ? 1 : 0,
    importance: fields.importance,
    changeKey: fields.changeKey,
    listUnsubscribe: null,
    listUnsubscribePost: null,
    listId: null
  }
}

async function refreshFolderCountsFromGraph(
  accountId: string,
  folderRemoteId: string,
  folderLocalId: number
): Promise<void> {
  const config = await loadConfig()
  if (!config.microsoftClientId) return
  const homeAccountId = accountId.replace(/^ms:/, '')
  const client = createGraphClient(config.microsoftClientId, homeAccountId)
  try {
    const stats = (await client
      .api(`/me/mailFolders/${folderRemoteId}`)
      .select('totalItemCount,unreadItemCount')
      .get()) as { totalItemCount?: number; unreadItemCount?: number }
    setFolderMailboxCountsLocal(
      folderLocalId,
      stats.unreadItemCount ?? 0,
      stats.totalItemCount ?? 0
    )
  } catch (e) {
    console.warn('[ews-mail-sync] folder counts via Graph failed:', e)
  }
}

function extractMessageXml(change: EwsSyncChange): string | null {
  if (change.kind !== 'create' && change.kind !== 'update') return null
  const msg =
    change.itemXml.match(/<(?:t:)?Message[^>]*>([\s\S]*?)<\/(?:t:)?Message>/i)?.[0] ??
    change.itemXml
  return msg
}

async function ingestEwsSyncPage(input: {
  accountId: string
  folder: { id: number; remoteId: string; wellKnown: string | null }
  changes: EwsSyncChange[]
  syncWindowCutoff: string | null
}): Promise<{ upserted: number; remoteIds: string[]; maxLastMod: string | null }> {
  const ewsIdsForTranslate = new Set<string>()
  const messageChanges: Array<{ change: EwsSyncChange; fields: NonNullable<ReturnType<typeof parseEwsMessageFields>> }> =
    []
  const deleteEwsIds: string[] = []
  const readFlagUpdates: Array<{ ewsItemId: string; isRead: boolean }> = []

  for (const change of input.changes) {
    if (change.kind === 'delete') {
      deleteEwsIds.push(change.ewsItemId)
      continue
    }
    if (change.kind === 'read-flag') {
      readFlagUpdates.push({ ewsItemId: change.ewsItemId, isRead: change.isRead })
      ewsIdsForTranslate.add(change.ewsItemId)
      continue
    }
    const itemXml = extractMessageXml(change)
    if (!itemXml) continue
    const fields = parseEwsMessageFields(itemXml)
    if (!fields) continue
    if (input.syncWindowCutoff && fields.receivedAt && fields.receivedAt < input.syncWindowCutoff) {
      continue
    }
    ewsIdsForTranslate.add(fields.ewsItemId)
    messageChanges.push({ change, fields })
  }

  const translateIds = [...ewsIdsForTranslate]
  const ewsToRest =
    translateIds.length > 0
      ? await translateEwsIdsToRestIds(input.accountId, translateIds)
      : new Map<string, string>()

  if (deleteEwsIds.length > 0) {
    const restDeletes: string[] = []
    for (const ewsId of deleteEwsIds) {
      const rest = ewsToRest.get(ewsId)
      if (rest) restDeletes.push(rest)
    }
    if (restDeletes.length > 0) {
      deleteMessagesByAccountRemoteIds(input.accountId, restDeletes)
    }
  }

  for (const rf of readFlagUpdates) {
    const restId = ewsToRest.get(rf.ewsItemId)
    if (!restId) continue
    const local = listMessageIdsByRemoteIds(input.accountId, [restId]).get(restId)
    if (local != null) setMessageReadLocal(local, rf.isRead)
  }

  let selfEmailNorm: string | null = null
  if (input.folder.wellKnown === 'inbox') {
    const email = (await listAccounts()).find((a) => a.id === input.accountId)?.email
    selfEmailNorm = email ? normalizeMailbox(email) : null
  }

  const rows: UpsertMessageInput[] = []
  const remoteIds: string[] = []
  let maxLastMod: string | null = null
  const threadsToClear: string[] = []

  for (const { fields } of messageChanges) {
    const restId = ewsToRest.get(fields.ewsItemId)
    if (!restId) continue
    remoteIds.push(restId)
    const row = ewsFieldsToUpsert(fields, input.accountId, input.folder.id, restId)
    rows.push(row)
    const t = fields.receivedAt ?? fields.sentAt
    if (t && (!maxLastMod || t > maxLastMod)) maxLastMod = t
    if (input.folder.wellKnown === 'inbox' && selfEmailNorm && row.remoteThreadId) {
      const fromN = normalizeMailbox(row.fromAddr)
      if (fromN && fromN !== selfEmailNorm) threadsToClear.push(row.remoteThreadId)
    }
  }

  if (rows.length > 0) {
    upsertMailMessagesReconcilingTodos(input.accountId, rows)
    if (threadsToClear.length > 0) {
      clearWaitingForReplyOnThreads(input.accountId, [...new Set(threadsToClear)])
    }
  }

  return { upserted: rows.length, remoteIds, maxLastMod }
}

async function runEwsSyncFolderItemsCycle(input: {
  accountId: string
  folder: { id: number; remoteId: string; wellKnown: string | null }
  syncState: string | null
  maxPages: number
  baseLastSyncedAt: string | null
}): Promise<{ added: number; from: string | null; to: string | null; remoteIds: string[] }> {
  const config = await loadConfig()
  const syncWindowCutoff = syncWindowCutoffIso(config.syncWindowDays)

  let syncState = input.syncState
  let pages = 0
  let total = 0
  const remoteIds: string[] = []
  let maxLastMod = input.baseLastSyncedAt

  while (pages < input.maxPages) {
    pages += 1
    const page = await fetchEwsSyncFolderItemsPage({
      accountId: input.accountId,
      folder: input.folder,
      syncState,
      maxChanges: 256
    })

    const ing = await ingestEwsSyncPage({
      accountId: input.accountId,
      folder: input.folder,
      changes: page.changes,
      syncWindowCutoff
    })
    total += ing.upserted
    remoteIds.push(...ing.remoteIds)
    if (ing.maxLastMod && (!maxLastMod || ing.maxLastMod > maxLastMod)) maxLastMod = ing.maxLastMod

    if (page.syncState) syncState = page.syncState
    if (page.includesLastItemInRange) break
    if (page.changes.length === 0 && page.includesLastItemInRange) break
  }

  const st = getFolderSyncState(input.accountId, input.folder.id)
  upsertFolderSyncState({
    accountId: input.accountId,
    folderId: input.folder.id,
    deltaToken: syncState ? encodeEwsSyncStateToken(syncState) : st?.deltaToken ?? null,
    lastSyncedAt: maxLastMod ?? st?.lastSyncedAt ?? null
  })

  return { added: total, from: input.baseLastSyncedAt, to: maxLastMod, remoteIds }
}

/** Graph-Delta-Token verwerfen, wenn auf EWS-Sync umgestellt wird. */
export function migrateFolderSyncStateToEwsIfNeeded(
  accountId: string,
  folderId: number
): void {
  const st = getFolderSyncState(accountId, folderId)
  if (!st?.deltaToken || isEwsSyncStateToken(st.deltaToken)) return
  upsertFolderSyncState({
    accountId,
    folderId,
    deltaToken: null,
    lastSyncedAt: st.lastSyncedAt
  })
}

export async function bootstrapEwsFolderSync(
  accountId: string,
  folder: { id: number; remoteId: string; wellKnown: string | null }
): Promise<void> {
  migrateFolderSyncStateToEwsIfNeeded(accountId, folder.id)
  const st = getFolderSyncState(accountId, folder.id)
  if (st?.deltaToken && isEwsSyncStateToken(st.deltaToken)) return
  try {
    await runEwsSyncFolderItemsCycle({
      accountId,
      folder,
      syncState: null,
      maxPages: 40,
      baseLastSyncedAt: st?.lastSyncedAt ?? null
    })
  } catch (e) {
    console.warn('[ews-mail-sync] bootstrap', folder.wellKnown ?? folder.remoteId, e)
  }
}

export async function pollMessagesInFolderEws(
  accountId: string,
  folderRemoteId: string,
  maxPages = 4
): Promise<{ added: number; from: string | null; to: string | null; remoteIds: string[] }> {
  const folder = findFolderByRemoteId(accountId, folderRemoteId)
  if (!folder) throw new Error(`Ordner ${folderRemoteId} nicht in DB gefunden.`)

  migrateFolderSyncStateToEwsIfNeeded(accountId, folder.id)
  const state = getFolderSyncState(accountId, folder.id)
  const ewsState = decodeEwsSyncStateToken(state?.deltaToken)

  if (!ewsState && !state?.lastSyncedAt) {
    const n = await syncMessagesInFolderEws(accountId, folderRemoteId, 50)
    return { added: n, from: null, to: null, remoteIds: [] }
  }

  try {
    return await runEwsSyncFolderItemsCycle({
      accountId,
      folder,
      syncState: ewsState,
      maxPages: Math.max(maxPages, 8),
      baseLastSyncedAt: state?.lastSyncedAt ?? null
    })
  } catch (e) {
    console.warn('[ews-mail-sync] poll failed, re-bootstrap:', e)
    upsertFolderSyncState({
      accountId,
      folderId: folder.id,
      deltaToken: null,
      lastSyncedAt: state?.lastSyncedAt ?? null
    })
    try {
      await bootstrapEwsFolderSync(accountId, folder)
      const st2 = getFolderSyncState(accountId, folder.id)
      return await runEwsSyncFolderItemsCycle({
        accountId,
        folder,
        syncState: decodeEwsSyncStateToken(st2?.deltaToken),
        maxPages: Math.max(maxPages, 8),
        baseLastSyncedAt: st2?.lastSyncedAt ?? null
      })
    } catch (e2) {
      console.warn('[ews-mail-sync] poll re-bootstrap failed:', e2)
      throw e2
    }
  }
}

export async function syncMessagesInFolderEws(
  accountId: string,
  folderRemoteId: string,
  _topCount = 50
): Promise<number> {
  void _topCount
  const folder = findFolderByRemoteId(accountId, folderRemoteId)
  if (!folder) throw new Error(`Ordner ${folderRemoteId} nicht in DB gefunden.`)

  migrateFolderSyncStateToEwsIfNeeded(accountId, folder.id)

  const localBefore = countMessagesInFolder(folder.id)
  if (localBefore === 0) {
    upsertFolderSyncState({
      accountId,
      folderId: folder.id,
      deltaToken: null,
      lastSyncedAt: null
    })
  }

  const result = await runEwsSyncFolderItemsCycle({
    accountId,
    folder,
    syncState: null,
    maxPages: 12,
    baseLastSyncedAt: getFolderSyncState(accountId, folder.id)?.lastSyncedAt ?? null
  })

  void refreshFolderCountsFromGraph(accountId, folder.remoteId, folder.id)

  return result.added
}

/**
 * Primt fuer alle Ordner einen EWS SyncState, damit Polling nicht mehr
 * erst beim ersten Aufruf einen vollen Graph-Delta→EWS Wechsel machen muss.
 * Laedt dabei bewusst KEINE Itemdaten (MaxChangesReturned minimal).
 */
export async function primeEwsSyncStateForAllFolders(
  accountId: string,
  opts?: { concurrency?: number }
): Promise<void> {
  const folders = listFoldersByAccount(accountId)
  const concurrency = Math.max(1, Math.min(opts?.concurrency ?? 3, 6))

  let idx = 0
  const workers = Array.from({ length: Math.min(concurrency, folders.length) }, async () => {
    while (idx < folders.length) {
      const f = folders[idx++]!
      if (!isEwsSyncableMailFolder(f.wellKnown)) continue
      try {
        await primeEwsSyncStateForFolder(accountId, {
          id: f.id,
          remoteId: f.remoteId,
          wellKnown: f.wellKnown
        })
      } catch (e) {
        console.warn('[ews-mail-sync] prime folder failed:', f.wellKnown ?? f.remoteId, e)
      }
    }
  })
  await Promise.all(workers)
}

export async function primeEwsSyncStateForFolder(
  accountId: string,
  folder: { id: number; remoteId: string; wellKnown: string | null }
): Promise<void> {
  if (!isEwsSyncableMailFolder(folder.wellKnown)) return
  migrateFolderSyncStateToEwsIfNeeded(accountId, folder.id)
  const st = getFolderSyncState(accountId, folder.id)
  if (st?.deltaToken && isEwsSyncStateToken(st.deltaToken)) return

  const page = await fetchEwsSyncFolderItemsPage({
    accountId,
    folder,
    syncState: null,
    maxChanges: 1
  })

  if (!page.syncState) return
  upsertFolderSyncState({
    accountId,
    folderId: folder.id,
    deltaToken: encodeEwsSyncStateToken(page.syncState),
    lastSyncedAt: st?.lastSyncedAt ?? null
  })
}
