import type { ChronellEntityRef } from '@shared/entity-ref'
import type {
  EntityLinkAiExcerptSource,
  EntityLinkAiPayloadField,
  EntityLinkAiPayloadPreview,
  EntityLinkAiPayloadPreviewInput
} from '@shared/entity-link-ai-payload'
import { getMailTodoMessageId } from '../db/entity-links-repo'
import { excerptPlainText } from './entity-link-ai-excerpt'
import {
  buildAnchorSnapshot,
  resolveMailTextExcerpt,
  type EntityLinkAiSnapshot
} from './entity-link-ai-context'
import { getDb } from '../db/index'

const FIELD_LABELS: Record<string, string> = {
  subject: 'Betreff',
  from_addr: 'Absender',
  from_name: 'Name',
  received_at: 'Empfangen',
  due_at: 'Fällig',
  title: 'Titel',
  start_iso: 'Beginn',
  end_iso: 'Ende',
  location: 'Ort',
  display_name: 'Name',
  primary_email: 'E-Mail',
  company: 'Firma',
  kind: 'Art',
  updated_at: 'Aktualisiert',
  due_iso: 'Fällig',
  list_id: 'Liste'
}

function snapshotTitle(snap: EntityLinkAiSnapshot): string {
  const f = snap.fields
  return (
    (typeof f.title === 'string' && f.title) ||
    (typeof f.subject === 'string' && f.subject) ||
    (typeof f.display_name === 'string' && f.display_name) ||
    snap.id
  )
}

function metadataFields(snap: EntityLinkAiSnapshot): EntityLinkAiPayloadField[] {
  return Object.entries(snap.fields)
    .filter(([, v]) => v != null && String(v).trim() !== '')
    .map(([key, value]) => ({
      key,
      label: FIELD_LABELS[key] ?? key,
      value: String(value)
    }))
}

function resolveExcerptForAnchor(
  anchor: ChronellEntityRef,
  includeExcerpt: boolean
): { excerpt: string | null; source: EntityLinkAiExcerptSource } {
  if (!includeExcerpt) return { excerpt: null, source: 'none' }

  const db = getDb()
  switch (anchor.kind) {
    case 'mail': {
      const r = resolveMailTextExcerpt(anchor.messageId)
      return {
        excerpt: r.excerpt,
        source: r.source === 'none' ? 'none' : r.source
      }
    }
    case 'mail_todo': {
      const messageId = getMailTodoMessageId(anchor.todoId)
      if (!messageId) return { excerpt: null, source: 'none' }
      const r = resolveMailTextExcerpt(messageId)
      return {
        excerpt: r.excerpt,
        source: r.source === 'none' ? 'none' : r.source
      }
    }
    case 'note': {
      const row = db
        .prepare(`SELECT body FROM user_notes WHERE id = ?`)
        .get(anchor.noteId) as { body: string | null } | undefined
      const excerpt = excerptPlainText(row?.body)
      return { excerpt, source: excerpt ? 'note' : 'none' }
    }
    case 'calendar_event': {
      const row = db
        .prepare(
          `SELECT body_html FROM calendar_event_details
           WHERE account_id = ? AND graph_event_id = ?`
        )
        .get(anchor.accountId, anchor.graphEventId) as { body_html: string | null } | undefined
      const excerpt = excerptPlainText(row?.body_html)
      return { excerpt, source: excerpt ? 'event' : 'none' }
    }
    default:
      return { excerpt: null, source: 'none' }
  }
}

export function buildEntityLinkAiPayloadPreview(
  input: EntityLinkAiPayloadPreviewInput
): EntityLinkAiPayloadPreview | null {
  const snap = buildAnchorSnapshot(input.anchor)
  if (!snap) return null

  const includeExcerpt = input.includeExcerpt === true
  const meta = metadataFields(snap)
  const metadataCharEstimate = meta.reduce((n, f) => n + f.label.length + f.value.length, 0)
  const { excerpt, source } = resolveExcerptForAnchor(input.anchor, includeExcerpt)
  const excerptCharCount = excerpt?.length ?? 0

  return {
    anchorTitle: snapshotTitle(snap),
    kind: input.anchor.kind,
    metadataFields: meta,
    excerpt,
    excerptSource: source,
    excerptCharCount,
    metadataCharEstimate,
    totalCharEstimate: metadataCharEstimate + excerptCharCount,
    includeExcerpt
  }
}
