import { shouldUseEwsForMicrosoftMail } from './ews/microsoft-mail-transport'
import { findFolderByRemoteId, findFolderByWellKnown } from './db/folders-repo'
import { countMessagesInFolder } from './db/messages-repo'
import { upsertFolderSyncState } from './db/sync-state-repo'
import {
  pollMessagesInFolderEws,
  primeEwsSyncStateForAllFolders,
  syncMessagesInFolderEws
} from './ews/mail-sync-ews'
import {
  pollMessagesInFolder as pollMessagesInFolderGraph,
  syncAccountInitial as syncAccountInitialGraph,
  syncFolders,
  syncMessagesInFolder as syncMessagesInFolderGraph
} from './graph/mail-sync'

export { syncFolders }

async function useEwsMailSync(accountId: string): Promise<boolean> {
  return shouldUseEwsForMicrosoftMail(accountId)
}

function clearEwsSyncStateForFolder(accountId: string, folderId: number): void {
  upsertFolderSyncState({
    accountId,
    folderId,
    deltaToken: null,
    lastSyncedAt: null
  })
}

/** EWS kann „erfolgreich“ mit 0 Mails zurueckkehren — dann Graph erzwingen. */
async function graphFallbackIfFolderStillEmpty(
  accountId: string,
  folderRemoteId: string,
  topCount: number
): Promise<number> {
  const folder = findFolderByRemoteId(accountId, folderRemoteId)
  if (!folder) return 0

  const localCount = countMessagesInFolder(folder.id)
  const serverTotal = folder.totalCount ?? 0

  if (localCount > 0 || serverTotal === 0) {
    console.log(
      `[mail-sync] ${folder.wellKnown ?? folder.name}: ${localCount} Mails lokal` +
        (serverTotal > 0 ? ` (Server: ${serverTotal})` : '')
    )
    return localCount
  }

  console.warn(
    `[mail-sync] EWS ohne Mails fuer "${folder.name}" — Graph-Fallback (Server meldet ${serverTotal} Eintraege)`
  )
  clearEwsSyncStateForFolder(accountId, folder.id)
  const graphCount = await syncMessagesInFolderGraph(accountId, folderRemoteId, topCount)
  const afterLocal = countMessagesInFolder(folder.id)
  console.log(
    `[mail-sync] Graph-Fallback "${folder.name}": ${graphCount} von API, ${afterLocal} lokal gespeichert`
  )
  return afterLocal
}

export async function syncMessagesInFolder(
  accountId: string,
  folderRemoteId: string,
  topCount = 50
): Promise<number> {
  if (!(await useEwsMailSync(accountId))) {
    const n = await syncMessagesInFolderGraph(accountId, folderRemoteId, topCount)
    const folder = findFolderByRemoteId(accountId, folderRemoteId)
    console.log(
      `[mail-sync] Graph ${folder?.wellKnown ?? folder?.name ?? folderRemoteId}: ${n} Mails`
    )
    return n
  }
  try {
    await syncMessagesInFolderEws(accountId, folderRemoteId, topCount)
  } catch (e) {
    console.warn('[mail-sync] EWS folder sync failed, Graph fallback:', e)
    const folder = findFolderByRemoteId(accountId, folderRemoteId)
    if (folder) clearEwsSyncStateForFolder(accountId, folder.id)
    return syncMessagesInFolderGraph(accountId, folderRemoteId, topCount)
  }
  return graphFallbackIfFolderStillEmpty(accountId, folderRemoteId, topCount)
}

export async function pollMessagesInFolder(
  accountId: string,
  folderRemoteId: string,
  maxPages = 4
): Promise<{ added: number; from: string | null; to: string | null; remoteIds: string[] }> {
  if (!(await useEwsMailSync(accountId))) {
    return pollMessagesInFolderGraph(accountId, folderRemoteId, maxPages)
  }
  try {
    const result = await pollMessagesInFolderEws(accountId, folderRemoteId, maxPages)
    const folder = findFolderByRemoteId(accountId, folderRemoteId)
    const localCount = folder ? countMessagesInFolder(folder.id) : 0
    const serverTotal = folder?.totalCount ?? 0
    if (localCount === 0 && serverTotal > 0 && result.added === 0) {
      console.warn('[mail-sync] EWS poll leer, Graph-Fallback:', folderRemoteId)
      if (folder) clearEwsSyncStateForFolder(accountId, folder.id)
      const n = await syncMessagesInFolderGraph(accountId, folderRemoteId, 100)
      return { added: n, from: null, to: null, remoteIds: [] }
    }
    return result
  } catch (e) {
    console.warn('[mail-sync] EWS poll failed, Graph fallback:', e)
    return pollMessagesInFolderGraph(accountId, folderRemoteId, maxPages)
  }
}

/** Initial-Sync: Ordner via Graph; Nachrichten/Poll via EWS oder Graph. */
export async function syncAccountInitial(accountId: string): Promise<{
  folders: number
  inboxMessages: number
  sentMessages: number
  draftMessages: number
}> {
  if (!(await useEwsMailSync(accountId))) {
    return syncAccountInitialGraph(accountId)
  }

  const folders = await syncFolders(accountId)

  const inbox = findFolderByWellKnown(accountId, 'inbox')
  let inboxMessages = 0
  if (inbox) {
    inboxMessages = await syncMessagesInFolder(accountId, inbox.remoteId, 50)
  }

  const sent = findFolderByWellKnown(accountId, 'sentitems')
  let sentMessages = 0
  if (sent) {
    sentMessages = await syncMessagesInFolder(accountId, sent.remoteId, 50)
  }

  const drafts = findFolderByWellKnown(accountId, 'drafts')
  let draftMessages = 0
  if (drafts) {
    draftMessages = await syncMessagesInFolder(accountId, drafts.remoteId, 50)
  }

  const importedTotal = inboxMessages + sentMessages + draftMessages
  if (importedTotal > 0) {
    void primeEwsSyncStateForAllFolders(accountId).catch((e) =>
      console.warn('[mail-sync] EWS prime all folders:', e)
    )
  } else {
    console.warn(
      '[mail-sync] EWS-Initialsync: 0 Mails importiert — Sync-State wird nicht vorab gesetzt (Graph-Fallback moeglich)'
    )
  }

  return { folders, inboxMessages, sentMessages, draftMessages }
}
