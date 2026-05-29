import type { QuickStepAction } from '@shared/quicksteps'
import { getMessageById } from './db/messages-repo'
import { addMessageTag, listTagsForMessage, removeMessageTag } from './db/message-tags-repo'
import { recordAction } from './db/message-actions-repo'
import {
  applySetReadForMessage,
  applySetFlaggedForMessage,
  applyMoveMessageToFolder,
  applyMoveMessageToWellKnownAlias
} from './message-graph-actions'
import { setMessageCategories as graphSetMessageCategories } from './graph/mail-actions'
import { setTodoForMessage } from './todos-service'
import { routeToWipAfterTodoIfConfigured } from './workflow-mail-folder-routing'
import { snoozeMessage } from './snooze'
import { computeRuleSnoozeWakeAt } from './snooze-presets'
import { listAccounts } from './accounts'
import { BrowserWindow } from 'electron'

function broadcastMailChanged(accountId: string): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('mail:changed', { accountId })
  }
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return text.slice(0, max - 1) + '...'
}

async function applyAddTag(
  messageId: number,
  tag: string,
  source: string
): Promise<void> {
  const msg = getMessageById(messageId)
  if (!msg) return
  const t = tag.trim()
  if (!t) return
  const added = addMessageTag(messageId, msg.accountId, t)
  if (!added) return

  const accounts = await listAccounts()
  if (accounts.find((a) => a.id === msg.accountId)?.provider === 'microsoft') {
    try {
      await graphSetMessageCategories(msg.accountId, msg.remoteId, listTagsForMessage(messageId))
    } catch (e) {
      removeMessageTag(messageId, t)
      broadcastMailChanged(msg.accountId)
      throw e
    }
  }
  broadcastMailChanged(msg.accountId)

  recordAction({
    messageId,
    accountId: msg.accountId,
    actionType: 'add-tag',
    source,
    payload: {
      tag: t,
      label: `QuickStep: Tag „${truncate(t, 40)}“ — ${truncate(msg.subject ?? '(Kein Betreff)', 40)}`
    }
  })
}

/** Fuehrt eine QuickStep-Aktionskette sequentiell aus (logisches UND). */
export async function executeQuickStepActions(
  actions: QuickStepAction[],
  messageId: number,
  source = 'quickstep'
): Promise<void> {
  for (const action of actions) {
    if (!getMessageById(messageId)) {
      console.warn('[quicksteps] Mail existiert nicht mehr, Rest der Sequenz abgebrochen.')
      return
    }

    try {
      switch (action.type) {
        case 'mark_read':
          await applySetReadForMessage(messageId, true, { source })
          break
        case 'mark_unread':
          await applySetReadForMessage(messageId, false, { source })
          break
        case 'archive':
          await applyMoveMessageToWellKnownAlias(messageId, 'archive', { source })
          break
        case 'delete':
          await applyMoveMessageToWellKnownAlias(messageId, 'deleteditems', { source })
          break
        case 'move_to_folder':
          await applyMoveMessageToFolder(messageId, action.folderId, { source })
          break
        case 'add_todo':
          setTodoForMessage(messageId, action.dueKind, { source })
          await routeToWipAfterTodoIfConfigured(messageId)
          break
        case 'mark_flagged':
          await applySetFlaggedForMessage(messageId, true, { source })
          break
        case 'clear_flagged':
          await applySetFlaggedForMessage(messageId, false, { source })
          break
        case 'add_tag':
          await applyAddTag(messageId, action.tag, source)
          break
        case 'snooze': {
          const wake = computeRuleSnoozeWakeAt(action.preset)
          if (wake) {
            await snoozeMessage({
              messageId,
              wakeAt: wake,
              preset: action.preset,
              source
            })
          }
          break
        }
        default:
          break
      }
    } catch (e) {
      console.warn('[quicksteps] Aktion fehlgeschlagen:', action.type, e)
    }
  }
}
