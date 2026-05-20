import type { EntityRefKind } from '@shared/entity-ref'
import { getDb } from './index'

export interface EntityEmbeddingRow {
  ref_key: string
  kind: EntityRefKind
  text_hash: string
  dimensions: number
  embedding: Buffer
  source_updated_at: string | null
  indexed_at: string
}

export function embeddingBufferToFloat32(buf: Buffer): Float32Array {
  return new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4)
}

export function float32ToEmbeddingBuffer(vec: Float32Array): Buffer {
  return Buffer.from(vec.buffer, vec.byteOffset, vec.byteLength)
}

export function getEntityEmbedding(refKey: string): EntityEmbeddingRow | null {
  const db = getDb()
  const row = db
    .prepare(
      `SELECT ref_key, kind, text_hash, dimensions, embedding, source_updated_at, indexed_at
       FROM entity_embeddings WHERE ref_key = ?`
    )
    .get(refKey) as EntityEmbeddingRow | undefined
  return row ?? null
}

export function upsertEntityEmbedding(input: {
  refKey: string
  kind: EntityRefKind
  textHash: string
  vector: Float32Array
  sourceUpdatedAt: string | null
}): void {
  const db = getDb()
  db.prepare(
    `INSERT INTO entity_embeddings (ref_key, kind, text_hash, dimensions, embedding, source_updated_at, indexed_at)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(ref_key) DO UPDATE SET
       kind = excluded.kind,
       text_hash = excluded.text_hash,
       dimensions = excluded.dimensions,
       embedding = excluded.embedding,
       source_updated_at = excluded.source_updated_at,
       indexed_at = datetime('now')`
  ).run(
    input.refKey,
    input.kind,
    input.textHash,
    input.vector.length,
    float32ToEmbeddingBuffer(input.vector),
    input.sourceUpdatedAt
  )
}

export function deleteEntityEmbedding(refKey: string): void {
  getDb().prepare(`DELETE FROM entity_embeddings WHERE ref_key = ?`).run(refKey)
}

export function countEntityEmbeddings(): number {
  const row = getDb()
    .prepare(`SELECT COUNT(*) AS c FROM entity_embeddings`)
    .get() as { c: number }
  return row.c ?? 0
}

export function listEntityEmbeddings(limit = 50_000): EntityEmbeddingRow[] {
  return getDb()
    .prepare(
      `SELECT ref_key, kind, text_hash, dimensions, embedding, source_updated_at, indexed_at
       FROM entity_embeddings
       ORDER BY indexed_at DESC
       LIMIT ?`
    )
    .all(limit) as EntityEmbeddingRow[]
}

export function latestEntityEmbeddingIndexedAt(): string | null {
  const row = getDb()
    .prepare(`SELECT MAX(indexed_at) AS m FROM entity_embeddings`)
    .get() as { m: string | null } | undefined
  return row?.m ?? null
}
