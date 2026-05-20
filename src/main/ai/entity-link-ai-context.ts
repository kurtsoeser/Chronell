import type { ChronellEntityRef } from '@shared/entity-ref'
import { entityRefKey } from '@shared/entity-ref'
import { getDb } from '../db/index'
import { getMailTodoMessageId } from '../db/entity-links-repo'
import { excerptPlainText } from './entity-link-ai-excerpt'

export interface EntityLinkAiSnapshot {
  id: string
  kind: ChronellEntityRef['kind']
  fields: Record<string, string | number | boolean | null>
}

export function buildAnchorSnapshot(anchor: ChronellEntityRef): EntityLinkAiSnapshot | null {
  const db = getDb()
  const id = entityRefKey(anchor)

  switch (anchor.kind) {
    case 'mail': {
      const row = db
        .prepare(
          `SELECT subject, from_addr, from_name, received_at
           FROM messages WHERE id = ?`
        )
        .get(anchor.messageId) as
        | {
            subject: string | null
            from_addr: string | null
            from_name: string | null
            received_at: string | null
          }
        | undefined
      if (!row) return null
      return {
        id,
        kind: 'mail',
        fields: {
          subject: row.subject,
          from_addr: row.from_addr,
          from_name: row.from_name,
          received_at: row.received_at
        }
      }
    }
    case 'mail_todo': {
      const messageId = getMailTodoMessageId(anchor.todoId)
      if (!messageId) return null
      const row = db
        .prepare(
          `SELECT m.subject, m.from_addr, m.from_name, m.received_at, t.due_at
           FROM todos t
           JOIN messages m ON m.id = t.message_id
           WHERE t.id = ?`
        )
        .get(anchor.todoId) as
        | {
            subject: string | null
            from_addr: string | null
            from_name: string | null
            received_at: string | null
            due_at: string | null
          }
        | undefined
      if (!row) return null
      return {
        id,
        kind: 'mail_todo',
        fields: {
          subject: row.subject,
          from_addr: row.from_addr,
          from_name: row.from_name,
          received_at: row.received_at,
          due_at: row.due_at
        }
      }
    }
    case 'calendar_event': {
      const row = db
        .prepare(
          `SELECT title, start_iso, end_iso, location, graph_calendar_id
           FROM calendar_events
           WHERE account_id = ? AND graph_event_id = ?`
        )
        .get(anchor.accountId, anchor.graphEventId) as
        | {
            title: string | null
            start_iso: string | null
            end_iso: string | null
            location: string | null
            graph_calendar_id: string | null
          }
        | undefined
      if (!row) return null
      return {
        id,
        kind: 'calendar_event',
        fields: {
          title: row.title,
          start_iso: row.start_iso,
          end_iso: row.end_iso,
          location: row.location,
          graph_calendar_id: row.graph_calendar_id
        }
      }
    }
    case 'people_contact': {
      const row = db
        .prepare(
          `SELECT display_name, primary_email, company
           FROM people_contacts WHERE id = ?`
        )
        .get(anchor.contactId) as
        | {
            display_name: string | null
            primary_email: string | null
            company: string | null
          }
        | undefined
      if (!row) return null
      return {
        id,
        kind: 'people_contact',
        fields: {
          display_name: row.display_name,
          primary_email: row.primary_email,
          company: row.company
        }
      }
    }
    case 'note': {
      const row = db
        .prepare(`SELECT title, kind, updated_at FROM user_notes WHERE id = ?`)
        .get(anchor.noteId) as
        | { title: string | null; kind: string | null; updated_at: string | null }
        | undefined
      if (!row) return null
      return {
        id,
        kind: 'note',
        fields: {
          title: row.title,
          kind: row.kind,
          updated_at: row.updated_at
        }
      }
    }
    case 'cloud_task': {
      const row = db
        .prepare(
          `SELECT title, due_iso, list_id FROM cloud_tasks
           WHERE account_id = ? AND list_id = ? AND task_id = ?`
        )
        .get(anchor.accountId, anchor.listId, anchor.taskId) as
        | { title: string | null; due_iso: string | null; list_id: string | null }
        | undefined
      if (!row) return null
      return {
        id,
        kind: 'cloud_task',
        fields: {
          title: row.title,
          due_iso: row.due_iso,
          list_id: row.list_id
        }
      }
    }
    default:
      return null
  }
}

export function anchorReferenceIso(anchor: ChronellEntityRef): string {
  const db = getDb()
  switch (anchor.kind) {
    case 'mail': {
      const row = db
        .prepare(`SELECT received_at FROM messages WHERE id = ?`)
        .get(anchor.messageId) as { received_at: string | null } | undefined
      return row?.received_at ?? new Date().toISOString()
    }
    case 'mail_todo': {
      const messageId = getMailTodoMessageId(anchor.todoId)
      if (!messageId) return new Date().toISOString()
      const row = db
        .prepare(`SELECT received_at FROM messages WHERE id = ?`)
        .get(messageId) as { received_at: string | null } | undefined
      return row?.received_at ?? new Date().toISOString()
    }
    case 'calendar_event': {
      const row = db
        .prepare(
          `SELECT start_iso FROM calendar_events WHERE account_id = ? AND graph_event_id = ?`
        )
        .get(anchor.accountId, anchor.graphEventId) as { start_iso: string | null } | undefined
      return row?.start_iso ?? new Date().toISOString()
    }
    case 'note': {
      const row = db
        .prepare(`SELECT updated_at FROM user_notes WHERE id = ?`)
        .get(anchor.noteId) as { updated_at: string | null } | undefined
      return row?.updated_at ?? new Date().toISOString()
    }
    case 'cloud_task': {
      const row = db
        .prepare(
          `SELECT due_iso FROM cloud_tasks WHERE account_id = ? AND list_id = ? AND task_id = ?`
        )
        .get(anchor.accountId, anchor.listId, anchor.taskId) as { due_iso: string | null } | undefined
      return row?.due_iso ?? new Date().toISOString()
    }
    case 'people_contact':
      return new Date().toISOString()
    default:
      return new Date().toISOString()
  }
}

export type MailExcerptSource = 'none' | 'mail_preview' | 'mail_body'

export function resolveMailTextExcerpt(messageId: number): {
  excerpt: string | null
  source: MailExcerptSource
} {
  const db = getDb()
  const row = db
    .prepare(`SELECT snippet, body_text FROM messages WHERE id = ?`)
    .get(messageId) as { snippet: string | null; body_text: string | null } | undefined
  if (!row) return { excerpt: null, source: 'none' }
  if (row.snippet?.trim()) {
    const excerpt = excerptPlainText(row.snippet)
    return excerpt ? { excerpt, source: 'mail_preview' } : { excerpt: null, source: 'none' }
  }
  const excerpt = excerptPlainText(row.body_text)
  return excerpt ? { excerpt, source: 'mail_body' } : { excerpt: null, source: 'none' }
}

function mailExcerptFields(messageId: number): Record<string, string | null> | null {
  const { excerpt } = resolveMailTextExcerpt(messageId)
  return excerpt ? { text_excerpt: excerpt } : null
}

/** Ergänzt erlaubte Textauszüge, wenn Nutzer Snippet/Body-Opt-in aktiviert hat. */
export function enrichSnapshotWithTextExcerpt(
  anchor: ChronellEntityRef,
  snap: EntityLinkAiSnapshot
): EntityLinkAiSnapshot {
  const db = getDb()
  const extra: Record<string, string | number | boolean | null> = {}

  switch (anchor.kind) {
    case 'mail': {
      Object.assign(extra, mailExcerptFields(anchor.messageId) ?? {})
      break
    }
    case 'mail_todo': {
      const messageId = getMailTodoMessageId(anchor.todoId)
      if (messageId) Object.assign(extra, mailExcerptFields(messageId) ?? {})
      break
    }
    case 'note': {
      const row = db
        .prepare(`SELECT body FROM user_notes WHERE id = ?`)
        .get(anchor.noteId) as { body: string | null } | undefined
      const excerpt = excerptPlainText(row?.body)
      if (excerpt) extra.text_excerpt = excerpt
      break
    }
    case 'calendar_event': {
      const row = db
        .prepare(
          `SELECT body_html FROM calendar_event_details
           WHERE account_id = ? AND graph_event_id = ?`
        )
        .get(anchor.accountId, anchor.graphEventId) as { body_html: string | null } | undefined
      const excerpt = excerptPlainText(row?.body_html)
      if (excerpt) extra.text_excerpt = excerpt
      break
    }
    default:
      break
  }

  if (Object.keys(extra).length === 0) return snap
  return { ...snap, fields: { ...snap.fields, ...extra } }
}
