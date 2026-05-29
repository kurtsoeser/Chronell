import {
  deleteMessageRemote as graphDeleteMessageRemote,
  moveMessage as graphMoveMessage,
  setMessageRead as graphSetMessageRead
} from '../graph/mail-actions'
import {
  ewsDeleteMessage,
  ewsMoveMessageToDistinguishedFolder,
  ewsMoveMessageToFolder,
  ewsSetMessageRead
} from './mail-actions'
import { shouldUseEwsForMicrosoftMail } from './microsoft-mail-transport'

export async function microsoftSetMessageRead(
  accountId: string,
  remoteId: string,
  isRead: boolean
): Promise<void> {
  if (await shouldUseEwsForMicrosoftMail(accountId)) {
    try {
      await ewsSetMessageRead(accountId, remoteId, isRead)
      return
    } catch (e) {
      console.warn('[ews] setRead fallback to Graph:', e)
    }
  }
  await graphSetMessageRead(accountId, remoteId, isRead)
}

export async function microsoftMoveMessage(
  accountId: string,
  remoteId: string,
  destination: string,
  opts?: { distinguishedFolder?: 'archive' | 'deleteditems' }
): Promise<string> {
  if (await shouldUseEwsForMicrosoftMail(accountId)) {
    try {
      if (opts?.distinguishedFolder) {
        await ewsMoveMessageToDistinguishedFolder(accountId, remoteId, opts.distinguishedFolder)
      } else {
        await ewsMoveMessageToFolder(accountId, remoteId, destination)
      }
      return remoteId
    } catch (e) {
      console.warn('[ews] move fallback to Graph:', e)
    }
  }
  return graphMoveMessage(accountId, remoteId, destination)
}

export async function microsoftDeleteMessageRemote(
  accountId: string,
  remoteId: string,
  opts?: { permanent?: boolean }
): Promise<void> {
  if (await shouldUseEwsForMicrosoftMail(accountId)) {
    try {
      await ewsDeleteMessage(accountId, remoteId, opts)
      return
    } catch (e) {
      console.warn('[ews] delete fallback to Graph:', e)
    }
  }
  await graphDeleteMessageRemote(accountId, remoteId)
}
