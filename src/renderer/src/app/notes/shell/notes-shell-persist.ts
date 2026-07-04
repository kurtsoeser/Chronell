import { normalizeNoteBodyForStorage } from '@/lib/note-body-html'
import { noteEditingHasUnsavedChanges } from '@/lib/notes-autosave'
import { rewriteInkBase64ToMediaUrls } from '@/lib/note-ink-storage'
import type { UserNote } from '@shared/types'
import type { NoteScheduleDraft, UserNoteScheduleFieldsForSave } from '@/app/notes/shell/notes-shell-types'

export function scheduleFieldsFromDraft(draft: NoteScheduleDraft | null): UserNoteScheduleFieldsForSave {
  if (!draft) return {}
  if (draft.clearSchedule) {
    return {
      scheduledStartIso: null,
      scheduledEndIso: null,
      scheduledAllDay: false,
      clearSchedule: true
    }
  }
  return {
    scheduledStartIso: draft.scheduledStartIso,
    scheduledEndIso: draft.scheduledEndIso,
    scheduledAllDay: draft.scheduledAllDay
  }
}

export async function persistUserNoteEdits(
  invalidNoteMessage: string,
  note: UserNote,
  input: {
    title: string
    bodyHtml: string
    scheduleDraft: NoteScheduleDraft | null
  }
): Promise<UserNote> {
  const bodyWithInkUrls = await rewriteInkBase64ToMediaUrls(note.id, input.bodyHtml)
  const bodyToSave = normalizeNoteBodyForStorage(bodyWithInkUrls)
  const schedule = scheduleFieldsFromDraft(input.scheduleDraft)

  if (note.kind === 'standalone') {
    return window.mailClient.notes.updateStandalone({
      id: note.id,
      title: input.title,
      body: bodyToSave,
      ...(schedule.clearSchedule ? { clearSchedule: true } : {}),
      ...(!schedule.clearSchedule && input.scheduleDraft
        ? {
            scheduledStartIso: schedule.scheduledStartIso,
            scheduledEndIso: schedule.scheduledEndIso,
            scheduledAllDay: schedule.scheduledAllDay
          }
        : {})
    })
  }
  if (note.kind === 'mail' && note.messageId != null) {
    return window.mailClient.notes.upsertMail({
      messageId: note.messageId,
      title: input.title,
      body: bodyToSave,
      ...(input.scheduleDraft
        ? {
            scheduledStartIso: schedule.scheduledStartIso,
            scheduledEndIso: schedule.scheduledEndIso,
            scheduledAllDay: schedule.scheduledAllDay
          }
        : {})
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
      title: input.title,
      body: bodyToSave,
      eventTitleSnapshot: note.eventTitleSnapshot,
      eventStartIsoSnapshot: note.eventStartIsoSnapshot,
      ...(input.scheduleDraft
        ? {
            scheduledStartIso: schedule.scheduledStartIso,
            scheduledEndIso: schedule.scheduledEndIso,
            scheduledAllDay: schedule.scheduledAllDay
          }
        : {})
    })
  }
  throw new Error(invalidNoteMessage)
}

export function readNoteEditingUnsavedChanges(
  note: UserNote,
  input: {
    editTitle: string
    editBodyHtml: string
    lastSavedTitle: string
    lastSavedBody: string
    scheduleDraft: NoteScheduleDraft | null
  }
): boolean {
  const scheduleNote =
    input.scheduleDraft && !input.scheduleDraft.clearSchedule
      ? {
          scheduledStartIso: input.scheduleDraft.scheduledStartIso,
          scheduledEndIso: input.scheduleDraft.scheduledEndIso,
          scheduledAllDay: input.scheduleDraft.scheduledAllDay
        }
      : note
  return noteEditingHasUnsavedChanges({
    editTitle: input.editTitle,
    editBodyHtml: input.editBodyHtml,
    lastSavedTitle: input.lastSavedTitle,
    lastSavedBody: input.lastSavedBody,
    scheduleDraft: input.scheduleDraft,
    note: scheduleNote
  })
}
