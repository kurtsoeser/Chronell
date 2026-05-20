import type Database from 'better-sqlite3'
import type { ChronellEntityRef } from '@shared/entity-ref'

export interface EntityGraphLayoutMeta {
  layoutScope: string
  layoutTimeMonth: string | null
  layoutTimeWeek: string | null
  layoutTimeYear: string | null
  layoutDomain: string | null
  layoutCompany: string | null
  layoutCalendarList: string | null
  layoutCalendarListLabel: string | null
  layoutTaskList: string | null
  layoutTaskListLabel: string | null
  layoutFolderId: number | null
}

function resolveCalendarFolderName(
  db: Database.Database,
  accountId: string,
  calendarId: string
): string | null {
  const row = db
    .prepare(
      `SELECT name FROM calendar_folders WHERE account_id = ? AND calendar_id = ?`
    )
    .get(accountId, calendarId) as { name: string } | undefined
  const name = row?.name?.trim()
  return name && name.length > 0 ? name : null
}

function resolveTaskListName(
  db: Database.Database,
  accountId: string,
  listId: string
): string | null {
  const row = db
    .prepare(`SELECT name FROM task_lists WHERE account_id = ? AND list_id = ?`)
    .get(accountId, listId) as { name: string } | undefined
  const name = row?.name?.trim()
  return name && name.length > 0 ? name : null
}

function bucketMonth(iso: string | null | undefined): string | null {
  if (!iso?.trim()) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

function bucketYear(iso: string | null | undefined): string | null {
  if (!iso?.trim()) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return String(d.getFullYear())
}

/** ISO-Kalenderwoche als `YYYY-Www` (z. B. `2026-W20`). */
function bucketWeek(iso: string | null | undefined): string | null {
  if (!iso?.trim()) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const day = d.getDay() || 7
  const thursday = new Date(d)
  thursday.setDate(d.getDate() + 4 - day)
  const year = thursday.getFullYear()
  const jan1 = new Date(year, 0, 1)
  const week = Math.ceil(((thursday.getTime() - jan1.getTime()) / 86_400_000 + 1) / 7)
  return `${year}-W${String(week).padStart(2, '0')}`
}

function extractEmailDomain(addr: string | null | undefined): string | null {
  if (!addr?.trim()) return null
  const m = addr.trim().match(/<([^>]+)>/)
  const email = (m ? m[1]! : addr).trim().toLowerCase()
  const at = email.lastIndexOf('@')
  if (at < 0) return null
  const domain = email.slice(at + 1)
  return domain.length > 0 ? domain : null
}

function scopeFromClusterKey(clusterKey: string, kind: ChronellEntityRef['kind']): string {
  if (clusterKey.startsWith('scope:')) return clusterKey
  switch (kind) {
    case 'note':
      return 'scope:notes'
    case 'people_contact':
      return 'scope:contacts'
    case 'mail':
    case 'mail_todo':
      return 'scope:mail'
    case 'calendar_event':
      return 'scope:calendar'
    case 'cloud_task':
      return 'scope:tasks'
    default:
      return 'scope:other'
  }
}

/** Zusatz-Layout-Metadaten fuer Graph-Gruppierungen (kein IPC noetig). */
export function resolveEntityGraphLayoutMeta(
  ref: ChronellEntityRef,
  clusterKey: string,
  db: Database.Database
): EntityGraphLayoutMeta {
  const base: EntityGraphLayoutMeta = {
    layoutScope: scopeFromClusterKey(clusterKey, ref.kind),
    layoutTimeMonth: null,
    layoutTimeWeek: null,
    layoutTimeYear: null,
    layoutDomain: null,
    layoutCompany: null,
    layoutCalendarList: null,
    layoutCalendarListLabel: null,
    layoutTaskList: null,
    layoutTaskListLabel: null,
    layoutFolderId: null
  }

  switch (ref.kind) {
    case 'mail': {
      const row = db
        .prepare(
          `SELECT received_at, from_addr, folder_id FROM messages WHERE id = ?`
        )
        .get(ref.messageId) as
        | { received_at: string | null; from_addr: string | null; folder_id: number | null }
        | undefined
      if (row) {
        base.layoutTimeMonth = bucketMonth(row.received_at)
        base.layoutTimeWeek = bucketWeek(row.received_at)
        base.layoutTimeYear = bucketYear(row.received_at)
        base.layoutDomain = extractEmailDomain(row.from_addr)
        base.layoutFolderId = row.folder_id ?? null
      }
      break
    }
    case 'mail_todo': {
      const row = db
        .prepare(
          `SELECT t.due_at, m.received_at, m.from_addr, m.folder_id
           FROM todos t JOIN messages m ON m.id = t.message_id WHERE t.id = ?`
        )
        .get(ref.todoId) as
        | {
            due_at: string | null
            received_at: string | null
            from_addr: string | null
            folder_id: number | null
          }
        | undefined
      if (row) {
        const t = row.due_at ?? row.received_at
        base.layoutTimeMonth = bucketMonth(t)
        base.layoutTimeWeek = bucketWeek(t)
        base.layoutTimeYear = bucketYear(t)
        base.layoutDomain = extractEmailDomain(row.from_addr)
        base.layoutFolderId = row.folder_id ?? null
      }
      break
    }
    case 'calendar_event': {
      const row = db
        .prepare(
          `SELECT start_iso, graph_calendar_id FROM calendar_events
           WHERE account_id = ? AND graph_event_id = ?`
        )
        .get(ref.accountId, ref.graphEventId) as
        | { start_iso: string | null; graph_calendar_id: string | null }
        | undefined
      if (row) {
        base.layoutTimeMonth = bucketMonth(row.start_iso)
        base.layoutTimeWeek = bucketWeek(row.start_iso)
        base.layoutTimeYear = bucketYear(row.start_iso)
        if (row.graph_calendar_id?.trim()) {
          const calId = row.graph_calendar_id.trim()
          base.layoutCalendarList = `cal:${ref.accountId}:${calId}`
          base.layoutCalendarListLabel = resolveCalendarFolderName(db, ref.accountId, calId)
        }
      }
      break
    }
    case 'cloud_task': {
      const row = db
        .prepare(
          `SELECT ct.due_iso, ct.list_id, tl.name AS list_name
           FROM cloud_tasks ct
           LEFT JOIN task_lists tl
             ON tl.account_id = ct.account_id AND tl.list_id = ct.list_id
           WHERE ct.account_id = ? AND ct.list_id = ? AND ct.task_id = ?`
        )
        .get(ref.accountId, ref.listId, ref.taskId) as
        | { due_iso: string | null; list_id: string | null; list_name: string | null }
        | undefined
      if (row) {
        base.layoutTimeMonth = bucketMonth(row.due_iso)
        base.layoutTimeWeek = bucketWeek(row.due_iso)
        base.layoutTimeYear = bucketYear(row.due_iso)
        if (row.list_id?.trim()) {
          const listId = row.list_id.trim()
          base.layoutTaskList = `tasklist:${ref.accountId}:${listId}`
          const joined = row.list_name?.trim()
          base.layoutTaskListLabel =
            joined && joined.length > 0
              ? joined
              : resolveTaskListName(db, ref.accountId, listId)
        }
      }
      break
    }
    case 'people_contact': {
      const row = db
        .prepare(
          `SELECT primary_email, company FROM people_contacts WHERE id = ?`
        )
        .get(ref.contactId) as
        | { primary_email: string | null; company: string | null }
        | undefined
      if (row) {
        base.layoutDomain = extractEmailDomain(row.primary_email)
        const company = row.company?.trim()
        if (company) base.layoutCompany = `company:${company.toLowerCase()}`
      }
      break
    }
    case 'note': {
      const row = db
        .prepare(`SELECT updated_at FROM user_notes WHERE id = ?`)
        .get(ref.noteId) as { updated_at: string | null } | undefined
      if (row) {
        base.layoutTimeMonth = bucketMonth(row.updated_at)
        base.layoutTimeWeek = bucketWeek(row.updated_at)
        base.layoutTimeYear = bucketYear(row.updated_at)
      }
      break
    }
    default:
      break
  }

  return base
}
