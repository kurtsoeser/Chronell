import i18n from 'i18next'
import { buildMailNoteInsertHtml } from '@shared/mail-note-insert-html'
import type { MailFull, UserNote } from '@shared/types'
import { prepareNoteBodyForEditor, storedBodyFromEditorHtml } from '@/lib/note-body-html'
import { useAppModeStore } from '@/stores/app-mode'
import { useNotesPendingFocusStore } from '@/stores/notes-pending-focus'
import { useNotePickerStore } from '@/stores/note-picker'
import { showAppAlert } from '@/stores/app-dialog'
import type { MailContextHandlers } from '@/lib/mail-context-menu'

export interface MailNoteSelection {
  text?: string
}

function mailInsertLabels() {
  return {
    from: i18n.t('notes.mailInsert.from'),
    to: i18n.t('notes.mailInsert.to'),
    date: i18n.t('notes.mailInsert.date'),
    subject: i18n.t('notes.mailInsert.subject'),
    excerpt: i18n.t('notes.mailInsert.excerpt')
  }
}

function buildSnippet(mail: MailFull, selection?: MailNoteSelection | null): string {
  const locale = i18n.language.startsWith('de') ? 'de-DE' : 'en-GB'
  return buildMailNoteInsertHtml(mail, mailInsertLabels(), {
    selectionText: selection?.text,
    locale
  })
}

function appendHtmlToBody(existingBody: string, snippetHtml: string): string {
  const prepared = prepareNoteBodyForEditor(existingBody).html
  if (!prepared.trim()) return snippetHtml
  return `${prepared}<hr><p></p>${snippetHtml}`
}

async function linkMailToNote(noteId: number, messageId: number): Promise<void> {
  try {
    await window.mailClient.notes.links.add({
      fromNoteId: noteId,
      target: { kind: 'mail', messageId }
    })
  } catch {
    // Idempotent — Verknüpfung existiert ggf. bereits.
  }
}

async function persistStandaloneBody(
  note: UserNote,
  editorHtml: string
): Promise<UserNote> {
  return window.mailClient.notes.updateStandalone({
    id: note.id,
    title: note.title ?? '',
    body: storedBodyFromEditorHtml(editorHtml)
  })
}

export function openCreatedNote(noteId: number): void {
  useNotesPendingFocusStore.getState().setPendingNoteId(noteId)
  useAppModeStore.getState().setMode('notes')
}

export async function sendMailToNewNote(
  messageId: number,
  selection?: MailNoteSelection | null
): Promise<UserNote | null> {
  const mail = await window.mailClient.mail.getMessage(messageId)
  if (!mail) {
    await showAppAlert(i18n.t('notes.mailInsert.mailNotFound'), {
      title: i18n.t('notes.mailInsert.title')
    })
    return null
  }

  const snippet = buildSnippet(mail, selection)
  const note = await window.mailClient.notes.createStandalone({
    title: mail.subject?.trim() || i18n.t('common.noSubject'),
    body: storedBodyFromEditorHtml(snippet),
    sectionId: null
  })
  await linkMailToNote(note.id, messageId)
  openCreatedNote(note.id)
  return note
}

export async function appendMailToNote(
  noteId: number,
  messageId: number,
  selection?: MailNoteSelection | null
): Promise<UserNote | null> {
  const [mail, note] = await Promise.all([
    window.mailClient.mail.getMessage(messageId),
    window.mailClient.notes.getById(noteId)
  ])
  if (!mail) {
    await showAppAlert(i18n.t('notes.mailInsert.mailNotFound'), {
      title: i18n.t('notes.mailInsert.title')
    })
    return null
  }
  if (!note || note.kind !== 'standalone') {
    await showAppAlert(i18n.t('notes.mailInsert.noteNotFound'), {
      title: i18n.t('notes.mailInsert.title')
    })
    return null
  }

  const snippet = buildSnippet(mail, selection)
  const combined = appendHtmlToBody(note.body, snippet)
  const saved = await persistStandaloneBody(note, combined)
  await linkMailToNote(saved.id, messageId)
  openCreatedNote(saved.id)
  return saved
}

export async function runMailToNoteWithErrorHandling(
  fn: () => Promise<UserNote | null>
): Promise<UserNote | null> {
  try {
    return await fn()
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    await showAppAlert(i18n.t('notes.mailInsert.failed', { message }), {
      title: i18n.t('notes.mailInsert.title')
    })
    return null
  }
}

export function createMailSendToNewNoteHandler(): NonNullable<
  MailContextHandlers['sendMailToNewNote']
> {
  return (msg): void => {
    void runMailToNoteWithErrorHandling(() => sendMailToNewNote(msg.id))
  }
}

export function createMailSendToExistingNoteHandler(): NonNullable<
  MailContextHandlers['sendMailToExistingNote']
> {
  return (msg): void => {
    useNotePickerStore.getState().openForMailAppend(msg.id)
  }
}

export function openMailSelectionToNewNote(
  messageId: number,
  selection: MailNoteSelection
): void {
  void runMailToNoteWithErrorHandling(() => sendMailToNewNote(messageId, selection))
}

export function openMailSelectionToExistingNote(
  messageId: number,
  selection: MailNoteSelection
): void {
  useNotePickerStore.getState().openForMailAppend(messageId, selection)
}
