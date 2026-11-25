import { readJsonSecure, writeJsonSecure } from '../secure-store'
import type { OneNoteRecentTarget } from '@shared/types/onenote'

const STORE_KEY = 'onenote-destinations'
const MAX_RECENT = 15

interface OneNoteDestinationsConfig {
  recent: OneNoteRecentTarget[]
}

const EMPTY: OneNoteDestinationsConfig = { recent: [] }

export async function readOneNoteRecent(): Promise<OneNoteRecentTarget[]> {
  const raw = await readJsonSecure<OneNoteDestinationsConfig | null>(STORE_KEY, null)
  if (!raw || !Array.isArray(raw.recent)) return []
  return raw.recent
    .filter(
      (entry) =>
        entry &&
        typeof entry.notebookId === 'string' &&
        typeof entry.sectionId === 'string' &&
        typeof entry.usedAt === 'string'
    )
    .sort((a, b) => Date.parse(b.usedAt) - Date.parse(a.usedAt))
}

export async function touchOneNoteDestination(target: {
  notebookId: string
  sectionId: string
  notebookName: string
  sectionName: string
}): Promise<void> {
  const recent = await readOneNoteRecent()
  const now = new Date().toISOString()
  const next: OneNoteRecentTarget = {
    notebookId: target.notebookId,
    sectionId: target.sectionId,
    notebookName: target.notebookName.trim() || target.notebookId,
    sectionName: target.sectionName.trim() || target.sectionId,
    usedAt: now
  }
  const merged = [
    next,
    ...recent.filter(
      (entry) => !(entry.notebookId === next.notebookId && entry.sectionId === next.sectionId)
    )
  ].slice(0, MAX_RECENT)
  await writeJsonSecure(STORE_KEY, { ...EMPTY, recent: merged })
}
