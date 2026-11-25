import i18n from 'i18next'
import type { OneNoteSendMailResult } from '@shared/types/onenote'
import type { MailContextHandlers } from '@/lib/mail-context-menu'
import { openExternalUrl } from '@/lib/open-external'
import { showAppAlert, showAppChoice } from '@/stores/app-dialog'
import { pickOneNoteDestination } from '@/stores/onenote-destination-picker'

async function showOneNoteOpenDialog(result: OneNoteSendMailResult): Promise<void> {
  const lines = [
    i18n.t('oneNote.sendSuccess', {
      notebook: result.notebookName,
      section: result.sectionName
    })
  ]
  if (result.hasAttachments) lines.push(i18n.t('oneNote.sendSuccessAttachments'))
  const actions: Array<{ id: string; label: string; variant: 'primary' | 'secondary' }> = []
  if (result.webUrl) {
    actions.push({
      id: 'web',
      label: i18n.t('oneNote.openWeb'),
      variant: result.clientUrl ? 'secondary' : 'primary'
    })
  }
  if (result.clientUrl) {
    actions.push({ id: 'app', label: i18n.t('oneNote.openApp'), variant: 'primary' })
  }
  if (actions.length === 0) {
    await showAppAlert(lines.join('\n\n'), { title: i18n.t('oneNote.title') })
    return
  }
  const choice = await showAppChoice(lines.join('\n\n'), {
    title: i18n.t('oneNote.title'),
    cancelLabel: i18n.t('common.close'),
    actions
  })
  if (choice === 'web' && result.webUrl) {
    await openExternalUrl(result.webUrl)
  } else if (choice === 'app' && result.clientUrl) {
    try {
      await openExternalUrl(result.clientUrl)
    } catch {
      if (result.webUrl) await openExternalUrl(result.webUrl)
    }
  }
}

async function runOneNoteWithErrorHandling(fn: () => Promise<void>): Promise<void> {
  try {
    await fn()
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await showAppAlert(i18n.t('oneNote.sendFailed', { message }), {
      title: i18n.t('oneNote.title')
    })
  }
}

export async function pickAndSendMailToOneNote(
  messageId: number,
  subject?: string | null
): Promise<void> {
  const pick = await pickOneNoteDestination({ messageId, subject })
  if (!pick) return
  const result = await window.mailClient.onenote.sendMail({
    messageId,
    notebookId: pick.notebookId,
    sectionId: pick.sectionId,
    notebookName: pick.notebookName,
    sectionName: pick.sectionName
  })
  await showOneNoteOpenDialog(result)
}

export function createMailSendToOneNoteHandler(): NonNullable<
  MailContextHandlers['sendToOneNote']
> {
  return (message): void => {
    void runOneNoteWithErrorHandling(() =>
      pickAndSendMailToOneNote(message.id, message.subject?.trim() || null)
    )
  }
}
