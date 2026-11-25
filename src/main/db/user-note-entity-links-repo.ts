import { getDb } from './index'
import type {
  NoteEntityLinkTarget,
  NoteEntityLinkedItem,
  NoteLinksBundle
} from '@shared/note-entity-links'
import type { SettingsBackupEntityLinkSnapshot } from '@shared/types'
import { noteEntityLinkTargetKey } from '@shared/note-entity-links'
import {
  addEntityLink,
  deleteAllEntityLinksForRef,
  listEntityLinksForAnchor,
  noteEntityRef,
  removeEntityLinkIfMatches
} from './entity-links-repo'

function assertPositiveId(id: number, label: string): void {
  if (!Number.isFinite(id) || id <= 0) throw new Error(`${label} fehlt.`)
}

export function listNoteLinksBundle(fromNoteId: number): NoteLinksBundle {
  assertPositiveId(fromNoteId, 'Notiz-ID')
  const anchor = noteEntityRef(fromNoteId)
  const links = listEntityLinksForAnchor(anchor)
  const outgoing: NoteEntityLinkedItem[] = links.map((item) => ({
    linkId: item.linkId,
    target: item.peer,
    title: item.title,
    subtitle: item.subtitle,
    createdAt: item.createdAt
  }))

  const seen = new Set(outgoing.map((item) => noteEntityLinkTargetKey(item.target)))
  const db = getDb()
  const childRows = db
    .prepare(
      `SELECT id, title, kind FROM user_notes
       WHERE parent_note_id = ?
       ORDER BY sort_order ASC, id ASC`
    )
    .all(fromNoteId) as Array<{ id: number; title: string | null; kind: string }>

  for (const row of childRows) {
    const target: NoteEntityLinkTarget = { kind: 'note', noteId: row.id }
    const key = noteEntityLinkTargetKey(target)
    if (seen.has(key)) continue
    seen.add(key)
    outgoing.push({
      linkId: 0,
      target,
      title: row.title?.trim() || 'Ohne Titel',
      subtitle: 'subpage',
      createdAt: ''
    })
  }

  return { outgoing, incoming: [] }
}

export function addNoteEntityLink(fromNoteId: number, target: NoteEntityLinkTarget): number {
  assertPositiveId(fromNoteId, 'Quell-Notiz-ID')
  const fromExists = getDb().prepare('SELECT 1 FROM user_notes WHERE id = ?').get(fromNoteId)
  if (!fromExists) throw new Error('Notiz nicht gefunden.')
  if (target.kind === 'note' && target.noteId === fromNoteId) {
    throw new Error('Eine Notiz kann nicht mit sich selbst verknuepft werden.')
  }
  return addEntityLink(noteEntityRef(fromNoteId), target, 'related')
}

export function removeNoteEntityLink(linkId: number, fromNoteId: number): void {
  assertPositiveId(linkId, 'Verknuepfungs-ID')
  assertPositiveId(fromNoteId, 'Notiz-ID')
  removeEntityLinkIfMatches(linkId, noteEntityRef(fromNoteId))
}

export function removeNoteEntityLinkIncoming(linkId: number, toNoteId: number): void {
  removeNoteEntityLink(linkId, toNoteId)
}

export function deleteAllEntityLinksForNote(noteId: number): void {
  assertPositiveId(noteId, 'Notiz-ID')
  deleteAllEntityLinksForRef(noteEntityRef(noteId))
  const db = getDb()
  db.prepare('DELETE FROM user_note_entity_links WHERE from_note_id = ?').run(noteId)
  db.prepare(
    `DELETE FROM user_note_entity_links WHERE target_kind = 'note' AND to_note_id = ?`
  ).run(noteId)
  db.prepare('DELETE FROM user_note_links WHERE from_note_id = ? OR to_note_id = ?').run(
    noteId,
    noteId
  )
}

function entityLinkRowToBackupSnapshot(
  row: {
    a_kind: string
    a_note_id: number | null
    b_kind: string
    b_note_id: number | null
    a_mail_message_id: number | null
    b_mail_message_id: number | null
    a_calendar_account_id: string | null
    a_calendar_graph_event_id: string | null
    b_calendar_account_id: string | null
    b_calendar_graph_event_id: string | null
    a_task_account_id: string | null
    a_task_list_id: string | null
    a_task_id: string | null
    b_task_account_id: string | null
    b_task_list_id: string | null
    b_task_id: string | null
    a_people_contact_id: number | null
    b_people_contact_id: number | null
    created_at: string
  },
  idToIndex: Map<number, number>
): SettingsBackupEntityLinkSnapshot | null {
  let fromNoteId: number | null = null
  let peerKind: string | null = null
  let peerFields: Partial<SettingsBackupEntityLinkSnapshot> = {}

  if (row.a_kind === 'note' && row.a_note_id) {
    fromNoteId = row.a_note_id
    peerKind = row.b_kind
    if (row.b_kind === 'note' && row.b_note_id) peerFields = { toNoteIndex: idToIndex.get(row.b_note_id) }
    else if (row.b_kind === 'mail' && row.b_mail_message_id)
      peerFields = { mailMessageId: row.b_mail_message_id }
    else if (row.b_kind === 'calendar_event' && row.b_calendar_account_id && row.b_calendar_graph_event_id)
      peerFields = {
        calendarAccountId: row.b_calendar_account_id,
        calendarGraphEventId: row.b_calendar_graph_event_id
      }
    else if (row.b_kind === 'cloud_task' && row.b_task_account_id && row.b_task_list_id && row.b_task_id)
      peerFields = {
        taskAccountId: row.b_task_account_id,
        taskListId: row.b_task_list_id,
        taskId: row.b_task_id
      }
    else if (row.b_kind === 'people_contact' && row.b_people_contact_id)
      peerFields = { peopleContactId: row.b_people_contact_id }
  } else if (row.b_kind === 'note' && row.b_note_id) {
    fromNoteId = row.b_note_id
    peerKind = row.a_kind
    if (row.a_kind === 'note' && row.a_note_id) peerFields = { toNoteIndex: idToIndex.get(row.a_note_id) }
    else if (row.a_kind === 'mail' && row.a_mail_message_id)
      peerFields = { mailMessageId: row.a_mail_message_id }
    else if (row.a_kind === 'calendar_event' && row.a_calendar_account_id && row.a_calendar_graph_event_id)
      peerFields = {
        calendarAccountId: row.a_calendar_account_id,
        calendarGraphEventId: row.a_calendar_graph_event_id
      }
    else if (row.a_kind === 'cloud_task' && row.a_task_account_id && row.a_task_list_id && row.a_task_id)
      peerFields = {
        taskAccountId: row.a_task_account_id,
        taskListId: row.a_task_list_id,
        taskId: row.a_task_id
      }
    else if (row.a_kind === 'people_contact' && row.a_people_contact_id)
      peerFields = { peopleContactId: row.a_people_contact_id }
  }

  if (fromNoteId == null || !peerKind) return null
  const fromNoteIndex = idToIndex.get(fromNoteId)
  if (fromNoteIndex === undefined) return null
  if (peerKind === 'note' && peerFields.toNoteIndex === undefined) return null

  return {
    fromNoteIndex,
    targetKind: peerKind as SettingsBackupEntityLinkSnapshot['targetKind'],
    createdAt: row.created_at,
    ...peerFields
  }
}

export function listEntityLinksForSettingsBackup(
  noteIdsInOrder: number[]
): SettingsBackupEntityLinkSnapshot[] {
  const idToIndex = new Map(noteIdsInOrder.map((id, index) => [id, index]))
  const rows = getDb()
    .prepare(
      `SELECT a_kind, a_note_id, b_kind, b_note_id,
              a_mail_message_id, b_mail_message_id,
              a_calendar_account_id, a_calendar_graph_event_id,
              b_calendar_account_id, b_calendar_graph_event_id,
              a_task_account_id, a_task_list_id, a_task_id,
              b_task_account_id, b_task_list_id, b_task_id,
              a_people_contact_id, b_people_contact_id, created_at
       FROM entity_links
       WHERE a_kind = 'note' OR b_kind = 'note'
       ORDER BY id`
    )
    .all() as Array<Parameters<typeof entityLinkRowToBackupSnapshot>[0]>

  const out: SettingsBackupEntityLinkSnapshot[] = []
  for (const row of rows) {
    const snap = entityLinkRowToBackupSnapshot(row, idToIndex)
    if (snap) out.push(snap)
  }
  return out
}

export function replaceAllEntityLinksFromBackup(
  links: SettingsBackupEntityLinkSnapshot[],
  noteIdByIndex: number[]
): void {
  const db = getDb()
  const tx = db.transaction(() => {
    db.prepare(`DELETE FROM entity_links WHERE a_kind = 'note' OR b_kind = 'note'`).run()
    db.prepare('DELETE FROM user_note_entity_links').run()
    db.prepare('DELETE FROM user_note_links').run()
    for (const link of links) {
      const fromNoteId = noteIdByIndex[link.fromNoteIndex]
      if (!fromNoteId) continue
      try {
        switch (link.targetKind) {
          case 'note': {
            const toNoteId =
              link.toNoteIndex != null ? noteIdByIndex[link.toNoteIndex] : undefined
            if (!toNoteId || fromNoteId === toNoteId) continue
            addNoteEntityLink(fromNoteId, { kind: 'note', noteId: toNoteId })
            break
          }
          case 'mail':
            if (link.mailMessageId == null) continue
            addNoteEntityLink(fromNoteId, { kind: 'mail', messageId: link.mailMessageId })
            break
          case 'calendar_event':
            if (!link.calendarAccountId || !link.calendarGraphEventId) continue
            addNoteEntityLink(fromNoteId, {
              kind: 'calendar_event',
              accountId: link.calendarAccountId,
              graphEventId: link.calendarGraphEventId
            })
            break
          case 'cloud_task':
            if (!link.taskAccountId || !link.taskListId || !link.taskId) continue
            addNoteEntityLink(fromNoteId, {
              kind: 'cloud_task',
              accountId: link.taskAccountId,
              listId: link.taskListId,
              taskId: link.taskId
            })
            break
          case 'people_contact':
            if (link.peopleContactId == null) continue
            addNoteEntityLink(fromNoteId, {
              kind: 'people_contact',
              contactId: link.peopleContactId
            })
            break
          default:
            break
        }
      } catch {
        /* skip broken refs after restore */
      }
    }
  })
  tx()
}

/** Legacy note-only API (delegates to entity links). */
export function listLinkedNotes(fromNoteId: number) {
  return listNoteLinksBundle(fromNoteId).outgoing
    .filter((item) => item.target.kind === 'note')
    .map((item) => {
      if (item.target.kind !== 'note') throw new Error('unexpected')
      const db = getDb()
      const n = db
        .prepare(
          `SELECT id, kind, title, body, scheduled_start_iso, updated_at
           FROM user_notes WHERE id = ?`
        )
        .get(item.target.noteId) as {
        id: number
        kind: 'mail' | 'calendar' | 'standalone'
        title: string | null
        body: string
        scheduled_start_iso: string | null
        updated_at: string
      }
      return {
        id: n.id,
        kind: n.kind,
        title: n.title,
        body: n.body,
        scheduledStartIso: n.scheduled_start_iso,
        updatedAt: n.updated_at
      }
    })
}

export function addNoteLink(fromNoteId: number, toNoteId: number): void {
  addNoteEntityLink(fromNoteId, { kind: 'note', noteId: toNoteId })
}

export function removeNoteLink(fromNoteId: number, toNoteId: number): void {
  const bundle = listNoteLinksBundle(fromNoteId)
  const match = bundle.outgoing.find(
    (item) => item.target.kind === 'note' && item.target.noteId === toNoteId
  )
  if (match) removeNoteEntityLink(match.linkId, fromNoteId)
}

export function listAllNoteLinksForBackup(): Array<{
  fromNoteId: number
  toNoteId: number
  createdAt: string
}> {
  const rows = getDb()
    .prepare(
      `SELECT a_note_id, b_note_id, created_at FROM entity_links
       WHERE a_kind = 'note' AND b_kind = 'note'
       ORDER BY id`
    )
    .all() as Array<{ a_note_id: number; b_note_id: number; created_at: string }>
  return rows.map((r) => ({
    fromNoteId: r.a_note_id,
    toNoteId: r.b_note_id,
    createdAt: r.created_at
  }))
}

export function listUserNoteLinksForSettingsBackup(noteIdsInOrder: number[]) {
  const idToIndex = new Map(noteIdsInOrder.map((id, index) => [id, index]))
  return listAllNoteLinksForBackup().flatMap((link) => {
    const fromNoteIndex = idToIndex.get(link.fromNoteId)
    const toNoteIndex = idToIndex.get(link.toNoteId)
    if (fromNoteIndex === undefined || toNoteIndex === undefined) return []
    return [{ fromNoteIndex, toNoteIndex, createdAt: link.createdAt }]
  })
}

export function replaceAllNoteLinksFromBackup(
  links: Array<{ fromNoteIndex: number; toNoteIndex: number; createdAt: string }>,
  noteIdByIndex: number[]
): void {
  const entityLinks: SettingsBackupEntityLinkSnapshot[] = links.map((l) => ({
    fromNoteIndex: l.fromNoteIndex,
    toNoteIndex: l.toNoteIndex,
    targetKind: 'note' as const,
    createdAt: l.createdAt
  }))
  replaceAllEntityLinksFromBackup(entityLinks, noteIdByIndex)
}

export function deleteAllLinksForNote(noteId: number): void {
  deleteAllEntityLinksForNote(noteId)
}

export interface PeopleContactLinkedNoteRow {
  noteId: number
  linkId: number
  title: string | null
  body: string
  updatedAt: string
}

export function listNotesLinkedToPeopleContact(contactId: number): PeopleContactLinkedNoteRow[] {
  assertPositiveId(contactId, 'Kontakt-ID')
  const contactRef: NoteEntityLinkTarget = { kind: 'people_contact', contactId }
  const links = listEntityLinksForAnchor(contactRef)
  const db = getDb()
  return links
    .filter((item) => item.peer.kind === 'note')
    .map((item) => {
      if (item.peer.kind !== 'note') throw new Error('unexpected')
      const n = db
        .prepare('SELECT title, body, updated_at FROM user_notes WHERE id = ?')
        .get(item.peer.noteId) as
        | { title: string | null; body: string; updated_at: string }
        | undefined
      return {
        noteId: item.peer.noteId,
        linkId: item.linkId,
        title: n?.title ?? null,
        body: n?.body ?? '',
        updatedAt: n?.updated_at ?? item.createdAt
      }
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || b.noteId - a.noteId)
}
