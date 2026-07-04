import type { ChronellEntityRef, EntityRefKind } from '@shared/entity-ref'
import { entityRefKey } from '@shared/entity-ref'
import type { EntityLinkTargetCandidate } from '@shared/entity-links'
import { getDb } from '../db/index'
import { listEntityLinksForAnchor } from '../db/entity-links-repo'
import {
  anchorReferenceIso,
  buildAnchorSnapshot,
  type EntityLinkAiSnapshot
} from './entity-link-ai-context'

const TIME_WINDOW_DAYS = 21

export interface AiLinkCandidateEntry {
  candId: string
  ref: ChronellEntityRef
  snapshot: EntityLinkAiSnapshot
  title: string
  subtitle: string | null
}

export interface AiLinkRetrievalResult {
  anchor: EntityLinkAiSnapshot
  candidates: AiLinkCandidateEntry[]
}

export interface AiLinkRetrievalOptions {
  subjectKeywords?: string[]
  kindBoost?: EntityRefKind[]
}

function dateWindow(centerIso: string): { start: string; end: string } {
  const center = new Date(centerIso)
  const start = new Date(center)
  start.setDate(start.getDate() - TIME_WINDOW_DAYS)
  const end = new Date(center)
  end.setDate(end.getDate() + TIME_WINDOW_DAYS)
  return { start: start.toISOString(), end: end.toISOString() }
}

function extractEmailDomain(addr: string | null | undefined): string | null {
  if (!addr?.trim()) return null
  const m = addr.match(/<([^>]+)>/) ?? [null, addr]
  const email = (m[1] ?? addr).trim().toLowerCase()
  const at = email.lastIndexOf('@')
  if (at < 0) return null
  return email.slice(at + 1)
}

function subjectTokens(subject: string | null | undefined): string[] {
  if (!subject?.trim()) return []
  return subject
    .toLowerCase()
    .replace(/^(re|fwd|fw|aw|wg|antw|vs):\s*/gi, '')
    .split(/[\s\-–—_,.;:()[\]]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3)
}

function pushCandidate(
  map: Map<string, AiLinkCandidateEntry>,
  cap: number,
  entry: Omit<AiLinkCandidateEntry, 'candId'> & { candId?: string }
): void {
  if (map.size >= cap) return
  const key = entityRefKey(entry.ref)
  if (map.has(key)) return
  map.set(key, { ...entry, candId: `cand_${map.size + 1}` })
}

function reindexCandidates(map: Map<string, AiLinkCandidateEntry>): AiLinkCandidateEntry[] {
  const list = [...map.values()]
  return list.map((c, i) => ({ ...c, candId: `cand_${i + 1}` }))
}

function sortCandidatesByKindBoost(
  list: AiLinkCandidateEntry[],
  kindBoost?: EntityRefKind[]
): AiLinkCandidateEntry[] {
  if (!kindBoost?.length) return list
  const order = new Map(kindBoost.map((k, i) => [k, i]))
  return [...list].sort((a, b) => {
    const ia = order.get(a.ref.kind) ?? 99
    const ib = order.get(b.ref.kind) ?? 99
    return ia - ib
  })
}

function boostCandidatesByKeywords(
  map: Map<string, AiLinkCandidateEntry>,
  cap: number,
  exclude: Set<string>,
  keywords: string[],
  centerIso: string
): void {
  if (keywords.length === 0 || map.size >= cap) return
  const db = getDb()
  const { start, end } = dateWindow(centerIso)
  const patterns = keywords.slice(0, 8).map((k) => `%${k.toLowerCase()}%`)
  const whereKw = patterns.map(() => 'LOWER(COALESCE(subject,"")) LIKE ?').join(' OR ')
  const limit = Math.min(cap - map.size, 15)
  const mails = db
    .prepare(
      `SELECT id, subject, from_addr, from_name, received_at
       FROM messages
       WHERE received_at >= ? AND received_at <= ? AND (${whereKw})
       ORDER BY received_at DESC
       LIMIT ?`
    )
    .all(start, end, ...patterns, limit) as Array<{
    id: number
    subject: string | null
    from_addr: string | null
    from_name: string | null
    received_at: string | null
  }>
  for (const m of mails) {
    const ref: ChronellEntityRef = { kind: 'mail', messageId: m.id }
    const key = entityRefKey(ref)
    if (exclude.has(key)) continue
    pushCandidate(map, cap, {
      ref,
      snapshot: {
        id: key,
        kind: 'mail',
        fields: {
          subject: m.subject,
          from_addr: m.from_addr,
          from_name: m.from_name,
          received_at: m.received_at
        }
      },
      title: m.subject?.trim() || '(Kein Betreff)',
      subtitle: m.from_name?.trim() || m.from_addr?.trim() || null
    })
    exclude.add(key)
  }
}

export function retrieveAiLinkCandidates(
  anchor: ChronellEntityRef,
  maxCandidates = 40,
  options?: AiLinkRetrievalOptions
): AiLinkRetrievalResult | null {
  const anchorSnap = buildAnchorSnapshot(anchor)
  if (!anchorSnap) return null

  const cap = Math.min(Math.max(maxCandidates, 10), 50)
  const db = getDb()
  const centerIso = anchorReferenceIso(anchor)
  const { start, end } = dateWindow(centerIso)
  const exclude = new Set<string>([entityRefKey(anchor)])
  const map = new Map<string, AiLinkCandidateEntry>()

  function normalizeEmail(raw: string): string {
    const trimmed = raw.trim()
    const angle = trimmed.match(/<([^>]+)>/)
    return (angle ? angle[1]! : trimmed).trim().toLowerCase()
  }

  const anchorEmail =
    anchorSnap.kind === 'mail' || anchorSnap.kind === 'mail_todo'
      ? normalizeEmail(String(anchorSnap.fields.from_addr ?? ''))
      : anchorSnap.kind === 'people_contact'
        ? normalizeEmail(String(anchorSnap.fields.primary_email ?? ''))
        : ''
  const anchorDomain = extractEmailDomain(anchorEmail)
  const domainKeywords = options?.subjectKeywords ?? []
  const relaxDomain = domainKeywords.length > 0
  const tokens =
    anchorSnap.kind === 'mail' || anchorSnap.kind === 'mail_todo'
      ? subjectTokens(String(anchorSnap.fields.subject ?? ''))
      : anchorSnap.kind === 'calendar_event'
        ? subjectTokens(String(anchorSnap.fields.title ?? ''))
        : anchorSnap.kind === 'note'
          ? subjectTokens(String(anchorSnap.fields.title ?? ''))
          : []

  // Nachbarn im Graph (1 Hop)
  for (const link of listEntityLinksForAnchor(anchor)) {
    if (map.size >= cap) break
    const peer = link.peer
    const key = entityRefKey(peer)
    if (exclude.has(key)) continue
    const snap = buildAnchorSnapshot(peer)
    if (!snap) continue
    pushCandidate(map, cap, {
      ref: peer,
      snapshot: snap,
      title: link.title,
      subtitle: link.subtitle
    })
    exclude.add(key)
  }

  // Mails im Zeitfenster
  const mails = db
    .prepare(
      `SELECT id, subject, from_addr, from_name, received_at
       FROM messages
       WHERE received_at >= ? AND received_at <= ?
       ORDER BY ABS(julianday(COALESCE(received_at,'')) - julianday(?)) ASC
       LIMIT ?`
    )
    .all(start, end, centerIso, cap) as Array<{
    id: number
    subject: string | null
    from_addr: string | null
    from_name: string | null
    received_at: string | null
  }>
  for (const m of mails) {
    const ref: ChronellEntityRef = { kind: 'mail', messageId: m.id }
    const key = entityRefKey(ref)
    if (exclude.has(key)) continue
    if (!relaxDomain && anchorDomain) {
      const domain = extractEmailDomain(m.from_addr)
      if (domain && domain !== anchorDomain) continue
    }
    pushCandidate(map, cap, {
      ref,
      snapshot: {
        id: key,
        kind: 'mail',
        fields: {
          subject: m.subject,
          from_addr: m.from_addr,
          from_name: m.from_name,
          received_at: m.received_at
        }
      },
      title: m.subject?.trim() || '(Kein Betreff)',
      subtitle: m.from_name?.trim() || m.from_addr?.trim() || null
    })
    exclude.add(key)
  }

  // Kalender im Zeitfenster (+ Betreff-Overlap)
  const calLimit = Math.min(cap, 20)
  const calPattern =
    tokens.length > 0 ? `%${tokens[0]!.toLowerCase()}%` : null
  const events = db
    .prepare(
      calPattern
        ? `SELECT account_id, graph_event_id, title, start_iso, end_iso, location, graph_calendar_id
           FROM calendar_events
           WHERE start_iso < ? AND end_iso > ?
             AND (LOWER(COALESCE(title,'')) LIKE ? OR start_iso >= ?)
           ORDER BY ABS(julianday(COALESCE(start_iso,'')) - julianday(?)) ASC
           LIMIT ?`
        : `SELECT account_id, graph_event_id, title, start_iso, end_iso, location, graph_calendar_id
           FROM calendar_events
           WHERE start_iso < ? AND end_iso > ?
           ORDER BY ABS(julianday(COALESCE(start_iso,'')) - julianday(?)) ASC
           LIMIT ?`
    )
    .all(
      ...(calPattern
        ? [end, start, calPattern, start, centerIso, calLimit]
        : [end, start, centerIso, calLimit])
    ) as Array<{
    account_id: string
    graph_event_id: string
    title: string | null
    start_iso: string | null
    end_iso: string | null
    location: string | null
    graph_calendar_id: string | null
  }>
  for (const ev of events) {
    const ref: ChronellEntityRef = {
      kind: 'calendar_event',
      accountId: ev.account_id,
      graphEventId: ev.graph_event_id
    }
    const key = entityRefKey(ref)
    if (exclude.has(key)) continue
    pushCandidate(map, cap, {
      ref,
      snapshot: {
        id: key,
        kind: 'calendar_event',
        fields: {
          title: ev.title,
          start_iso: ev.start_iso,
          end_iso: ev.end_iso,
          location: ev.location,
          graph_calendar_id: ev.graph_calendar_id
        }
      },
      title: ev.title?.trim() || 'Termin',
      subtitle: ev.start_iso?.slice(0, 16) ?? null
    })
    exclude.add(key)
  }

  // Kontakte (Domain oder exakte E-Mail)
  if (anchorDomain || anchorEmail.includes('@')) {
    const contacts = db
      .prepare(
        anchorEmail.includes('@')
          ? `SELECT id, display_name, primary_email, company FROM people_contacts
             WHERE LOWER(COALESCE(primary_email,'')) = ? COLLATE NOCASE
                OR LOWER(COALESCE(primary_email,'')) LIKE ?
             LIMIT ?`
          : `SELECT id, display_name, primary_email, company FROM people_contacts
             WHERE LOWER(COALESCE(primary_email,'')) LIKE ?
             LIMIT ?`
      )
      .all(
        ...(anchorEmail.includes('@')
          ? [anchorEmail, `%@${anchorDomain ?? ''}`, 8]
          : [`%@${anchorDomain}`, 8])
      ) as Array<{
      id: number
      display_name: string | null
      primary_email: string | null
      company: string | null
    }>
    for (const c of contacts) {
      const ref: ChronellEntityRef = { kind: 'people_contact', contactId: c.id }
      const key = entityRefKey(ref)
      if (exclude.has(key)) continue
      const name =
        c.display_name?.trim() || c.primary_email?.trim() || 'Kontakt'
      pushCandidate(map, cap, {
        ref,
        snapshot: {
          id: key,
          kind: 'people_contact',
          fields: {
            display_name: c.display_name,
            primary_email: c.primary_email,
            company: c.company
          }
        },
        title: name,
        subtitle: c.company?.trim() || c.primary_email?.trim() || null
      })
      exclude.add(key)
    }
  }

  // Notizen (Zeitfenster / Titel)
  const notes = db
    .prepare(
      `SELECT id, title, kind, updated_at FROM user_notes
       WHERE updated_at >= ? AND updated_at <= ?
       ORDER BY updated_at DESC LIMIT ?`
    )
    .all(start, end, 8) as Array<{
    id: number
    title: string | null
    kind: string | null
    updated_at: string | null
  }>
  for (const n of notes) {
    const ref: ChronellEntityRef = { kind: 'note', noteId: n.id }
    const key = entityRefKey(ref)
    if (exclude.has(key)) continue
    pushCandidate(map, cap, {
      ref,
      snapshot: {
        id: key,
        kind: 'note',
        fields: { title: n.title, kind: n.kind, updated_at: n.updated_at }
      },
      title: n.title?.trim() || 'Ohne Titel',
      subtitle: n.kind
    })
    exclude.add(key)
  }

  // Cloud-Aufgaben im Fenster
  const tasks = db
    .prepare(
      `SELECT account_id, list_id, task_id, title, due_iso FROM cloud_tasks
       WHERE completed = 0
         AND (due_iso IS NULL OR (due_iso >= ? AND due_iso <= ?))
       ORDER BY ABS(julianday(COALESCE(due_iso, datetime('now'))) - julianday(?)) ASC
       LIMIT ?`
    )
    .all(start, end, centerIso, 10) as Array<{
    account_id: string
    list_id: string
    task_id: string
    title: string | null
    due_iso: string | null
  }>
  for (const t of tasks) {
    const ref: ChronellEntityRef = {
      kind: 'cloud_task',
      accountId: t.account_id,
      listId: t.list_id,
      taskId: t.task_id
    }
    const key = entityRefKey(ref)
    if (exclude.has(key)) continue
    pushCandidate(map, cap, {
      ref,
      snapshot: {
        id: key,
        kind: 'cloud_task',
        fields: { title: t.title, due_iso: t.due_iso, list_id: t.list_id }
      },
      title: t.title?.trim() || 'Aufgabe',
      subtitle: t.due_iso?.slice(0, 16) ?? null
    })
    exclude.add(key)
  }

  if (domainKeywords.length > 0) {
    boostCandidatesByKeywords(map, cap, exclude, domainKeywords, centerIso)
  }

  const sorted = sortCandidatesByKindBoost(reindexCandidates(map), options?.kindBoost)
  return {
    anchor: anchorSnap,
    candidates: sorted.map((c, i) => ({ ...c, candId: `cand_${i + 1}` }))
  }
}

export function candidatesToTargetList(
  entries: AiLinkCandidateEntry[]
): EntityLinkTargetCandidate[] {
  return entries.map((e) => ({
    target: e.ref,
    title: e.title,
    subtitle: e.subtitle
  }))
}

export function buildCandidateIdMap(
  entries: AiLinkCandidateEntry[]
): Map<string, AiLinkCandidateEntry> {
  const out = new Map<string, AiLinkCandidateEntry>()
  for (const e of entries) {
    out.set(e.candId, e)
  }
  return out
}

export function retrievalCacheKey(
  anchor: ChronellEntityRef,
  candidates: AiLinkCandidateEntry[],
  model: string,
  provider: string
): string {
  const parts = [
    entityRefKey(anchor),
    provider,
    model,
    candidates.map((c) => c.candId + ':' + entityRefKey(c.ref)).join('|')
  ]
  return parts.join('#')
}
