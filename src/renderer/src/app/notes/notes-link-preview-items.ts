import type { TFunction } from 'i18next'
import type {
  NoteEntityLinkTarget,
  NoteEntityLinkedItem,
  NoteLinksBundle
} from '@shared/note-entity-links'
import { noteEntityLinkTargetKey } from '@shared/note-entity-links'
import { collectNoteEntityMentionsFromHtml } from '@shared/note-entity-mentions-from-html'
import type { UserNote } from '@shared/types'
import { noteTitle } from '@/app/notes/notes-display-helpers'

export type NotesPreviewLinkEntry = {
  key: string
  target: NoteEntityLinkTarget
  label: string
  subtitle?: string | null
  kindLabel: string
  direction: 'primary' | 'outgoing' | 'incoming'
}

/** Ergänzt ausgehende Verknüpfungen um @-Erwähnungen aus dem Notiz-HTML (wie in der Kachelansicht). */
export function mergeNoteLinksWithBodyMentions(
  outgoing: NoteEntityLinkedItem[],
  bodyHtml: string | undefined,
  noteId: number
): NoteEntityLinkedItem[] {
  if (!bodyHtml?.trim()) return outgoing

  const seen = new Set(outgoing.map((item) => noteEntityLinkTargetKey(item.target)))
  const merged = [...outgoing]

  for (const mention of collectNoteEntityMentionsFromHtml(bodyHtml)) {
    if (mention.target.kind === 'note' && mention.target.noteId === noteId) continue
    const key = noteEntityLinkTargetKey(mention.target)
    if (seen.has(key)) continue
    seen.add(key)
    merged.push({
      linkId: 0,
      target: mention.target,
      title: mention.title,
      subtitle: null,
      createdAt: ''
    })
  }

  return merged
}

export function buildNotesPreviewLinkEntries(
  editing: UserNote,
  bundle: NoteLinksBundle,
  t: TFunction,
  bodyHtml?: string
): NotesPreviewLinkEntry[] {
  const out: NotesPreviewLinkEntry[] = []
  const seen = new Set<string>()

  const push = (
    target: NoteEntityLinkTarget,
    label: string,
    kindLabel: string,
    direction: NotesPreviewLinkEntry['direction'],
    subtitle?: string | null
  ): void => {
    const key = noteEntityLinkTargetKey(target)
    if (seen.has(key)) return
    seen.add(key)
    out.push({ key, target, label, subtitle, kindLabel, direction })
  }

  if (editing.kind === 'mail' && editing.messageId != null) {
    push(
      { kind: 'mail', messageId: editing.messageId },
      editing.title?.trim() || t('common.noSubject'),
      t('notes.links.kind.mail'),
      'primary'
    )
  }

  if (
    editing.kind === 'calendar' &&
    editing.accountId &&
    editing.eventRemoteId
  ) {
    push(
      {
        kind: 'calendar_event',
        accountId: editing.accountId,
        graphEventId: editing.eventRemoteId
      },
      editing.eventTitleSnapshot?.trim() || editing.title?.trim() || t('calendar.eventPreview.noTitle'),
      t('notes.links.kind.calendar_event'),
      'primary'
    )
  }

  for (const item of mergeNoteLinksWithBodyMentions(bundle.outgoing, bodyHtml, editing.id)) {
    push(
      item.target,
      item.title,
      t(`notes.links.kind.${item.target.kind}`),
      'outgoing',
      item.subtitle
    )
  }

  for (const item of bundle.incoming) {
    push(
      item.target,
      item.title,
      t(`notes.links.kind.${item.target.kind}`),
      'incoming',
      item.subtitle
    )
  }

  return out
}

export function findPreviewEntryByKey(
  entries: NotesPreviewLinkEntry[],
  key: string | null
): NotesPreviewLinkEntry | null {
  if (!key) return entries[0] ?? null
  return entries.find((e) => e.key === key) ?? entries[0] ?? null
}

export function linkedItemToPreviewEntry(
  item: NoteEntityLinkedItem,
  direction: 'outgoing' | 'incoming',
  t: TFunction
): NotesPreviewLinkEntry {
  return {
    key: noteEntityLinkTargetKey(item.target),
    target: item.target,
    label: item.title,
    subtitle: item.subtitle,
    kindLabel: t(`notes.links.kind.${item.target.kind}`),
    direction
  }
}
