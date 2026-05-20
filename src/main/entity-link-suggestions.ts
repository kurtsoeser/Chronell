import type { ChronellEntityRef } from '@shared/entity-ref'
import { entityRefKey } from '@shared/entity-ref'
import type { EntityLinkSuggestion } from '@shared/entity-links'
import { getDb } from './db/index'
import {
  entityLinkExists,
  getMailTodoMessageId,
  listEntityLinksForAnchor
} from './db/entity-links-repo'

const SUBJECT_PREFIX_RE = /^(re|fwd|fw|aw|wg|antw|vs):\s*/i

function normalizeMailSubject(subject: string): string {
  let s = subject.trim()
  while (SUBJECT_PREFIX_RE.test(s)) {
    s = s.replace(SUBJECT_PREFIX_RE, '').trim()
  }
  return s
}

function extractEmailAddress(raw: string): string {
  const trimmed = raw.trim()
  const angle = trimmed.match(/<([^>]+)>/)
  return (angle ? angle[1]! : trimmed).trim().toLowerCase()
}

function resolveMailMessageId(anchor: ChronellEntityRef): number | null {
  if (anchor.kind === 'mail') return anchor.messageId
  if (anchor.kind === 'mail_todo') return getMailTodoMessageId(anchor.todoId)
  return null
}

/** Heuristische Verknüpfungsvorschläge (Mail-Absender, Termin aus Betreff). */
export function suggestEntityLinks(anchor: ChronellEntityRef): EntityLinkSuggestion[] {
  const messageId = resolveMailMessageId(anchor)
  if (!messageId) return []

  const db = getDb()
  const msg = db
    .prepare(
      `SELECT subject, from_name, from_addr, account_id, received_at
       FROM messages WHERE id = ?`
    )
    .get(messageId) as
    | {
        subject: string | null
        from_name: string | null
        from_addr: string | null
        account_id: string | null
        received_at: string | null
      }
    | undefined
  if (!msg) return []

  const linkedKeys = new Set(
    listEntityLinksForAnchor(anchor).map((item) => entityRefKey(item.peer))
  )
  linkedKeys.add(entityRefKey(anchor))

  const out: EntityLinkSuggestion[] = []

  const fromAddr = msg.from_addr?.trim() ?? ''
  if (fromAddr) {
    const email = extractEmailAddress(fromAddr)
    if (email.includes('@')) {
      const contacts = db
        .prepare(
          `SELECT id, display_name, given_name, surname, primary_email, company
           FROM people_contacts
           WHERE TRIM(COALESCE(primary_email,'')) = ? COLLATE NOCASE
           LIMIT 2`
        )
        .all(email) as Array<{
        id: number
        display_name: string | null
        given_name: string | null
        surname: string | null
        primary_email: string | null
        company: string | null
      }>
      if (contacts.length === 1) {
        const c = contacts[0]!
        const target: ChronellEntityRef = { kind: 'people_contact', contactId: c.id }
        const key = entityRefKey(target)
        if (!linkedKeys.has(key) && !entityLinkExists(anchor, target)) {
          const name =
            c.display_name?.trim() ||
            [c.given_name, c.surname].filter(Boolean).join(' ').trim() ||
            c.primary_email?.trim() ||
            'Kontakt'
          out.push({
            target,
            title: name,
            subtitle: c.company?.trim() || c.primary_email?.trim() || msg.from_name?.trim() || null,
            reason: 'sender_email'
          })
          linkedKeys.add(key)
        }
      }
    }
  }

  const normSubject = normalizeMailSubject(msg.subject ?? '')
  if (normSubject.length >= 4) {
    const received = msg.received_at ? new Date(msg.received_at) : new Date()
    const rangeStart = new Date(received)
    rangeStart.setDate(rangeStart.getDate() - 21)
    const rangeEnd = new Date(received)
    rangeEnd.setDate(rangeEnd.getDate() + 21)
    const pattern = `%${normSubject.toLowerCase()}%`
    const receivedIso = msg.received_at ?? received.toISOString()

    const events = db
      .prepare(
        `SELECT account_id, graph_event_id, title, start_iso FROM calendar_events
         WHERE start_iso < ? AND end_iso > ?
           AND LENGTH(TRIM(COALESCE(title,''))) >= 3
           AND LOWER(COALESCE(title,'')) LIKE ?
         ORDER BY ABS(
           julianday(COALESCE(start_iso, '')) - julianday(?)
         ) ASC
         LIMIT 8`
      )
      .all(
        rangeEnd.toISOString(),
        rangeStart.toISOString(),
        pattern,
        receivedIso
      ) as Array<{
      account_id: string
      graph_event_id: string
      title: string | null
      start_iso: string | null
    }>

    let calendarCount = 0
    for (const ev of events) {
      if (calendarCount >= 3) break
      const target: ChronellEntityRef = {
        kind: 'calendar_event',
        accountId: ev.account_id,
        graphEventId: ev.graph_event_id
      }
      const key = entityRefKey(target)
      if (linkedKeys.has(key) || entityLinkExists(anchor, target)) continue
      out.push({
        target,
        title: ev.title?.trim() || 'Termin',
        subtitle: ev.start_iso?.slice(0, 16) ?? null,
        reason: 'subject_calendar'
      })
      linkedKeys.add(key)
      calendarCount++
    }
  }

  return out
}
