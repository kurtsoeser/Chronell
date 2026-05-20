import { entityRefKey, type EntityRefKind } from '@shared/entity-ref'
import type { EntityLinkTargetCandidate } from '@shared/entity-links'
import { formatCalendarEventWhenLabel, formatDueIsoWhenLabel } from '@shared/calendar-datetime'
import {
  getAppDisplayLocaleCode,
  getCalendarDisplayTimeZoneSync
} from './calendar-display-config'
import {
  CALENDAR_PALETTE_ORDER_SQL,
  CLOUD_TASK_PALETTE_ORDER_SQL,
  MAIL_PALETTE_JOINS,
  MAIL_PALETTE_PRIORITY_SQL,
  calendarPaletteWindowBounds
} from './entity-palette-order'
import { getDb } from './db/index'

const PALETTE_KIND_RANK: Record<EntityRefKind, number> = {
  mail_todo: 0,
  mail: 1,
  calendar_event: 2,
  cloud_task: 3,
  people_contact: 4,
  note: 5
}

/** Objekte mehrerer Arten für die Graph-Palette (Filter-Pills + Suche). */
export function searchEntityPalette(
  kinds: EntityRefKind[],
  query: string,
  limit = 50
): EntityLinkTargetCandidate[] {
  const uniqueKinds = [...new Set(kinds)]
  if (uniqueKinds.length === 0) return []
  if (uniqueKinds.length === 1) {
    return searchEntityPaletteByKind(uniqueKinds[0]!, query, limit)
  }

  const cap = Math.min(Math.max(limit, 1), 120)
  const perKind = Math.min(80, Math.max(24, cap))
  const seen = new Set<string>()
  const merged: EntityLinkTargetCandidate[] = []

  for (const kind of uniqueKinds) {
    for (const row of searchEntityPaletteByKind(kind, query, perKind)) {
      const key = entityRefKey(row.target)
      if (seen.has(key)) continue
      seen.add(key)
      merged.push(row)
    }
  }

  merged.sort(
    (a, b) =>
      (PALETTE_KIND_RANK[a.target.kind] ?? 9) - (PALETTE_KIND_RANK[b.target.kind] ?? 9)
  )
  return merged.slice(0, cap)
}

/** Objekte einer Art für die Graph-Palette (Tabs + Suche). */
export function searchEntityPaletteByKind(
  kind: EntityRefKind,
  query: string,
  limit = 40
): EntityLinkTargetCandidate[] {
  const q = query.trim().toLowerCase()
  const cap = Math.min(Math.max(limit, 1), 80)
  const db = getDb()

  switch (kind) {
    case 'note': {
      const rows = db
        .prepare(
          q
            ? `SELECT id, title, kind FROM user_notes
               WHERE LOWER(COALESCE(title,'')) LIKE ? OR LOWER(body) LIKE ?
               ORDER BY updated_at DESC LIMIT ?`
            : `SELECT id, title, kind FROM user_notes ORDER BY updated_at DESC LIMIT ?`
        )
        .all(...(q ? [`%${q}%`, `%${q}%`, cap] : [cap])) as Array<{
        id: number
        title: string | null
        kind: string
      }>
      return rows.map((n) => ({
        target: { kind: 'note', noteId: n.id },
        title: n.title?.trim() || 'Ohne Titel',
        subtitle: n.kind
      }))
    }
    case 'mail': {
      const rows = db
        .prepare(
          q
            ? `SELECT m.id, m.subject, m.from_name, m.from_addr, m.received_at
               FROM messages m
               ${MAIL_PALETTE_JOINS}
               WHERE (
                 LOWER(COALESCE(m.subject,'')) LIKE ?
                 OR LOWER(COALESCE(m.from_name,'')) LIKE ?
                 OR LOWER(COALESCE(m.from_addr,'')) LIKE ?
               )
               ORDER BY (${MAIL_PALETTE_PRIORITY_SQL}) ASC,
                        m.received_at DESC NULLS LAST,
                        m.id DESC
               LIMIT ?`
            : `SELECT m.id, m.subject, m.from_name, m.from_addr, m.received_at
               FROM messages m
               ${MAIL_PALETTE_JOINS}
               WHERE f.well_known NOT IN ('deleteditems', 'junkemail')
               ORDER BY (${MAIL_PALETTE_PRIORITY_SQL}) ASC,
                        m.received_at DESC NULLS LAST,
                        m.id DESC
               LIMIT ?`
        )
        .all(...(q ? [`%${q}%`, `%${q}%`, `%${q}%`, cap] : [cap])) as Array<{
        id: number
        subject: string | null
        from_name: string | null
        from_addr: string | null
      }>
      return rows.map((m) => ({
        target: { kind: 'mail', messageId: m.id },
        title: m.subject?.trim() || '(Kein Betreff)',
        subtitle: m.from_name?.trim() || m.from_addr?.trim() || null
      }))
    }
    case 'mail_todo': {
      const rows = db
        .prepare(
          `SELECT t.id, m.subject, m.from_name, m.from_addr, t.due_at
           FROM todos t
           JOIN messages m ON m.id = t.message_id
           WHERE t.status = 'open'
           ${
             q
               ? `AND (LOWER(COALESCE(m.subject,'')) LIKE ?
                   OR LOWER(COALESCE(m.from_name,'')) LIKE ?
                   OR LOWER(COALESCE(m.from_addr,'')) LIKE ?)`
               : ''
           }
           ORDER BY ABS(julianday(COALESCE(t.due_at, datetime('now'))) - julianday(datetime('now'))) ASC,
                    t.due_at ASC NULLS LAST,
                    t.id DESC
           LIMIT ?`
        )
        .all(...(q ? [`%${q}%`, `%${q}%`, `%${q}%`, cap] : [cap])) as Array<{
        id: number
        subject: string | null
        from_name: string | null
        from_addr: string | null
        due_at: string | null
      }>
      const tz = getCalendarDisplayTimeZoneSync()
      const loc = getAppDisplayLocaleCode()
      return rows.map((t) => ({
        target: { kind: 'mail_todo', todoId: t.id },
        title: t.subject?.trim() || '(Kein Betreff)',
        subtitle:
          (t.due_at ? formatDueIsoWhenLabel(t.due_at, tz, loc) : null) ??
          t.from_name?.trim() ??
          t.from_addr?.trim() ??
          null
      }))
    }
    case 'calendar_event': {
      const { rangeStartIso, rangeEndIso, nowIso } = calendarPaletteWindowBounds()
      const rows = db
        .prepare(
          `SELECT account_id, graph_event_id, title, start_iso, is_all_day FROM calendar_events
           WHERE start_iso < ? AND end_iso > ?
           ${q ? `AND LOWER(COALESCE(title,'')) LIKE ?` : ''}
           ORDER BY ${CALENDAR_PALETTE_ORDER_SQL} LIMIT ?`
        )
        .all(
          ...(q
            ? [rangeEndIso, rangeStartIso, `%${q}%`, nowIso, cap]
            : [rangeEndIso, rangeStartIso, nowIso, cap])
        ) as Array<{
        account_id: string
        graph_event_id: string
        title: string | null
        start_iso: string | null
        is_all_day: number | null
      }>
      const tz = getCalendarDisplayTimeZoneSync()
      const loc = getAppDisplayLocaleCode()
      return rows.map((ev) => ({
        target: {
          kind: 'calendar_event',
          accountId: ev.account_id,
          graphEventId: ev.graph_event_id
        },
        title: ev.title?.trim() || 'Termin',
        subtitle:
          ev.start_iso != null
            ? formatCalendarEventWhenLabel(
                ev.start_iso,
                tz,
                loc,
                Boolean(ev.is_all_day)
              )
            : null
      }))
    }
    case 'cloud_task': {
      const nowIso = new Date().toISOString()
      const rows = db
        .prepare(
          q
            ? `SELECT account_id, list_id, task_id, title, due_iso FROM cloud_tasks
               WHERE completed = 0 AND LOWER(title) LIKE ?
               ORDER BY ${CLOUD_TASK_PALETTE_ORDER_SQL} LIMIT ?`
            : `SELECT account_id, list_id, task_id, title, due_iso FROM cloud_tasks
               WHERE completed = 0
               ORDER BY ${CLOUD_TASK_PALETTE_ORDER_SQL} LIMIT ?`
        )
        .all(...(q ? [`%${q}%`, nowIso, cap] : [nowIso, cap])) as Array<{
        account_id: string
        list_id: string
        task_id: string
        title: string
        due_iso: string | null
      }>
      const tzTask = getCalendarDisplayTimeZoneSync()
      const locTask = getAppDisplayLocaleCode()
      return rows.map((t) => ({
        target: {
          kind: 'cloud_task',
          accountId: t.account_id,
          listId: t.list_id,
          taskId: t.task_id
        },
        title: t.title?.trim() || 'Aufgabe',
        subtitle: t.due_iso
          ? formatDueIsoWhenLabel(t.due_iso, tzTask, locTask)
          : null
      }))
    }
    case 'people_contact': {
      const rows = db
        .prepare(
          q
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
        )
        .all(...(q ? [`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, cap] : [cap])) as Array<{
        id: number
        display_name: string | null
        given_name: string | null
        surname: string | null
        primary_email: string | null
        company: string | null
      }>
      return rows.map((c) => {
        const name =
          c.display_name?.trim() ||
          [c.given_name, c.surname].filter(Boolean).join(' ').trim() ||
          c.primary_email?.trim() ||
          'Kontakt'
        return {
          target: { kind: 'people_contact', contactId: c.id },
          title: name,
          subtitle: c.company?.trim() || c.primary_email?.trim() || null
        }
      })
    }
    default:
      return []
  }
}
