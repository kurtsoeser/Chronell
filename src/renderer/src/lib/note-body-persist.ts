import type { UserNote, UserNoteListItem } from '@shared/types'
import { storedBodyFromEditorHtml } from '@/lib/note-body-html'

export async function persistNoteListItemBody(
  note: UserNoteListItem,
  editorHtml: string
): Promise<UserNote> {
  const storedBody = storedBodyFromEditorHtml(editorHtml)
  if (note.kind === 'standalone') {
    return window.mailClient.notes.updateStandalone({
      id: note.id,
      title: note.title ?? '',
      body: storedBody
    })
  }
  if (note.kind === 'mail' && note.messageId != null) {
    return window.mailClient.notes.upsertMail({
      messageId: note.messageId,
      title: note.title ?? '',
      body: storedBody
    })
  }
  if (
    note.kind === 'calendar' &&
    note.accountId &&
    note.calendarSource &&
    note.calendarRemoteId &&
    note.eventRemoteId
  ) {
    return window.mailClient.notes.upsertCalendar({
      accountId: note.accountId,
      calendarSource: note.calendarSource,
      calendarRemoteId: note.calendarRemoteId,
      eventRemoteId: note.eventRemoteId,
      title: note.title ?? '',
      body: storedBody,
      eventTitleSnapshot: note.eventTitleSnapshot,
      eventStartIsoSnapshot: note.eventStartIsoSnapshot
    })
  }
  throw new Error('invalid note')
}

export function userNoteToListItem(note: UserNote): UserNoteListItem {
  return {
    ...note,
    mailSubject: null,
    mailAccountId: null,
    mailFromAddr: null,
    mailFromName: null,
    mailSnippet: null,
    mailSentAt: null,
    mailReceivedAt: null,
    mailHasAttachments: null,
    primaryLinkKind: null
  }
}
