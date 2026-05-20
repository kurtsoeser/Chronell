import type { ChronellEntityRef } from '@shared/entity-ref'
import type { AppShellMode } from '@/stores/app-mode'
import { openNoteEntityLinkTarget } from '@/lib/note-entity-link-nav'
import { useMailPendingFocusStore } from '@/stores/mail-pending-focus'

/** Navigiert zu einem verknüpften Objekt im passenden App-Modus. */
export async function openEntityRef(
  target: ChronellEntityRef,
  setAppMode: (mode: AppShellMode) => void
): Promise<void> {
  if (target.kind === 'mail_todo') {
    const messageId = await window.mailClient.entityLinks.getMailTodoMessageId(target.todoId)
    if (messageId) {
      useMailPendingFocusStore.getState().setPendingMessageId(messageId)
    }
    setAppMode('mail')
    return
  }
  await openNoteEntityLinkTarget(target, setAppMode)
}
