import type { NoteEntityLinkTarget } from '@shared/note-entity-links'
import { buildNoteEntityMentionHtml } from '@/lib/note-entity-mention-export'

export async function linkNoteEntityMention(
  noteId: number,
  target: NoteEntityLinkTarget
): Promise<void> {
  await window.mailClient.notes.links.add({ fromNoteId: noteId, target })
}

export interface CreateNoteCalendarEventInput {
  noteId: number
  accountId: string
  subject: string
  startIso: string
  endIso: string
  isAllDay: boolean
  location?: string | null
}

export async function createAndLinkNoteCalendarEvent(
  input: CreateNoteCalendarEventInput
): Promise<{ html: string; target: NoteEntityLinkTarget }> {
  const created = await window.mailClient.calendar.createEvent({
    accountId: input.accountId,
    subject: input.subject.trim(),
    startIso: input.startIso,
    endIso: input.endIso,
    isAllDay: input.isAllDay,
    location: input.location?.trim() || null,
    bodyHtml: null,
    categories: []
  })
  const graphEventId = created.id?.trim()
  if (!graphEventId) {
    throw new Error('Termin wurde erstellt, aber die ID fehlt in der Antwort.')
  }
  const target: NoteEntityLinkTarget = {
    kind: 'calendar_event',
    accountId: input.accountId,
    graphEventId
  }
  await linkNoteEntityMention(input.noteId, target)
  const html = buildNoteEntityMentionHtml(input.subject, target)
  return { html, target }
}
