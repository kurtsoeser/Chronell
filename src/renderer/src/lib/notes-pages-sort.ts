import type { UserNoteListItem } from '@shared/types'
import { noteTitle } from '@/app/notes/notes-display-helpers'
import { readNotesSettingsPrefs } from '@/lib/notes-settings-prefs'

export const NOTES_PAGES_SORT_KEYS = [
  'manual',
  'title_asc',
  'title_desc',
  'created_asc',
  'created_desc',
  'updated_asc',
  'updated_desc',
  'scheduled_asc',
  'scheduled_desc'
] as const

export type NotesPagesSortKey = (typeof NOTES_PAGES_SORT_KEYS)[number]

const STORAGE_KEY = 'mailclient.notes.pagesSort.v1'

export function isNotesPagesSortKey(value: string): value is NotesPagesSortKey {
  return (NOTES_PAGES_SORT_KEYS as readonly string[]).includes(value)
}

export function readNotesPagesSort(): NotesPagesSortKey {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)?.trim()
    if (raw && isNotesPagesSortKey(raw)) return raw
  } catch {
    /* ignore */
  }
  return readNotesSettingsPrefs().defaultPagesSort
}

export function persistNotesPagesSort(key: NotesPagesSortKey): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, key)
  } catch {
    /* ignore */
  }
}

function compareIso(a: string, b: string, asc: boolean): number {
  const cmp = a.localeCompare(b)
  return asc ? cmp : -cmp
}

function compareNullableIso(a: string | null, b: string | null, asc: boolean): number {
  if (!a && !b) return 0
  if (!a) return 1
  if (!b) return -1
  return compareIso(a, b, asc)
}

function compareManual(a: UserNoteListItem, b: UserNoteListItem): number {
  const aPin = a.isPinned ? 1 : 0
  const bPin = b.isPinned ? 1 : 0
  if (aPin !== bPin) return bPin - aPin
  const o = a.sortOrder - b.sortOrder
  if (o !== 0) return o
  return b.updatedAt.localeCompare(a.updatedAt)
}

export function compareNotesPagesSibling(
  a: UserNoteListItem,
  b: UserNoteListItem,
  sortKey: NotesPagesSortKey,
  untitledLabel: string
): number {
  const aPin = a.isPinned ? 1 : 0
  const bPin = b.isPinned ? 1 : 0
  if (aPin !== bPin) return bPin - aPin

  switch (sortKey) {
    case 'manual':
      return compareManual(a, b)
    case 'title_asc':
      return noteTitle(a, untitledLabel).localeCompare(noteTitle(b, untitledLabel), undefined, {
        sensitivity: 'base'
      })
    case 'title_desc':
      return noteTitle(b, untitledLabel).localeCompare(noteTitle(a, untitledLabel), undefined, {
        sensitivity: 'base'
      })
    case 'created_asc':
      return compareIso(a.createdAt, b.createdAt, true)
    case 'created_desc':
      return compareIso(a.createdAt, b.createdAt, false)
    case 'updated_asc':
      return compareIso(a.updatedAt, b.updatedAt, true)
    case 'updated_desc':
      return compareIso(a.updatedAt, b.updatedAt, false)
    case 'scheduled_asc':
      return compareNullableIso(a.scheduledStartIso, b.scheduledStartIso, true)
    case 'scheduled_desc':
      return compareNullableIso(a.scheduledStartIso, b.scheduledStartIso, false)
    default:
      return compareManual(a, b)
  }
}

export function sortNotesPages(
  notes: UserNoteListItem[],
  sortKey: NotesPagesSortKey,
  untitledLabel: string
): UserNoteListItem[] {
  return [...notes].sort((a, b) => compareNotesPagesSibling(a, b, sortKey, untitledLabel))
}

export function notesPagesSortLabelKey(sortKey: NotesPagesSortKey): string {
  return `notes.shell.pagesSort.${sortKey}`
}
