import type { MailFolder } from '@shared/types'
import { findFolderById, setFolderMailboxCountsLocal } from './db/folders-repo'
import { markAllMessagesReadInFolderLocal } from './db/messages-repo'
import { broadcastMailChanged } from './ipc/ipc-broadcasts'
import { listAccounts } from './accounts'
import { gmailMarkFolderAsRead } from './google/gmail-actions'
import { getGoogleApis } from './google/google-auth-client'
import { microsoftMarkFolderAsRead } from './ews/microsoft-mail-actions-facade'
import { runFolderSync } from './sync-runner'
import { isMicrosoftAuthUnavailable } from './auth/auth-errors'
import { createGraphClient } from './graph/client'
import { loadConfig } from './config'

async function refreshFolderUnreadFromServer(folder: MailFolder): Promise<void> {
  const accounts = await listAccounts()
  const acc = accounts.find((a) => a.id === folder.accountId)
  if (!acc) return

  try {
    if (acc.provider === 'google') {
      const { gmail } = await getGoogleApis(folder.accountId)
      const lab = await gmail.users.labels.get({ userId: 'me', id: folder.remoteId })
      setFolderMailboxCountsLocal(
        folder.id,
        lab.data.messagesUnread ?? 0,
        lab.data.messagesTotal ?? folder.totalCount
      )
      return
    }

    const config = await loadConfig()
    if (!config.microsoftClientId) return
    const homeAccountId = folder.accountId.replace(/^ms:/, '')
    const client = createGraphClient(config.microsoftClientId, homeAccountId)
    const stats = (await client
      .api(`/me/mailFolders/${folder.remoteId}`)
      .select('unreadItemCount,totalItemCount')
      .get()) as { unreadItemCount?: number; totalItemCount?: number }
    setFolderMailboxCountsLocal(
      folder.id,
      stats.unreadItemCount ?? 0,
      stats.totalItemCount ?? folder.totalCount
    )
  } catch (e) {
    console.warn('[folder-read-actions] refreshFolderUnreadFromServer:', e)
  }
}

/**
 * Markiert alle Mails im Ordner lokal und auf dem Server als gelesen.
 */
export async function applyMarkAllReadInFolder(folderId: number): Promise<{ markedLocal: number }> {
  const folder = findFolderById(folderId)
  if (!folder) throw new Error('Ordner nicht gefunden.')

  const markedLocal = markAllMessagesReadInFolderLocal(folderId)
  broadcastMailChanged(folder.accountId, { folderIds: [folderId] })

  const accounts = await listAccounts()
  const acc = accounts.find((a) => a.id === folder.accountId)

  try {
    if (acc?.provider === 'google') {
      await gmailMarkFolderAsRead(folder.accountId, folder.remoteId)
    } else if (acc?.provider === 'microsoft') {
      await microsoftMarkFolderAsRead(folder.accountId, folder)
    }
    await refreshFolderUnreadFromServer(folder)
    broadcastMailChanged(folder.accountId, { folderIds: [folderId] })
  } catch (e) {
    if (isMicrosoftAuthUnavailable(e)) {
      console.warn(
        `[folder-read-actions] markAllRead: Server nicht erreichbar fuer Konto ${folder.accountId} — nur lokal markiert.`
      )
      return { markedLocal }
    }
    throw e
  }

  void runFolderSync(folderId).catch((err) =>
    console.warn('[folder-read-actions] Sync nach markAllRead fehlgeschlagen:', err)
  )

  return { markedLocal }
}
