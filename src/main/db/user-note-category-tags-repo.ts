import { getDb } from './index'

export function replaceNoteCategoryTags(
  noteId: number,
  accountId: string,
  tags: string[]
): void {
  const account = accountId.trim()
  if (!account) throw new Error('Konto fehlt.')
  const normalized = Array.from(new Set(tags.map((t) => t.trim()).filter((t) => t.length > 0)))
  const db = getDb()
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM user_note_category_tags WHERE note_id = ?').run(noteId)
    const ins = db.prepare(
      'INSERT OR IGNORE INTO user_note_category_tags (note_id, account_id, tag) VALUES (?, ?, ?)'
    )
    for (const tag of normalized) {
      ins.run(noteId, account, tag)
    }
  })
  tx()
}

export function listTagsForNote(noteId: number): string[] {
  const db = getDb()
  const rows = db
    .prepare<[number], { tag: string }>(
      'SELECT tag FROM user_note_category_tags WHERE note_id = ? ORDER BY tag COLLATE NOCASE'
    )
    .all(noteId)
  return rows.map((r) => r.tag)
}

export function listTagsGroupedByNoteIds(noteIds: number[]): Map<number, string[]> {
  const out = new Map<number, string[]>()
  if (noteIds.length === 0) return out
  const uniq = Array.from(new Set(noteIds))
  const db = getDb()
  const ph = uniq.map(() => '?').join(',')
  const rows = db
    .prepare<unknown[], { note_id: number; tag: string }>(
      `SELECT note_id, tag FROM user_note_category_tags WHERE note_id IN (${ph}) ORDER BY note_id, tag COLLATE NOCASE`
    )
    .all(...uniq)
  for (const r of rows) {
    const list = out.get(r.note_id) ?? []
    list.push(r.tag)
    out.set(r.note_id, list)
  }
  return out
}

export function deleteTagsForNote(noteId: number): void {
  getDb().prepare('DELETE FROM user_note_category_tags WHERE note_id = ?').run(noteId)
}
