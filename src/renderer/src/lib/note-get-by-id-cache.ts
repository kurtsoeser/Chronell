import type { UserNoteListItem } from '@shared/types'

const NOTE_GET_BY_ID_CACHE_TTL_MS = 5_000

interface CacheEntry {
  item: UserNoteListItem
  at: number
}

const cache = new Map<number, CacheEntry>()

export function invalidateNoteGetByIdCache(noteId?: number): void {
  if (noteId == null) {
    cache.clear()
    return
  }
  cache.delete(noteId)
}

export async function getNoteByIdCached(id: number): Promise<UserNoteListItem | null> {
  const now = Date.now()
  const hit = cache.get(id)
  if (hit && now - hit.at < NOTE_GET_BY_ID_CACHE_TTL_MS) {
    return hit.item
  }
  const item = await window.mailClient.notes.getById(id)
  if (item) {
    cache.set(id, { item, at: now })
  } else {
    cache.delete(id)
  }
  return item
}
