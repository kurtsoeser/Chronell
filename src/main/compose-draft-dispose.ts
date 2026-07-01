import { BrowserWindow } from 'electron'
import { listAccounts } from './accounts'
import { findFolderByWellKnown, adjustFolderUnread } from './db/folders-repo'
import { getMessageById } from './db/messages-repo'
import { deleteMessageLocal } from './db/messages-repo-ops'
import { deleteMessageRemote } from './graph/mail-actions'
import { isGraphItemNotFound } from './graph/graph-request-errors'
import { gmailDeleteDraftRemote } from './google/gmail-compose'
import { runFolderSync } from './sync-runner'
import { logBackgroundError } from './log-background-error'

function broadcastMailChanged(accountId: string): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('mail:changed', { accountId })
  }
}

export type DisposeComposeDraftOpts = {
  accountId: string
  /** Server-Entwurf (Graph message id oder Gmail draft resource id). */
  remoteDraftId?: string | null
  /** Lokale Mail aus dem Entwuerfe-Ordner (nach Sync). */
  linkedMessageId?: number | null
  /**
   * Entwurf wurde per Send-from-Draft entfernt (Graph /send, Gmail drafts.send).
   * Dann nur noch lokale Kopie und ggf. Gmail-Nachrichtenrest bereinigen.
   */
  draftConsumedOnSend?: boolean
}

/**
 * Entfernt einen Server-Entwurf aus der lokalen DB und loest Ordner-Sync aus,
 * damit die Mail in der Entwuerfe-Liste verschwindet.
 */
export async function disposeComposeDraft(opts: DisposeComposeDraftOpts): Promise<void> {
  const accountId = opts.accountId
  if (!accountId) return

  const accounts = await listAccounts()
  const acc = accounts.find((a) => a.id === accountId)
  if (!acc) return

  let messageRemoteId: string | null = null
  const linkedId = opts.linkedMessageId
  if (linkedId != null && Number.isFinite(linkedId)) {
    const msg = getMessageById(linkedId)
    if (msg) {
      messageRemoteId = msg.remoteId?.trim() || null
      if (msg.folderId != null && !msg.isRead) {
        adjustFolderUnread(msg.folderId, -1)
      }
    }
    deleteMessageLocal(linkedId)
  }

  const remoteDraftId = opts.remoteDraftId?.trim() || null
  if (!opts.draftConsumedOnSend && remoteDraftId) {
    try {
      if (acc.provider === 'microsoft') {
        await deleteMessageRemote(accountId, remoteDraftId)
      } else {
        await gmailDeleteDraftRemote(accountId, remoteDraftId, messageRemoteId)
      }
    } catch (e) {
      if (!isGraphItemNotFound(e)) {
        console.warn('[compose] Entwurf auf dem Server entfernen:', e)
      }
    }
  } else if (acc.provider === 'google' && messageRemoteId) {
    try {
      await gmailDeleteDraftRemote(accountId, null, messageRemoteId)
    } catch (e) {
      console.warn('[compose] Gmail-Entwurf (Nachricht) entfernen:', e)
    }
  }

  const draftsFolder = findFolderByWellKnown(accountId, 'drafts')
  if (draftsFolder) {
    void runFolderSync(draftsFolder.id).catch((err) => logBackgroundError('mail.runFolderSync', err))
  }
  broadcastMailChanged(accountId)
}
