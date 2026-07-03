import type { NoteEntityLinkTarget } from '@shared/note-entity-links'

export const NOTE_CONTACT_MENTION_PREFIX = '#chronell-contact-' as const
export const NOTE_CALENDAR_EVENT_MENTION_PREFIX = '#chronell-event-' as const
export const NOTE_MAIL_MENTION_PREFIX = '#chronell-mail-' as const
export const NOTE_CLOUD_TASK_MENTION_PREFIX = '#chronell-task-' as const

export const NOTE_ENTITY_MENTION_BASE_CLASS = 'note-entity-mention' as const
export const NOTE_ENTITY_MENTION_NOTE_CLASS = 'note-entity-mention--note' as const
export const NOTE_ENTITY_MENTION_CONTACT_CLASS = 'note-entity-mention--contact' as const
export const NOTE_ENTITY_MENTION_CALENDAR_CLASS = 'note-entity-mention--calendar' as const
export const NOTE_ENTITY_MENTION_MAIL_CLASS = 'note-entity-mention--mail' as const
export const NOTE_ENTITY_MENTION_TASK_CLASS = 'note-entity-mention--task' as const
export const NOTE_WIKI_LINK_CLASS = 'note-wiki-link' as const

export function noteContactMentionHref(contactId: number): string {
  return `${NOTE_CONTACT_MENTION_PREFIX}${contactId}`
}

export function noteCalendarEventMentionHref(accountId: string, graphEventId: string): string {
  return `${NOTE_CALENDAR_EVENT_MENTION_PREFIX}${encodeURIComponent(accountId)}:${encodeURIComponent(graphEventId)}`
}

export function noteMailMentionHref(messageId: number): string {
  return `${NOTE_MAIL_MENTION_PREFIX}${messageId}`
}

export function noteCloudTaskMentionHref(
  accountId: string,
  listId: string,
  taskId: string
): string {
  return `${NOTE_CLOUD_TASK_MENTION_PREFIX}${encodeURIComponent(accountId)}:${encodeURIComponent(listId)}:${encodeURIComponent(taskId)}`
}

export function parseNoteContactMentionHref(href: string | null | undefined): number | null {
  if (!href) return null
  const trimmed = href.trim()
  const match = new RegExp(`^${NOTE_CONTACT_MENTION_PREFIX.replace('#', '\\#')}(\\d+)$`).exec(trimmed)
  if (!match) return null
  const id = Number.parseInt(match[1]!, 10)
  return Number.isFinite(id) && id > 0 ? id : null
}

export function parseNoteMailMentionHref(href: string | null | undefined): number | null {
  if (!href) return null
  const trimmed = href.trim()
  const match = new RegExp(`^${NOTE_MAIL_MENTION_PREFIX.replace('#', '\\#')}(\\d+)$`).exec(trimmed)
  if (!match) return null
  const id = Number.parseInt(match[1]!, 10)
  return Number.isFinite(id) && id > 0 ? id : null
}

export function parseNoteCloudTaskMentionHref(
  href: string | null | undefined
): { accountId: string; listId: string; taskId: string } | null {
  if (!href) return null
  const trimmed = href.trim()
  if (!trimmed.startsWith(NOTE_CLOUD_TASK_MENTION_PREFIX)) return null
  const rest = trimmed.slice(NOTE_CLOUD_TASK_MENTION_PREFIX.length)
  const firstSep = rest.indexOf(':')
  const secondSep = rest.indexOf(':', firstSep + 1)
  if (firstSep <= 0 || secondSep <= firstSep) return null
  try {
    const accountId = decodeURIComponent(rest.slice(0, firstSep))
    const listId = decodeURIComponent(rest.slice(firstSep + 1, secondSep))
    const taskId = decodeURIComponent(rest.slice(secondSep + 1))
    if (!accountId.trim() || !listId.trim() || !taskId.trim()) return null
    return { accountId, listId, taskId }
  } catch {
    return null
  }
}

export function parseNoteCalendarEventMentionHref(
  href: string | null | undefined
): { accountId: string; graphEventId: string } | null {
  if (!href) return null
  const trimmed = href.trim()
  if (!trimmed.startsWith(NOTE_CALENDAR_EVENT_MENTION_PREFIX)) return null
  const rest = trimmed.slice(NOTE_CALENDAR_EVENT_MENTION_PREFIX.length)
  const sep = rest.indexOf(':')
  if (sep <= 0) return null
  try {
    const accountId = decodeURIComponent(rest.slice(0, sep))
    const graphEventId = decodeURIComponent(rest.slice(sep + 1))
    if (!accountId.trim() || !graphEventId.trim()) return null
    return { accountId, graphEventId }
  } catch {
    return null
  }
}

export function parseNoteEntityMentionHref(href: string | null | undefined): NoteEntityLinkTarget | null {
  if (!href) return null
  const normalized = normalizeChronellLinkHref(href.trim())
  const contactId = parseNoteContactMentionHref(normalized)
  if (contactId != null) return { kind: 'people_contact', contactId }
  const messageId = parseNoteMailMentionHref(normalized)
  if (messageId != null) return { kind: 'mail', messageId }
  const task = parseNoteCloudTaskMentionHref(normalized)
  if (task) return { kind: 'cloud_task', ...task }
  const event = parseNoteCalendarEventMentionHref(normalized)
  if (event) return { kind: 'calendar_event', ...event }
  return null
}

export function isNoteEntityMentionHref(href: string | null | undefined): boolean {
  return parseNoteEntityMentionHref(href) != null
}

export type NoteEntityMentionLinkKind =
  | 'note'
  | 'mail'
  | 'cloud_task'
  | 'people_contact'
  | 'calendar_event'

/** Extrahiert Chronell-Hash-Anker auch aus vollständigen URLs (z. B. Electron/TipTap). */
export function normalizeChronellLinkHref(href: string): string {
  const trimmed = href.trim()
  if (!trimmed) return trimmed
  if (trimmed.startsWith('#chronell-')) return trimmed
  const hashIdx = trimmed.indexOf('#chronell-')
  if (hashIdx >= 0) return trimmed.slice(hashIdx)
  return trimmed
}

export function noteWikiReferenceLinkClass(): string {
  return `${NOTE_WIKI_LINK_CLASS} ${NOTE_ENTITY_MENTION_BASE_CLASS} ${NOTE_ENTITY_MENTION_NOTE_CLASS}`
}

export function noteEntityMentionLinkClass(kind: NoteEntityMentionLinkKind): string {
  const kindClass =
    kind === 'note'
      ? NOTE_ENTITY_MENTION_NOTE_CLASS
      : kind === 'mail'
        ? NOTE_ENTITY_MENTION_MAIL_CLASS
        : kind === 'cloud_task'
          ? NOTE_ENTITY_MENTION_TASK_CLASS
          : kind === 'people_contact'
            ? NOTE_ENTITY_MENTION_CONTACT_CLASS
            : NOTE_ENTITY_MENTION_CALENDAR_CLASS
  const wiki = kind === 'note' ? `${NOTE_WIKI_LINK_CLASS} ` : ''
  return `${wiki}${NOTE_ENTITY_MENTION_BASE_CLASS} ${kindClass}`.trim()
}
