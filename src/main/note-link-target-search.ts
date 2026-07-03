import { getDb } from './db/index'
import type { NoteLinkTargetCandidate } from '@shared/note-entity-links'

export function searchNoteLinkTargets(
  query: string,
  opts?: { excludeNoteId?: number; limit?: number }
): NoteLinkTargetCandidate[] {
  const q = query.trim().toLowerCase()
  const limit = Math.min(Math.max(opts?.limit ?? 30, 1), 80)
  const excludeNoteId = opts?.excludeNoteId
  const out: NoteLinkTargetCandidate[] = []

  const db = getDb()

  const noteSql = excludeNoteId
    ? `SELECT id, title, kind FROM user_notes WHERE id != ?
       ${q ? `AND (LOWER(COALESCE(title,'')) LIKE ? OR LOWER(body) LIKE ?)` : ''}
       ORDER BY updated_at DESC LIMIT ?`
    : `SELECT id, title, kind FROM user_notes
       ${q ? `WHERE LOWER(COALESCE(title,'')) LIKE ? OR LOWER(body) LIKE ?` : ''}
       ORDER BY updated_at DESC LIMIT ?`
  const noteParams = excludeNoteId
    ? q
      ? [excludeNoteId, `%${q}%`, `%${q}%`, limit]
      : [excludeNoteId, limit]
    : q
      ? [`%${q}%`, `%${q}%`, limit]
      : [limit]
  const notes = db.prepare(noteSql).all(...noteParams) as Array<{
    id: number
    title: string | null
    kind: string
  }>
  for (const n of notes) {
    out.push({
      target: { kind: 'note', noteId: n.id },
      title: n.title?.trim() || 'Ohne Titel',
      subtitle: n.kind
    })
  }

  if (out.length < limit) {
    const todoLimit = limit - out.length
    const openTodos = db
      .prepare(
        `SELECT t.id, m.subject, m.from_name, m.from_addr, t.due_at
         FROM todos t
         JOIN messages m ON m.id = t.message_id
         WHERE t.status = 'open'
         ${q ? `AND (LOWER(COALESCE(m.subject,'')) LIKE ? OR LOWER(COALESCE(m.from_name,'')) LIKE ? OR LOWER(COALESCE(m.from_addr,'')) LIKE ?)` : ''}
         ORDER BY t.due_at IS NULL, t.due_at ASC, t.id DESC
         LIMIT ?`
      )
      .all(
        ...(q
          ? [`%${q}%`, `%${q}%`, `%${q}%`, todoLimit]
          : [todoLimit])
      ) as Array<{
      id: number
      subject: string | null
      from_name: string | null
      from_addr: string | null
      due_at: string | null
    }>
    for (const t of openTodos) {
      out.push({
        target: { kind: 'mail_todo', todoId: t.id },
        title: t.subject?.trim() || '(Kein Betreff)',
        subtitle: t.from_name?.trim() || t.from_addr?.trim() || t.due_at?.slice(0, 10) || null
      })
    }
  }

  if (out.length < limit) {
    const mailLimit = limit - out.length
    const mails = db
      .prepare(
        q
          ? `SELECT id, subject, from_name, from_addr FROM messages
             WHERE LOWER(COALESCE(subject,'')) LIKE ?
                OR LOWER(COALESCE(from_name,'')) LIKE ?
                OR LOWER(COALESCE(from_addr,'')) LIKE ?
             ORDER BY received_at DESC LIMIT ?`
          : `SELECT id, subject, from_name, from_addr FROM messages
             ORDER BY received_at DESC LIMIT ?`
      )
      .all(
        ...(q
          ? [`%${q}%`, `%${q}%`, `%${q}%`, mailLimit]
          : [mailLimit])
      ) as Array<{
      id: number
      subject: string | null
      from_name: string | null
      from_addr: string | null
    }>
    for (const m of mails) {
      out.push({
        target: { kind: 'mail', messageId: m.id },
        title: m.subject?.trim() || '(Kein Betreff)',
        subtitle: m.from_name?.trim() || m.from_addr?.trim() || null
      })
    }
  }

  if (out.length < limit) {
    const evLimit = limit - out.length
    const now = new Date()
    const start = new Date(now)
    start.setMonth(start.getMonth() - 3)
    const end = new Date(now)
    end.setMonth(end.getMonth() + 6)
    const startIso = start.toISOString()
    const endIso = end.toISOString()
    const events = db
      .prepare(
        `SELECT account_id, graph_event_id, title, start_iso FROM calendar_events
         WHERE start_iso < ? AND end_iso > ?
         ${q ? `AND LOWER(COALESCE(title,'')) LIKE ?` : ''}
         ORDER BY start_iso ASC LIMIT ?`
      )
      .all(
        ...(q
          ? [endIso, startIso, `%${q}%`, evLimit]
          : [endIso, startIso, evLimit])
      ) as Array<{
      account_id: string
      graph_event_id: string
      title: string | null
      start_iso: string | null
    }>
    for (const ev of events) {
      out.push({
        target: {
          kind: 'calendar_event',
          accountId: ev.account_id,
          graphEventId: ev.graph_event_id
        },
        title: ev.title?.trim() || 'Termin',
        subtitle: ev.start_iso?.slice(0, 16) ?? null
      })
    }
  }

  if (out.length < limit) {
    const contactLimit = limit - out.length
    const contactSql = q
      ? `SELECT id, display_name, given_name, surname, primary_email, company
         FROM people_contacts
         WHERE LOWER(COALESCE(display_name,'')) LIKE ?
            OR LOWER(COALESCE(given_name,'')) LIKE ?
            OR LOWER(COALESCE(surname,'')) LIKE ?
            OR LOWER(COALESCE(primary_email,'')) LIKE ?
            OR LOWER(COALESCE(company,'')) LIKE ?
         ORDER BY COALESCE(display_name, surname, given_name) COLLATE NOCASE LIMIT ?`
      : `SELECT id, display_name, given_name, surname, primary_email, company
         FROM people_contacts
         ORDER BY COALESCE(display_name, surname, given_name) COLLATE NOCASE LIMIT ?`
    const contactParams = q
      ? [`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, contactLimit]
      : [contactLimit]
    const contacts = db.prepare(contactSql).all(...contactParams) as Array<{
      id: number
      display_name: string | null
      given_name: string | null
      surname: string | null
      primary_email: string | null
      company: string | null
    }>
    for (const c of contacts) {
      const name =
        c.display_name?.trim() ||
        [c.given_name, c.surname].filter(Boolean).join(' ').trim() ||
        c.primary_email?.trim() ||
        'Kontakt'
      out.push({
        target: { kind: 'people_contact', contactId: c.id },
        title: name,
        subtitle: c.company?.trim() || c.primary_email?.trim() || null
      })
    }
  }

  if (out.length < limit) {
    const taskLimit = limit - out.length
    const tasks = db
      .prepare(
        q
          ? `SELECT account_id, list_id, task_id, title, due_iso FROM cloud_tasks
             WHERE LOWER(title) LIKE ?
             ORDER BY completed ASC, due_iso IS NULL, due_iso ASC LIMIT ?`
          : `SELECT account_id, list_id, task_id, title, due_iso FROM cloud_tasks
             ORDER BY completed ASC, due_iso IS NULL, due_iso ASC LIMIT ?`
      )
      .all(...(q ? [`%${q}%`, taskLimit] : [taskLimit])) as Array<{
      account_id: string
      list_id: string
      task_id: string
      title: string
      due_iso: string | null
    }>
    for (const t of tasks) {
      out.push({
        target: {
          kind: 'cloud_task',
          accountId: t.account_id,
          listId: t.list_id,
          taskId: t.task_id
        },
        title: t.title?.trim() || 'Aufgabe',
        subtitle: t.due_iso?.slice(0, 10) ?? null
      })
    }
  }

  return out.slice(0, limit)
}
