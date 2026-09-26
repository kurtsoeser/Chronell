import {
  normalizeCopilotChatEngine,
  type CopilotChatEngine,
  type CopilotChatMessageAttribution,
  type MessageCopilotCacheEntry
} from '@shared/types'
import { getDb } from './index'

interface CacheRow {
  message_id: number
  engine: string
  reply_text: string
  attributions_json: string
  updated_at: string
}

function parseAttributions(raw: string): CopilotChatMessageAttribution[] {
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((a): a is Record<string, unknown> => !!a && typeof a === 'object')
      .map((a) => ({
        attributionType: typeof a.attributionType === 'string' ? a.attributionType : null,
        providerDisplayName:
          typeof a.providerDisplayName === 'string' ? a.providerDisplayName : null,
        seeMoreWebUrl: typeof a.seeMoreWebUrl === 'string' ? a.seeMoreWebUrl : null
      }))
  } catch {
    return []
  }
}

function rowToEntry(row: CacheRow): MessageCopilotCacheEntry {
  return {
    messageId: row.message_id,
    engine: normalizeCopilotChatEngine(row.engine),
    replyText: row.reply_text,
    attributions: parseAttributions(row.attributions_json),
    updatedAt: row.updated_at
  }
}

export function getMessageCopilotCache(
  messageId: number,
  engine: CopilotChatEngine
): MessageCopilotCacheEntry | null {
  if (!Number.isFinite(messageId) || messageId <= 0) return null
  const db = getDb()
  const row = db
    .prepare(
      `SELECT message_id, engine, reply_text, attributions_json, updated_at
       FROM message_copilot_cache
       WHERE message_id = ? AND engine = ?`
    )
    .get(messageId, engine) as CacheRow | undefined
  return row ? rowToEntry(row) : null
}

export function upsertMessageCopilotCache(input: {
  messageId: number
  engine: CopilotChatEngine
  replyText: string
  attributions: CopilotChatMessageAttribution[]
}): MessageCopilotCacheEntry | null {
  const messageId = input.messageId
  const replyText = input.replyText?.trim() ?? ''
  if (!Number.isFinite(messageId) || messageId <= 0 || !replyText) return null
  const engine = normalizeCopilotChatEngine(input.engine)
  const attributionsJson = JSON.stringify(input.attributions ?? [])
  const db = getDb()
  db.prepare(
    `INSERT INTO message_copilot_cache (message_id, engine, reply_text, attributions_json, updated_at)
     VALUES (?, ?, ?, ?, datetime('now'))
     ON CONFLICT(message_id, engine) DO UPDATE SET
       reply_text = excluded.reply_text,
       attributions_json = excluded.attributions_json,
       updated_at = datetime('now')`
  ).run(messageId, engine, replyText, attributionsJson)
  return getMessageCopilotCache(messageId, engine)
}

export function deleteMessageCopilotCache(
  messageId: number,
  engine?: CopilotChatEngine
): void {
  if (!Number.isFinite(messageId) || messageId <= 0) return
  const db = getDb()
  if (engine) {
    db.prepare(`DELETE FROM message_copilot_cache WHERE message_id = ? AND engine = ?`).run(
      messageId,
      normalizeCopilotChatEngine(engine)
    )
    return
  }
  db.prepare(`DELETE FROM message_copilot_cache WHERE message_id = ?`).run(messageId)
}
