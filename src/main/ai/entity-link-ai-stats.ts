import { getDb } from '../db/index'
import type { EntityLinkAiScanProfile } from '@shared/entity-links'

export interface EntityLinkGraphDensityStats {
  lookbackDays: number
  mailInRange: number
  mailUnlinked: number
  mailUnlinkedPercent: number
}

export interface EntityLinkAiScanCostEstimate {
  anchorCount: number
  apiCalls: number
  tokensEstimate: number
  compareProviders: boolean
}

/** Mails im Zeitraum ohne mindestens eine entity_links-Kante. */
export function getEntityLinkGraphDensityStats(
  lookbackDays: number
): EntityLinkGraphDensityStats {
  const db = getDb()
  const days = Math.min(Math.max(Math.round(lookbackDays), 7), 365)
  const since = new Date()
  since.setDate(since.getDate() - days)
  const sinceIso = since.toISOString()

  const row = db
    .prepare(
      `SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN (
          SELECT COUNT(*) FROM entity_links el
          WHERE (el.a_kind = 'mail' AND el.a_mail_message_id = m.id)
             OR (el.b_kind = 'mail' AND el.b_mail_message_id = m.id)
        ) = 0 THEN 1 ELSE 0 END) AS unlinked
       FROM messages m
       WHERE m.received_at >= ?`
    )
    .get(sinceIso) as { total: number; unlinked: number }

  const mailInRange = row?.total ?? 0
  const mailUnlinked = row?.unlinked ?? 0
  const mailUnlinkedPercent =
    mailInRange > 0 ? Math.round((mailUnlinked / mailInRange) * 100) : 0

  return {
    lookbackDays: days,
    mailInRange,
    mailUnlinked,
    mailUnlinkedPercent
  }
}

export function countScanAnchorsForInput(
  profile: EntityLinkAiScanProfile | undefined,
  lookbackDays: number,
  maxAnchors: number,
  explicitAnchorCount: number
): number {
  if (explicitAnchorCount > 0) return Math.min(explicitAnchorCount, 50)
  if (profile === 'recent_30') return Math.min(maxAnchors, 50)
  if (profile === 'contacts_calendar') return Math.min(maxAnchors, 50)
  return Math.min(maxAnchors, 50)
}

/** Grobe Schätzung (Metadaten-only, ein Aufruf pro Anker). */
export function estimateEntityLinkAiScanCost(
  anchorCount: number,
  compareProviders: boolean
): EntityLinkAiScanCostEstimate {
  const n = Math.min(Math.max(anchorCount, 0), 50)
  const perCallTokens = 3500
  const apiCalls = compareProviders ? n * 2 : n
  return {
    anchorCount: n,
    apiCalls,
    tokensEstimate: apiCalls * perCallTokens,
    compareProviders
  }
}
