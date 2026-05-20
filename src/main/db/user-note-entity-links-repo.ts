import { getDb } from './index'
import type {
  NoteEntityLinkTarget,
  NoteEntityLinkTargetKind,
  NoteEntityLinkedItem,
  NoteLinksBundle
} from '@shared/note-entity-links'
import type { SettingsBackupEntityLinkSnapshot } from '@shared/types'
import { noteEntityLinkTargetsEqual } from '@shared/note-entity-links'
import {
  addEntityLink,
  deleteAllEntityLinksForRef,
  listEntityLinksForAnchor,
  noteEntityRef,
  removeEntityLinkIfMatches,
  resolveEntityRefTitleSubtitle
} from './entity-links-repo'

interface EntityLinkRow {
  id: number
  from_note_id: number
  target_kind: NoteEntityLinkTargetKind
  to_note_id: number | null
  mail_message_id: number | null
  calendar_account_id: string | null
  calendar_graph_event_id: string | null
  task_account_id: string | null
  task_list_id: string | null
  task_id: string | null
  people_contact_id: number | null
  created_at: string
}

function assertPositiveId(id: number, label: string): void {
  if (!Number.isFinite(id) || id <= 0) throw new Error(`${label} fehlt.`)
}

function rowToTarget(row: EntityLinkRow): NoteEntityLinkTarget {
  switch (row.target_kind) {
    case 'note':
      return { kind: 'note', noteId: row.to_note_id! }
    case 'mail':
      return { kind: 'mail', messageId: row.mail_message_id! }
    case 'calendar_event':
      return {
        kind: 'calendar_event',
        accountId: row.calendar_account_id!,
        graphEventId: row.calendar_graph_event_id!
      }
    case 'cloud_task':
      return {
        kind: 'cloud_task',
        accountId: row.task_account_id!,
        listId: row.task_list_id!,
        taskId: row.task_id!
      }
    case 'people_contact':
      return { kind: 'people_contact', contactId: row.people_contact_id! }
    default:
      throw new Error(`Unbekannter Verknuepfungstyp: ${row.target_kind}`)
  }
}

function resolveTitleSubtitle(
  row: EntityLinkRow
): { title: string; subtitle: string | null } {
  const db = getDb()
  switch (row.target_kind) {
    case 'note': {
      const n = db
        .prepare('SELECT title, kind FROM user_notes WHERE id = ?')
        .get(row.to_note_id!) as { title: string | null; kind: string } | undefined
      return {
        title: n?.title?.trim() || 'Ohne Titel',
        subtitle: n?.kind ?? 'standalone'
      }
    }
    case 'mail': {
      const m = db
        .prepare('SELECT subject, from_name, from_addr FROM messages WHERE id = ?')
        .get(row.mail_message_id!) as
        | { subject: string | null; from_name: string | null; from_addr: string | null }
        | undefined
      return {
        title: m?.subject?.trim() || '(Kein Betreff)',
        subtitle: m?.from_name?.trim() || m?.from_addr?.trim() || null
      }
    }
    case 'calendar_event': {
      const ev = db
        .prepare(
          `SELECT title, start_iso FROM calendar_events
           WHERE account_id = ? AND graph_event_id = ?`
        )
        .get(row.calendar_account_id!, row.calendar_graph_event_id!) as
        | { title: string | null; start_iso: string | null }
        | undefined
      return {
        title: ev?.title?.trim() || 'Termin',
        subtitle: ev?.start_iso?.slice(0, 16) ?? null
      }
    }
    case 'cloud_task': {
      const t = db
        .prepare(
          `SELECT title, due_iso FROM cloud_tasks
           WHERE account_id = ? AND list_id = ? AND task_id = ?`
        )
        .get(row.task_account_id!, row.task_list_id!, row.task_id!) as
        | { title: string; due_iso: string | null }
        | undefined
      return {
        title: t?.title?.trim() || 'Aufgabe',
        subtitle: t?.due_iso?.slice(0, 10) ?? null
      }
    }
    case 'people_contact': {
      const c = db
        .prepare(
          `SELECT display_name, given_name, surname, primary_email, company
           FROM people_contacts WHERE id = ?`
        )
        .get(row.people_contact_id!) as
        | {
            display_name: string | null
            given_name: string | null
            surname: string | null
            primary_email: string | null
            company: string | null
          }
        | undefined
      const name =
        c?.display_name?.trim() ||
        [c?.given_name, c?.surname].filter(Boolean).join(' ').trim() ||
        c?.primary_email?.trim() ||
        'Kontakt'
      return {
        title: name,
        subtitle: c?.company?.trim() || c?.primary_email?.trim() || null
      }
    }
    default:
      return { title: '—', subtitle: null }
  }
}

function mapRow(row: EntityLinkRow): NoteEntityLinkedItem {
  const { title, subtitle } = resolveTitleSubtitle(row)
  return {
    linkId: row.id,
    target: rowToTarget(row),
    title,
    subtitle,
    createdAt: row.created_at
  }
}

function mapIncomingNoteRow(row: EntityLinkRow): NoteEntityLinkedItem {
  const db = getDb()
  const n = db
    .prepare('SELECT title, kind FROM user_notes WHERE id = ?')
    .get(row.from_note_id) as { title: string | null; kind: string } | undefined
  return {
    linkId: row.id,
    target: { kind: 'note', noteId: row.from_note_id },
    title: n?.title?.trim() || 'Ohne Titel',
    subtitle: n?.kind ?? 'standalone',
    createdAt: row.created_at
  }
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
  return { outgoing, incoming: [] }
}

function assertTargetExists(target: NoteEntityLinkTarget): void {
  const db = getDb()
  switch (target.kind) {
    case 'note': {
      assertPositiveId(target.noteId, 'Ziel-Notiz-ID')
      const row = db.prepare('SELECT 1 FROM user_notes WHERE id = ?').get(target.noteId)
      if (!row) throw new Error('Notiz nicht gefunden.')
      break
    }
    case 'mail': {
      assertPositiveId(target.messageId, 'Mail-ID')
      const row = db.prepare('SELECT 1 FROM messages WHERE id = ?').get(target.messageId)
      if (!row) throw new Error('E-Mail nicht gefunden.')
      break
    }
    case 'calendar_event': {
      const accountId = target.accountId?.trim()
      const graphEventId = target.graphEventId?.trim()
      if (!accountId || !graphEventId) throw new Error('Termin-Referenz unvollstaendig.')
      const row = db
        .prepare(
          `SELECT 1 FROM calendar_events WHERE account_id = ? AND graph_event_id = ?`
        )
        .get(accountId, graphEventId)
      if (!row) throw new Error('Termin nicht im Cache.')
      break
    }
    case 'cloud_task': {
      const accountId = target.accountId?.trim()
      const listId = target.listId?.trim()
      const taskId = target.taskId?.trim()
      if (!accountId || !listId || !taskId) throw new Error('Aufgaben-Referenz unvollstaendig.')
      const row = db
        .prepare(
          `SELECT 1 FROM cloud_tasks WHERE account_id = ? AND list_id = ? AND task_id = ?`
        )
        .get(accountId, listId, taskId)
      if (!row) throw new Error('Aufgabe nicht im Cache.')
      break
    }
    case 'people_contact': {
      assertPositiveId(target.contactId, 'Kontakt-ID')
      const row = db.prepare('SELECT 1 FROM people_contacts WHERE id = ?').get(target.contactId)
      if (!row) throw new Error('Kontakt nicht gefunden.')
      break
    }
    default:
      throw new Error('Unbekannter Verknuepfungstyp.')
  }
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
