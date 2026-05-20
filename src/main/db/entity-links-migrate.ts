import type { Database as DbType } from 'better-sqlite3'
import type { ChronellEntityRef } from '@shared/entity-ref'
import { entityRefKey } from '@shared/entity-ref'
import {
  addEntityLink,
  cloudTaskEntityRef,
  entityLinkExists,
  mailEntityRef,
  noteEntityRef
} from './entity-links-repo'

interface LegacyNoteEntityLinkRow {
  from_note_id: number
  target_kind: string
  to_note_id: number | null
  mail_message_id: number | null
  calendar_account_id: string | null
  calendar_graph_event_id: string | null
  task_account_id: string | null
  task_list_id: string | null
  task_id: string | null
  people_contact_id: number | null
}

function legacyRowToTarget(row: LegacyNoteEntityLinkRow): ChronellEntityRef | null {
  switch (row.target_kind) {
    case 'note':
      return row.to_note_id ? { kind: 'note', noteId: row.to_note_id } : null
    case 'mail':
      return row.mail_message_id ? { kind: 'mail', messageId: row.mail_message_id } : null
    case 'calendar_event':
      return row.calendar_account_id && row.calendar_graph_event_id
        ? {
            kind: 'calendar_event',
            accountId: row.calendar_account_id,
            graphEventId: row.calendar_graph_event_id
          }
        : null
    case 'cloud_task':
      return row.task_account_id && row.task_list_id && row.task_id
        ? {
            kind: 'cloud_task',
            accountId: row.task_account_id,
            listId: row.task_list_id,
            taskId: row.task_id
          }
        : null
    case 'people_contact':
      return row.people_contact_id
        ? { kind: 'people_contact', contactId: row.people_contact_id }
        : null
    default:
      return null
  }
}

/** Fehlende Eintraege aus Legacy-Tabellen nach entity_links uebernehmen (idempotent). */
export function syncMissingLegacyEntityLinks(db: DbType): number {
  const tableExists = db
    .prepare(
      `SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'entity_links'`
    )
    .get()
  if (!tableExists) return 0

  let added = 0

  const legacyNoteRows = db
    .prepare(
      `SELECT from_note_id, target_kind, to_note_id, mail_message_id,
              calendar_account_id, calendar_graph_event_id,
              task_account_id, task_list_id, task_id, people_contact_id
       FROM user_note_entity_links ORDER BY id`
    )
    .all() as LegacyNoteEntityLinkRow[]

  for (const row of legacyNoteRows) {
    const target = legacyRowToTarget(row)
    if (!target) continue
    const from = noteEntityRef(row.from_note_id)
    if (entityLinkExists(from, target)) continue
    try {
      addEntityLink(from, target, 'related')
      added++
    } catch {
      /* fehlende Ziele nach Cache-Eviction */
    }
  }

  const mailTaskRows = db
    .prepare(
      `SELECT message_id, account_id, list_id, task_id FROM mail_cloud_task_link ORDER BY id`
    )
    .all() as Array<{
    message_id: number
    account_id: string
    list_id: string
    task_id: string
  }>

  for (const row of mailTaskRows) {
    const mail = mailEntityRef(row.message_id)
    const task = cloudTaskEntityRef(row.account_id, row.list_id, row.task_id)
    if (entityLinkExists(mail, task)) continue
    try {
      addEntityLink(mail, task, 'derived_from')
      added++
    } catch {
      /* */
    }
  }

  if (added > 0) {
    console.log(`[db] entity_links: ${added} fehlende Legacy-Verknuepfungen nachgezogen`)
  }
  return added
}

/** Einmalige Uebernahme aus user_note_entity_links und mail_cloud_task_link. */
export function migrateLegacyLinksToEntityLinks(db: DbType): void {
  syncMissingLegacyEntityLinks(db)
}
