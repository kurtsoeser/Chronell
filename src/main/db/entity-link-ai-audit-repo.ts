import { getDb } from './index'

export type EntityLinkAiAuditKind = 'suggest' | 'scan_start' | 'scan_item' | 'evaluate_quality'

export interface EntityLinkAiAuditRow {
  kind: EntityLinkAiAuditKind
  anchorKey: string | null
  provider: string | null
  charEstimate: number
  includeExcerpt: boolean
}

/** Letzte KI-Aufrufe (ohne Inhalt) – für Datenschutz-Übersicht. */
export async function appendEntityLinkAiAudit(row: EntityLinkAiAuditRow): Promise<void> {
  const db = getDb()
  db.prepare(
    `INSERT INTO entity_link_ai_audit (kind, anchor_key, provider, char_estimate, include_excerpt)
     VALUES (?, ?, ?, ?, ?)`
  ).run(
    row.kind,
    row.anchorKey,
    row.provider,
    Math.max(0, Math.round(row.charEstimate)),
    row.includeExcerpt ? 1 : 0
  )
  db.prepare(
    `DELETE FROM entity_link_ai_audit
     WHERE id NOT IN (
       SELECT id FROM entity_link_ai_audit ORDER BY created_at DESC LIMIT 100
     )`
  ).run()
}

export function listEntityLinkAiAuditRecent(limit = 20): Array<{
  id: number
  kind: string
  anchorKey: string | null
  provider: string | null
  charEstimate: number
  includeExcerpt: boolean
  createdAt: string
}> {
  const db = getDb()
  const rows = db
    .prepare(
      `SELECT id, kind, anchor_key, provider, char_estimate, include_excerpt, created_at
       FROM entity_link_ai_audit
       ORDER BY created_at DESC
       LIMIT ?`
    )
    .all(limit) as Array<{
    id: number
    kind: string
    anchor_key: string | null
    provider: string | null
    char_estimate: number
    include_excerpt: number
    created_at: string
  }>
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    anchorKey: r.anchor_key,
    provider: r.provider,
    charEstimate: r.char_estimate,
    includeExcerpt: r.include_excerpt === 1,
    createdAt: r.created_at
  }))
}
