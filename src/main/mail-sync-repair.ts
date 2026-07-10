import { listAccounts } from './accounts'
import { findFolderByWellKnown } from './db/folders-repo'
import { countMessagesForAccount, countMessagesInFolder } from './db/messages-repo'
import { getFolderSyncState } from './db/sync-state-repo'
import { isEwsSyncStateToken } from './ews/ews-sync-folder-items'
import { getDb } from './db'
import { syncFolders, syncMessagesInFolder as syncMessagesInFolderGraph } from './graph/mail-sync'
import { touchAccountMailSyncFinished } from './db/account-mail-sync-meta-repo'
import { broadcastMailChanged } from './ipc/ipc-broadcasts'
import { isAppOnline } from './network-status'

function clearSyncStateForAccount(accountId: string): void {
  getDb().prepare('DELETE FROM sync_state WHERE account_id = ?').run(accountId)
}

/**
 * Erkennt „Sync meldet Erfolg, aber 0 Mails lokal“ — typisch nach EWS-SyncState ohne Import.
 * Setzt sync_state zurueck und erzwingt einen Graph-basierten Vollabruf.
 */
export async function repairMicrosoftMailSyncIfNeeded(accountId: string): Promise<boolean> {
  const accounts = await listAccounts()
  const acc = accounts.find((a) => a.id === accountId)
  if (!acc || acc.provider !== 'microsoft') return false

  const inbox = findFolderByWellKnown(accountId, 'inbox')
  if (!inbox) return false

  const localInbox = countMessagesInFolder(inbox.id)
  const localAccount = countMessagesForAccount(accountId)
  const serverInboxTotal = inbox.totalCount ?? 0
  const st = getFolderSyncState(accountId, inbox.id)
  const hasEwsToken = isEwsSyncStateToken(st?.deltaToken)
  const hasAnySyncState = Boolean(st?.deltaToken || st?.lastSyncedAt)

  if (localInbox > 0) return false

  const looksBroken =
    serverInboxTotal > 0 ||
    hasEwsToken ||
    (hasAnySyncState && localAccount === 0) ||
    (localAccount === 0 && hasAnySyncState)

  if (!looksBroken) return false

  console.warn(
    `[mail-repair] Konto ${accountId}: Posteingang leer (lokal=${localInbox}, Server≈${serverInboxTotal}, EWS-Token=${hasEwsToken}) — Sync-State zuruecksetzen und Vollabruf`
  )

  clearSyncStateForAccount(accountId)

  if (!isAppOnline()) return true

  try {
    await syncFolders(accountId)
    const inboxFresh = findFolderByWellKnown(accountId, 'inbox')
    if (!inboxFresh) return true

    const remoteInboxTotal = inboxFresh.totalCount ?? 0
    const repairOpts = { ignoreSyncWindow: true as const }
    const imported = await syncMessagesInFolderGraph(
      accountId,
      inboxFresh.remoteId,
      250,
      repairOpts
    )
    const sent = findFolderByWellKnown(accountId, 'sentitems')
    if (sent) {
      await syncMessagesInFolderGraph(accountId, sent.remoteId, 100, repairOpts).catch((e) =>
        console.warn('[mail-repair] Gesendet:', e)
      )
    }
    const after = countMessagesInFolder(inboxFresh.id)
    if (after === 0 && remoteInboxTotal > 0 && imported === 0) {
      console.warn(
        `[mail-repair] Konto ${accountId}: Server meldet ${remoteInboxTotal} Mails, aber kein Import — pruefe Sync-Fenster oder Berechtigungen.`
      )
    } else {
      console.log(
        `[mail-repair] Nach Graph-Reparatur: ${after} Mails im Posteingang (API meldete ${imported})`
      )
    }
    touchAccountMailSyncFinished(accountId)
    broadcastMailChanged(accountId)
    return true
  } catch (e) {
    console.error('[mail-repair] Graph-Vollabruf fehlgeschlagen:', accountId, e)
    throw e
  }
}

export async function repairAllMicrosoftMailSyncIfNeeded(): Promise<void> {
  const accounts = await listAccounts()
  for (const acc of accounts) {
    if (acc.provider !== 'microsoft') continue
    try {
      await repairMicrosoftMailSyncIfNeeded(acc.id)
    } catch (e) {
      console.error('[mail-repair] Konto uebersprungen:', acc.id, e)
    }
  }
}
