import { shouldUseEwsForMicrosoftMail } from './ews/microsoft-mail-transport'
import { findFolderByWellKnown } from './db/folders-repo'
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

export async function syncMessagesInFolder(
  accountId: string,
  folderRemoteId: string,
  topCount = 50
): Promise<number> {
  if (!(await useEwsMailSync(accountId))) {
    return syncMessagesInFolderGraph(accountId, folderRemoteId, topCount)
  }
  try {
    return await syncMessagesInFolderEws(accountId, folderRemoteId, topCount)
  } catch (e) {
    console.warn('[mail-sync] EWS folder sync failed, Graph fallback:', e)
    return syncMessagesInFolderGraph(accountId, folderRemoteId, topCount)
  }
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
    return await pollMessagesInFolderEws(accountId, folderRemoteId, maxPages)
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
    try {
      inboxMessages = await syncMessagesInFolderEws(accountId, inbox.remoteId, 50)
    } catch (e) {
      console.warn('[mail-sync] EWS Inbox failed, Graph fallback:', e)
      inboxMessages = await syncMessagesInFolderGraph(accountId, inbox.remoteId, 50)
    }
  }

  const sent = findFolderByWellKnown(accountId, 'sentitems')
  let sentMessages = 0
  if (sent) {
    try {
      sentMessages = await syncMessagesInFolderEws(accountId, sent.remoteId, 50)
    } catch (e) {
      console.warn('[mail-sync] EWS Sent-Ordner, Graph fallback:', e)
      sentMessages = await syncMessagesInFolderGraph(accountId, sent.remoteId, 50)
    }
  }

  const drafts = findFolderByWellKnown(accountId, 'drafts')
  let draftMessages = 0
  if (drafts) {
    try {
      draftMessages = await syncMessagesInFolderEws(accountId, drafts.remoteId, 50)
    } catch (e) {
      console.warn('[mail-sync] EWS Entwuerfe, Graph fallback:', e)
      draftMessages = await syncMessagesInFolderGraph(accountId, drafts.remoteId, 50)
    }
  }

  void primeEwsSyncStateForAllFolders(accountId).catch((e) =>
    console.warn('[mail-sync] EWS prime all folders:', e)
  )

  return { folders, inboxMessages, sentMessages, draftMessages }
}
