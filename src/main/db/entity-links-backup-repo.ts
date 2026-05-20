import type { SettingsBackupFullEntityLinkSnapshot } from '@shared/types'
import {
  addEntityLink,
  listAllEntityLinkRows,
  rowSideToRef,
  type EntityLinkRow
} from './entity-links-repo'
import { getDb } from './index'

function rowToSnapshot(row: EntityLinkRow): SettingsBackupFullEntityLinkSnapshot {
  return {
    refAKey: row.ref_a_key,
    refBKey: row.ref_b_key,
    aKind: row.a_kind,
    aNoteId: row.a_note_id,
    aMailMessageId: row.a_mail_message_id,
    aMailTodoId: row.a_mail_todo_id,
    aCalendarAccountId: row.a_calendar_account_id,
    aCalendarGraphEventId: row.a_calendar_graph_event_id,
    aTaskAccountId: row.a_task_account_id,
    aTaskListId: row.a_task_list_id,
    aTaskId: row.a_task_id,
    aPeopleContactId: row.a_people_contact_id,
    bKind: row.b_kind,
    bNoteId: row.b_note_id,
    bMailMessageId: row.b_mail_message_id,
    bMailTodoId: row.b_mail_todo_id,
    bCalendarAccountId: row.b_calendar_account_id,
    bCalendarGraphEventId: row.b_calendar_graph_event_id,
    bTaskAccountId: row.b_task_account_id,
    bTaskListId: row.b_task_list_id,
    bTaskId: row.b_task_id,
    bPeopleContactId: row.b_people_contact_id,
    linkKind: row.link_kind,
    createdAt: row.created_at
  }
}

function snapshotToRefs(snap: SettingsBackupFullEntityLinkSnapshot): {
  a: ReturnType<typeof rowSideToRef>
  b: ReturnType<typeof rowSideToRef>
} {
  const row = {
    id: 0,
    ref_a_key: snap.refAKey,
    ref_b_key: snap.refBKey,
    a_kind: snap.aKind,
    a_note_id: snap.aNoteId ?? null,
    a_mail_message_id: snap.aMailMessageId ?? null,
    a_mail_todo_id: snap.aMailTodoId ?? null,
    a_calendar_account_id: snap.aCalendarAccountId ?? null,
    a_calendar_graph_event_id: snap.aCalendarGraphEventId ?? null,
    a_task_account_id: snap.aTaskAccountId ?? null,
    a_task_list_id: snap.aTaskListId ?? null,
    a_task_id: snap.aTaskId ?? null,
    a_people_contact_id: snap.aPeopleContactId ?? null,
    b_kind: snap.bKind,
    b_note_id: snap.bNoteId ?? null,
    b_mail_message_id: snap.bMailMessageId ?? null,
    b_mail_todo_id: snap.bMailTodoId ?? null,
    b_calendar_account_id: snap.bCalendarAccountId ?? null,
    b_calendar_graph_event_id: snap.bCalendarGraphEventId ?? null,
    b_task_account_id: snap.bTaskAccountId ?? null,
    b_task_list_id: snap.bTaskListId ?? null,
    b_task_id: snap.bTaskId ?? null,
    b_people_contact_id: snap.bPeopleContactId ?? null,
    link_kind: snap.linkKind,
    created_at: snap.createdAt
  } satisfies EntityLinkRow
  return { a: rowSideToRef(row, 'a'), b: rowSideToRef(row, 'b') }
}

export function listFullEntityLinksForSettingsBackup(): SettingsBackupFullEntityLinkSnapshot[] {
  return listAllEntityLinkRows().map(rowToSnapshot)
}

export function replaceAllFullEntityLinksFromBackup(
  links: SettingsBackupFullEntityLinkSnapshot[]
): void {
  const db = getDb()
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM entity_links').run()
    for (const snap of links) {
      try {
        const { a, b } = snapshotToRefs(snap)
        addEntityLink(a, b, snap.linkKind ?? 'related')
      } catch {
        /* Ziel nach Restore evtl. noch nicht im Cache */
      }
    }
  })
  tx()
}
