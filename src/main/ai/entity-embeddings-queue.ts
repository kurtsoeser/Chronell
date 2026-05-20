import type { ChronellEntityRef } from '@shared/entity-ref'
import type { UserNote } from '@shared/types'
import { broadcastEntityEmbeddingProgress } from '../ipc/ipc-broadcasts'
import { deleteEntityEmbedding } from '../db/entity-embeddings-repo'
import { embeddingRefKey } from './entity-embedding-text'
import { listRecentMailRefsForEmbedding } from './entity-embeddings-catalog'
import { indexEntityEmbeddingsBatch, isEmbeddingRebuildRunning } from './entity-embeddings-index'
import { getAiConnectionsSettings } from './ai-settings-store'
import { isEmbeddingPipelineActive } from '@shared/ai-connections'
import { invalidateEmbeddingVectorCache } from './entity-embeddings-search'

/** Referenzen, die sich aus einer Notiz für den Vektorindex ableiten lassen. */
export function chronellRefsFromUserNote(note: UserNote): ChronellEntityRef[] {
  const refs: ChronellEntityRef[] = [{ kind: 'note', noteId: note.id }]
  if (note.messageId != null) {
    refs.push({ kind: 'mail', messageId: note.messageId })
  }
  if (note.accountId && note.eventRemoteId) {
    refs.push({
      kind: 'calendar_event',
      accountId: note.accountId,
      graphEventId: note.eventRemoteId
    })
  }
  return refs
}

export function queueEntityEmbeddingForNote(note: UserNote): void {
  for (const ref of chronellRefsFromUserNote(note)) {
    pendingRefs.push(ref)
  }
  scheduleNoteFlush()
}

export function removeEntityEmbeddingsForNote(noteId: number): void {
  deleteEntityEmbedding(embeddingRefKey({ kind: 'note', noteId }))
}

const DEBOUNCE_MS = 8_000
const NOTE_DEBOUNCE_MS = 3_000
let timer: ReturnType<typeof setTimeout> | null = null
let noteTimer: ReturnType<typeof setTimeout> | null = null
const pendingRefs: ChronellEntityRef[] = []

export function queueEntityEmbeddingsAfterMailSync(accountId: string): void {
  void accountId
  const since = new Date()
  since.setHours(since.getHours() - 48)
  for (const ref of listRecentMailRefsForEmbedding(since.toISOString(), 60)) {
    pendingRefs.push(ref)
  }
  scheduleFlush()
}

export function queueEntityEmbeddingRef(ref: ChronellEntityRef): void {
  pendingRefs.push(ref)
  scheduleFlush()
}

function scheduleFlush(): void {
  if (timer != null) clearTimeout(timer)
  timer = setTimeout(() => {
    timer = null
    void flushPendingEmbeddings()
  }, DEBOUNCE_MS)
}

function scheduleNoteFlush(): void {
  if (noteTimer != null) clearTimeout(noteTimer)
  noteTimer = setTimeout(() => {
    noteTimer = null
    void flushPendingEmbeddings({ ignoreAutoIndex: true })
  }, NOTE_DEBOUNCE_MS)
}

async function flushPendingEmbeddings(opts?: { ignoreAutoIndex?: boolean }): Promise<void> {
  if (pendingRefs.length === 0 || isEmbeddingRebuildRunning()) return
  const settings = await getAiConnectionsSettings()
  if (!isEmbeddingPipelineActive(settings)) {
    pendingRefs.length = 0
    return
  }
  if (!opts?.ignoreAutoIndex && !settings.embeddingAutoIndex) {
    return
  }
  const batch = pendingRefs.splice(0, 80)
  const total = batch.length
  try {
    broadcastEntityEmbeddingProgress({ done: 0, total, phase: 'auto' })
    await indexEntityEmbeddingsBatch(batch, (done, t) => {
      broadcastEntityEmbeddingProgress({ done, total: t, phase: 'auto' })
    })
    invalidateEmbeddingVectorCache()
  } catch {
    /* Hintergrund — Fehler beim nächsten manuellen Rebuild sichtbar */
  } finally {
    broadcastEntityEmbeddingProgress(null)
  }
  if (pendingRefs.length > 0) {
    if (opts?.ignoreAutoIndex) scheduleNoteFlush()
    else scheduleFlush()
  }
}
