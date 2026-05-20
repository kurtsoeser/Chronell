import type { ChronellEntityRef } from '@shared/entity-ref'
import { getDb } from '../db/index'

/** Referenzen für Voll-Rebuild / Delta-Schätzung (lookback-basiert). */
export function listEntityRefsForEmbeddingIndex(input: {
  lookbackDays: number
  maxEntities: number
}): ChronellEntityRef[] {
  const db = getDb()
  const days = Math.min(Math.max(input.lookbackDays, 7), 365)
  const cap = Math.min(Math.max(input.maxEntities, 100), 25_000)
  const since = new Date()
  since.setDate(since.getDate() - days)
  const sinceIso = since.toISOString()

  const refs: ChronellEntityRef[] = []
  const seen = new Set<string>()

  function push(ref: ChronellEntityRef): void {
    const key =
      ref.kind === 'mail'
        ? `mail:${ref.messageId}`
        : ref.kind === 'mail_todo'
          ? `mail-todo:${ref.todoId}`
          : ref.kind === 'note'
            ? `note:${ref.noteId}`
            : ref.kind === 'people_contact'
              ? `contact:${ref.contactId}`
              : ref.kind === 'calendar_event'
                ? `calendar:${ref.accountId}:${ref.graphEventId}`
                : `task:${ref.accountId}:${ref.listId}:${ref.taskId}`
    if (seen.has(key) || refs.length >= cap) return
    seen.add(key)
    refs.push(ref)
  }

  const mailLimit = Math.min(cap, Math.floor(cap * 0.45))
  const mails = db
    .prepare(
      `SELECT id FROM messages WHERE received_at >= ? ORDER BY received_at DESC LIMIT ?`
    )
    .all(sinceIso, mailLimit) as Array<{ id: number }>
  for (const m of mails) push({ kind: 'mail', messageId: m.id })

  const todos = db
    .prepare(
      `SELECT t.id FROM todos t
       JOIN messages m ON m.id = t.message_id
       WHERE m.received_at >= ?
       ORDER BY m.received_at DESC
       LIMIT ?`
    )
    .all(sinceIso, Math.min(2000, cap)) as Array<{ id: number }>
  for (const t of todos) push({ kind: 'mail_todo', todoId: t.id })

  const calLimit = Math.min(3000, Math.floor(cap * 0.2))
  const events = db
    .prepare(
      `SELECT account_id, graph_event_id FROM calendar_events
       WHERE start_iso >= ? OR end_iso >= ?
       ORDER BY start_iso DESC LIMIT ?`
    )
    .all(sinceIso, sinceIso, calLimit) as Array<{
    account_id: string
    graph_event_id: string
  }>
  for (const e of events) {
    push({
      kind: 'calendar_event',
      accountId: e.account_id,
      graphEventId: e.graph_event_id
    })
  }

  const contacts = db
    .prepare(`SELECT id FROM people_contacts ORDER BY id DESC LIMIT ?`)
    .all(Math.min(2000, Math.floor(cap * 0.15))) as Array<{ id: number }>
  for (const c of contacts) push({ kind: 'people_contact', contactId: c.id })

  const notes = db
    .prepare(
      `SELECT id FROM user_notes WHERE updated_at >= ? ORDER BY updated_at DESC LIMIT ?`
    )
    .all(sinceIso, Math.min(2000, Math.floor(cap * 0.1))) as Array<{ id: number }>
  for (const n of notes) push({ kind: 'note', noteId: n.id })

  const tasks = db
    .prepare(
      `SELECT account_id, list_id, task_id FROM cloud_tasks
       WHERE COALESCE(due_iso, '') >= ? OR title IS NOT NULL
       ORDER BY due_iso DESC LIMIT ?`
    )
    .all(sinceIso, Math.min(2000, Math.floor(cap * 0.1))) as Array<{
    account_id: string
    list_id: string
    task_id: string
  }>
  for (const t of tasks) {
    push({
      kind: 'cloud_task',
      accountId: t.account_id,
      listId: t.list_id,
      taskId: t.task_id
    })
  }

  return refs
}

/** Neue/geänderte Mails nach Sync (Delta). */
export function listRecentMailRefsForEmbedding(sinceIso: string, limit = 80): ChronellEntityRef[] {
  const db = getDb()
  const mails = db
    .prepare(
      `SELECT id FROM messages WHERE received_at >= ? ORDER BY received_at DESC LIMIT ?`
    )
    .all(sinceIso, limit) as Array<{ id: number }>
  return mails.map((m) => ({ kind: 'mail', messageId: m.id }))
}
