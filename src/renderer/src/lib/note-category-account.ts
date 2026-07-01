import type { ConnectedAccount, UserNoteListItem } from '@shared/types'

/** Konto für Outlook-Kategorien einer Notiz (Mail > Kalender > erstes Microsoft-Konto). */
export function resolveNoteCategoryAccountId(
  note: Pick<UserNoteListItem, 'accountId' | 'mailAccountId'>,
  accounts: ConnectedAccount[]
): string | null {
  const mail = note.mailAccountId?.trim()
  if (mail) return mail
  const own = note.accountId?.trim()
  if (own) return own
  const ms = accounts.find((a) => a.provider === 'microsoft')
  if (ms) return ms.id
  return accounts[0]?.id ?? null
}

export function collectDistinctNoteCategories(notes: UserNoteListItem[]): string[] {
  const names = new Set<string>()
  for (const note of notes) {
    for (const tag of note.categories ?? []) {
      const t = tag.trim()
      if (t) names.add(t)
    }
  }
  return Array.from(names).sort((a, b) => a.localeCompare(b, 'de'))
}

export function countPinnedNotes(notes: UserNoteListItem[]): number {
  return notes.filter((n) => n.isPinned).length
}
