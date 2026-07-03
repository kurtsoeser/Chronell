import type { NoteEntityLinkTarget } from '@shared/note-entity-links'
import {
  noteCalendarEventMentionHref,
  noteCloudTaskMentionHref,
  noteContactMentionHref,
  noteEntityMentionLinkClass,
  noteMailMentionHref
} from '@shared/note-entity-mention-link'
import { noteWikiLinkHref } from '@shared/note-wiki-link'

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function buildNoteEntityMentionHtml(title: string, target: NoteEntityLinkTarget): string {
  const label = title.trim() || '—'
  if (target.kind === 'note') {
    const href = noteWikiLinkHref(target.noteId)
    const cls = noteEntityMentionLinkClass('note')
    return `<a href="${href}" class="${cls}" rel="noopener noreferrer">${escapeHtml(label)}</a>`
  }
  if (target.kind === 'people_contact') {
    const href = noteContactMentionHref(target.contactId)
    const cls = noteEntityMentionLinkClass('people_contact')
    return `<a href="${href}" class="${cls}" rel="noopener noreferrer">${escapeHtml(label)}</a>`
  }
  if (target.kind === 'mail') {
    const href = noteMailMentionHref(target.messageId)
    const cls = noteEntityMentionLinkClass('mail')
    return `<a href="${href}" class="${cls}" rel="noopener noreferrer">${escapeHtml(label)}</a>`
  }
  if (target.kind === 'cloud_task') {
    const href = noteCloudTaskMentionHref(target.accountId, target.listId, target.taskId)
    const cls = noteEntityMentionLinkClass('cloud_task')
    return `<a href="${href}" class="${cls}" rel="noopener noreferrer">${escapeHtml(label)}</a>`
  }
  if (target.kind === 'calendar_event') {
    const href = noteCalendarEventMentionHref(target.accountId, target.graphEventId)
    const cls = noteEntityMentionLinkClass('calendar_event')
    return `<a href="${href}" class="${cls}" rel="noopener noreferrer">${escapeHtml(label)}</a>`
  }
  return `<span>${escapeHtml(label)}</span>`
}
