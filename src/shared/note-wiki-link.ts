import type { NoteEntityLinkTarget } from '@shared/note-entity-links'
import { normalizeChronellLinkHref } from './note-entity-mention-link'

/** Hash-Anker für interne Notiz-Verknüpfungen im TipTap-HTML. */
export const NOTE_WIKI_LINK_PREFIX = '#chronell-note-'

export function noteWikiLinkHref(noteId: number): string {
  return `${NOTE_WIKI_LINK_PREFIX}${noteId}`
}

export function parseNoteWikiLinkHref(href: string | null | undefined): number | null {
  if (!href) return null
  const trimmed = normalizeChronellLinkHref(href.trim())
  const hashMatch = /^#chronell-note-(\d+)$/.exec(trimmed)
  if (hashMatch) {
    const id = Number.parseInt(hashMatch[1], 10)
    return Number.isFinite(id) && id > 0 ? id : null
  }
  const legacyMatch = /^chronell-note:(\d+)$/.exec(trimmed)
  if (legacyMatch) {
    const id = Number.parseInt(legacyMatch[1], 10)
    return Number.isFinite(id) && id > 0 ? id : null
  }
  return null
}

export function isNoteWikiLinkHref(href: string | null | undefined): boolean {
  return parseNoteWikiLinkHref(href) != null
}
