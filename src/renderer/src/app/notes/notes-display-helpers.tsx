import type { ComponentType } from 'react'
import type { TFunction } from 'i18next'
import { CalendarDays, CheckSquare, Mail, StickyNote, User } from 'lucide-react'
import type { UserNote, UserNoteListItem } from '@shared/types'

export type NoteDisplayIconKind = 'mail' | 'calendar' | 'task' | 'contact' | 'standalone'

export function resolveNoteDisplayIconKind(
  note: Pick<UserNote, 'kind'> & Pick<Partial<UserNoteListItem>, 'primaryLinkKind'>
): NoteDisplayIconKind {
  if (note.kind === 'mail') return 'mail'
  if (note.kind === 'calendar') return 'calendar'
  if (note.primaryLinkKind === 'mail') return 'mail'
  if (note.primaryLinkKind === 'calendar_event') return 'calendar'
  if (note.primaryLinkKind === 'cloud_task') return 'task'
  if (note.primaryLinkKind === 'people_contact') return 'contact'
  return 'standalone'
}

export function noteDisplayIcon(kind: NoteDisplayIconKind): ComponentType<{ className?: string }> {
  if (kind === 'mail') return Mail
  if (kind === 'calendar') return CalendarDays
  if (kind === 'task') return CheckSquare
  if (kind === 'contact') return User
  return StickyNote
}

export function formatNoteDate(value: string, locale: string): string {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleString(locale.startsWith('de') ? 'de-DE' : 'en-GB')
}

export function noteKindLabel(
  note: Pick<UserNote, 'kind'> & Pick<Partial<UserNoteListItem>, 'primaryLinkKind'>,
  t: TFunction
): string {
  if (note.primaryLinkKind === 'people_contact') return t('notes.kind.contact')
  if (note.primaryLinkKind === 'mail') return t('notes.kind.mail')
  if (note.primaryLinkKind === 'calendar_event') return t('notes.kind.calendar')
  if (note.primaryLinkKind === 'cloud_task') return t('notes.kind.task')
  if (note.kind === 'mail') return t('notes.kind.mail')
  if (note.kind === 'calendar') return t('notes.kind.calendar')
  return t('notes.kind.standalone')
}

export function noteTitle(
  note: Pick<UserNote, 'kind' | 'title' | 'eventTitleSnapshot'> &
    Partial<Pick<UserNoteListItem, 'mailSubject'>>,
  fallback: string
): string {
  if (note.title?.trim()) return note.title.trim()
  if (note.kind === 'mail' && note.mailSubject?.trim()) return note.mailSubject.trim()
  if (note.kind === 'calendar' && note.eventTitleSnapshot?.trim()) return note.eventTitleSnapshot.trim()
  return fallback
}

export function markdownPreviewText(value: string): string {
  return value
    .slice(0, 1200)
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^\s{0,3}(#{1,6}|[-*+]\s+|\d+\.\s+|>\s?)/gm, '')
    .replace(/[*_~>#]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}
