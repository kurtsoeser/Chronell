import { getDb } from './index'
import {
  canonicalEntityRefPair,
  entityRefKey,
  entityRefsEqual,
  isSelfEntityLink,
  type ChronellEntityRef,
  type EntityRefKind
} from '@shared/entity-ref'
import type {
  EntityGraphEdge,
  EntityGraphNode,
  EntityGraphSnapshot,
  EntityLinkedItem,
  EntityLinkPathResult
} from '@shared/entity-links'
import { formatCalendarEventWhenLabel, formatDueIsoWhenLabel } from '@shared/calendar-datetime'
import {
  getAppDisplayLocaleCode,
  getCalendarDisplayTimeZoneSync
} from '../calendar-display-config'
import { resolveEntityGraphLayoutMeta } from './entity-graph-layout-meta'

export interface EntityLinkRow {
  id: number
  ref_a_key: string
  ref_b_key: string
  a_kind: EntityRefKind
  a_note_id: number | null
  a_mail_message_id: number | null
  a_mail_todo_id: number | null
  a_calendar_account_id: string | null
  a_calendar_graph_event_id: string | null
  a_task_account_id: string | null
  a_task_list_id: string | null
  a_task_id: string | null
  a_people_contact_id: number | null
  b_kind: EntityRefKind
  b_note_id: number | null
  b_mail_message_id: number | null
  b_mail_todo_id: number | null
  b_calendar_account_id: string | null
  b_calendar_graph_event_id: string | null
  b_task_account_id: string | null
  b_task_list_id: string | null
  b_task_id: string | null
  b_people_contact_id: number | null
  link_kind: string | null
  created_at: string
}

const SELECT_ENTITY_LINK = `
  SELECT id, ref_a_key, ref_b_key,
         a_kind, a_note_id, a_mail_message_id, a_mail_todo_id,
         a_calendar_account_id, a_calendar_graph_event_id,
         a_task_account_id, a_task_list_id, a_task_id, a_people_contact_id,
         b_kind, b_note_id, b_mail_message_id, b_mail_todo_id,
         b_calendar_account_id, b_calendar_graph_event_id,
         b_task_account_id, b_task_list_id, b_task_id, b_people_contact_id,
         link_kind, created_at
  FROM entity_links
`

function assertPositiveId(id: number, label: string): void {
  if (!Number.isFinite(id) || id <= 0) throw new Error(`${label} fehlt.`)
}

export function rowSideToRef(row: EntityLinkRow, side: 'a' | 'b'): ChronellEntityRef {
  const kind = side === 'a' ? row.a_kind : row.b_kind
  switch (kind) {
    case 'note':
      return { kind: 'note', noteId: (side === 'a' ? row.a_note_id : row.b_note_id)! }
    case 'mail':
      return {
        kind: 'mail',
        messageId: (side === 'a' ? row.a_mail_message_id : row.b_mail_message_id)!
      }
    case 'mail_todo':
      return {
        kind: 'mail_todo',
        todoId: (side === 'a' ? row.a_mail_todo_id : row.b_mail_todo_id)!
      }
    case 'calendar_event':
      return {
        kind: 'calendar_event',
        accountId: (side === 'a' ? row.a_calendar_account_id : row.b_calendar_account_id)!,
        graphEventId: (side === 'a' ? row.a_calendar_graph_event_id : row.b_calendar_graph_event_id)!
      }
    case 'cloud_task':
      return {
        kind: 'cloud_task',
        accountId: (side === 'a' ? row.a_task_account_id : row.b_task_account_id)!,
        listId: (side === 'a' ? row.a_task_list_id : row.b_task_list_id)!,
        taskId: (side === 'a' ? row.a_task_id : row.b_task_id)!
      }
    case 'people_contact':
      return {
        kind: 'people_contact',
        contactId: (side === 'a' ? row.a_people_contact_id : row.b_people_contact_id)!
      }
    default:
      throw new Error(`Unbekannter Verknuepfungstyp: ${kind}`)
  }
}

function peerRefForAnchor(row: EntityLinkRow, anchorKey: string): ChronellEntityRef {
  if (row.ref_a_key === anchorKey) return rowSideToRef(row, 'b')
  return rowSideToRef(row, 'a')
}

function refToInsertColumns(ref: ChronellEntityRef, prefix: 'a' | 'b'): Record<string, string | number | null> {
  const base: Record<string, string | number | null> = {
    [`${prefix}_kind`]: ref.kind,
    [`${prefix}_note_id`]: null,
    [`${prefix}_mail_message_id`]: null,
    [`${prefix}_mail_todo_id`]: null,
    [`${prefix}_calendar_account_id`]: null,
    [`${prefix}_calendar_graph_event_id`]: null,
    [`${prefix}_task_account_id`]: null,
    [`${prefix}_task_list_id`]: null,
    [`${prefix}_task_id`]: null,
    [`${prefix}_people_contact_id`]: null
  }
  switch (ref.kind) {
    case 'note':
      base[`${prefix}_note_id`] = ref.noteId
      break
    case 'mail':
      base[`${prefix}_mail_message_id`] = ref.messageId
      break
    case 'mail_todo':
      base[`${prefix}_mail_todo_id`] = ref.todoId
      break
    case 'calendar_event':
      base[`${prefix}_calendar_account_id`] = ref.accountId.trim()
      base[`${prefix}_calendar_graph_event_id`] = ref.graphEventId.trim()
      break
    case 'cloud_task':
      base[`${prefix}_task_account_id`] = ref.accountId.trim()
      base[`${prefix}_task_list_id`] = ref.listId.trim()
      base[`${prefix}_task_id`] = ref.taskId.trim()
      break
    case 'people_contact':
      base[`${prefix}_people_contact_id`] = ref.contactId
      break
    default:
      break
  }
  return base
}

export function entityRefExists(ref: ChronellEntityRef): boolean {
  try {
    assertEntityRefExists(ref)
    return true
  } catch {
    return false
  }
}

export function assertEntityRefExists(ref: ChronellEntityRef): void {
  const db = getDb()
  switch (ref.kind) {
    case 'note': {
      assertPositiveId(ref.noteId, 'Notiz-ID')
      if (!db.prepare('SELECT 1 FROM user_notes WHERE id = ?').get(ref.noteId)) {
        throw new Error('Notiz nicht gefunden.')
      }
      break
    }
    case 'mail': {
      assertPositiveId(ref.messageId, 'Mail-ID')
      if (!db.prepare('SELECT 1 FROM messages WHERE id = ?').get(ref.messageId)) {
        throw new Error('E-Mail nicht gefunden.')
      }
      break
    }
    case 'mail_todo': {
      assertPositiveId(ref.todoId, 'Mail-ToDo-ID')
      if (!db.prepare('SELECT 1 FROM todos WHERE id = ?').get(ref.todoId)) {
        throw new Error('Mail-ToDo nicht gefunden.')
      }
      break
    }
    case 'calendar_event': {
      const accountId = ref.accountId?.trim()
      const graphEventId = ref.graphEventId?.trim()
      if (!accountId || !graphEventId) throw new Error('Termin-Referenz unvollstaendig.')
      if (
        !db
          .prepare(
            `SELECT 1 FROM calendar_events WHERE account_id = ? AND graph_event_id = ?`
          )
          .get(accountId, graphEventId)
      ) {
        throw new Error('Termin nicht im Cache.')
      }
      break
    }
    case 'cloud_task': {
      const accountId = ref.accountId?.trim()
      const listId = ref.listId?.trim()
      const taskId = ref.taskId?.trim()
      if (!accountId || !listId || !taskId) throw new Error('Aufgaben-Referenz unvollstaendig.')
      if (
        !db
          .prepare(
            `SELECT 1 FROM cloud_tasks WHERE account_id = ? AND list_id = ? AND task_id = ?`
          )
          .get(accountId, listId, taskId)
      ) {
        throw new Error('Aufgabe nicht im Cache.')
      }
      break
    }
    case 'people_contact': {
      assertPositiveId(ref.contactId, 'Kontakt-ID')
      if (!db.prepare('SELECT 1 FROM people_contacts WHERE id = ?').get(ref.contactId)) {
        throw new Error('Kontakt nicht gefunden.')
      }
      break
    }
    default:
      throw new Error('Unbekannter Verknuepfungstyp.')
  }
}

export function resolveEntityRefTitleSubtitle(
  ref: ChronellEntityRef
): { title: string; subtitle: string | null } {
  const db = getDb()
  switch (ref.kind) {
    case 'note': {
      const n = db
        .prepare('SELECT title, kind FROM user_notes WHERE id = ?')
        .get(ref.noteId) as { title: string | null; kind: string } | undefined
      return {
        title: n?.title?.trim() || 'Ohne Titel',
        subtitle: n?.kind ?? 'standalone'
      }
    }
    case 'mail': {
      const m = db
        .prepare('SELECT subject, from_name, from_addr FROM messages WHERE id = ?')
        .get(ref.messageId) as
        | { subject: string | null; from_name: string | null; from_addr: string | null }
        | undefined
      return {
        title: m?.subject?.trim() || '(Kein Betreff)',
        subtitle: m?.from_name?.trim() || m?.from_addr?.trim() || null
      }
    }
    case 'mail_todo': {
      const row = db
        .prepare(
          `SELECT t.due_kind, t.due_at, m.subject, m.from_name, m.from_addr
           FROM todos t
           JOIN messages m ON m.id = t.message_id
           WHERE t.id = ?`
        )
        .get(ref.todoId) as
        | {
            due_kind: string
            due_at: string | null
            subject: string | null
            from_name: string | null
            from_addr: string | null
          }
        | undefined
      const tz = getCalendarDisplayTimeZoneSync()
      const loc = getAppDisplayLocaleCode()
      const dueLabel = row?.due_at
        ? formatDueIsoWhenLabel(row.due_at, tz, loc)
        : null
      return {
        title: row?.subject?.trim() || '(Kein Betreff)',
        subtitle:
          dueLabel ??
          row?.from_name?.trim() ??
          row?.from_addr?.trim() ??
          row?.due_kind ??
          null
      }
    }
    case 'calendar_event': {
      const ev = db
        .prepare(
          `SELECT title, start_iso, is_all_day FROM calendar_events
           WHERE account_id = ? AND graph_event_id = ?`
        )
        .get(ref.accountId, ref.graphEventId) as
        | { title: string | null; start_iso: string | null; is_all_day: number | null }
        | undefined
      const startIso = ev?.start_iso?.trim() ?? ''
      const subtitle = startIso
        ? formatCalendarEventWhenLabel(
            startIso,
            getCalendarDisplayTimeZoneSync(),
            getAppDisplayLocaleCode(),
            Boolean(ev?.is_all_day)
          )
        : null
      return {
        title: ev?.title?.trim() || 'Termin',
        subtitle
      }
    }
    case 'cloud_task': {
      const t = db
        .prepare(
          `SELECT title, due_iso FROM cloud_tasks
           WHERE account_id = ? AND list_id = ? AND task_id = ?`
        )
        .get(ref.accountId, ref.listId, ref.taskId) as
        | { title: string; due_iso: string | null }
        | undefined
      const dueIso = t?.due_iso?.trim() ?? ''
      return {
        title: t?.title?.trim() || 'Aufgabe',
        subtitle: dueIso
          ? formatDueIsoWhenLabel(
              dueIso,
              getCalendarDisplayTimeZoneSync(),
              getAppDisplayLocaleCode()
            )
          : null
      }
    }
    case 'people_contact': {
      const c = db
        .prepare(
          `SELECT display_name, given_name, surname, primary_email, company
           FROM people_contacts WHERE id = ?`
        )
        .get(ref.contactId) as
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

export function resolveGraphClusterKey(ref: ChronellEntityRef): string {
  const db = getDb()
  switch (ref.kind) {
    case 'mail': {
      const row = db
        .prepare('SELECT account_id FROM messages WHERE id = ?')
        .get(ref.messageId) as { account_id: string } | undefined
      return row?.account_id ? `account:${row.account_id}` : 'scope:mail'
    }
    case 'mail_todo': {
      const row = db
        .prepare('SELECT account_id FROM todos WHERE id = ?')
        .get(ref.todoId) as { account_id: string } | undefined
      return row?.account_id ? `account:${row.account_id}` : 'scope:mail'
    }
    case 'calendar_event':
      return ref.accountId?.trim() ? `account:${ref.accountId.trim()}` : 'scope:calendar'
    case 'cloud_task':
      return ref.accountId?.trim() ? `account:${ref.accountId.trim()}` : 'scope:tasks'
    case 'people_contact': {
      const row = db
        .prepare('SELECT account_id FROM people_contacts WHERE id = ?')
        .get(ref.contactId) as { account_id: string | null } | undefined
      return row?.account_id?.trim()
        ? `account:${row.account_id.trim()}`
        : 'scope:contacts'
    }
    case 'note':
      return 'scope:notes'
    default:
      return 'scope:other'
  }
}

function mapRowToLinkedItem(row: EntityLinkRow, anchorKey: string): EntityLinkedItem {
  const peer = peerRefForAnchor(row, anchorKey)
  const { title, subtitle } = resolveEntityRefTitleSubtitle(peer)
  return {
    linkId: row.id,
    peer,
    title,
    subtitle,
    createdAt: row.created_at,
    linkKind: row.link_kind
  }
}

export function listEntityLinksForAnchor(anchor: ChronellEntityRef): EntityLinkedItem[] {
  const anchorKey = entityRefKey(anchor)
  const rows = getDb()
    .prepare(
      `${SELECT_ENTITY_LINK}
       WHERE ref_a_key = ? OR ref_b_key = ?
       ORDER BY created_at ASC, id ASC`
    )
    .all(anchorKey, anchorKey) as EntityLinkRow[]
  return rows.map((row) => mapRowToLinkedItem(row, anchorKey))
}

export function addEntityLink(
  a: ChronellEntityRef,
  b: ChronellEntityRef,
  linkKind: string | null = 'related'
): number {
  if (isSelfEntityLink(a, b)) {
    throw new Error('Ein Objekt kann nicht mit sich selbst verknuepft werden.')
  }
  assertEntityRefExists(a)
  assertEntityRefExists(b)

  const [refA, refB] = canonicalEntityRefPair(a, b)
  const keyA = entityRefKey(refA)
  const keyB = entityRefKey(refB)

  const db = getDb()
  const existing = db
    .prepare('SELECT id FROM entity_links WHERE ref_a_key = ? AND ref_b_key = ?')
    .get(keyA, keyB) as { id: number } | undefined
  if (existing) return existing.id

  const cols = {
    ref_a_key: keyA,
    ref_b_key: keyB,
    link_kind: linkKind,
    ...refToInsertColumns(refA, 'a'),
    ...refToInsertColumns(refB, 'b')
  }

  const result = db
    .prepare(
      `INSERT INTO entity_links (
         ref_a_key, ref_b_key,
         a_kind, a_note_id, a_mail_message_id, a_mail_todo_id,
         a_calendar_account_id, a_calendar_graph_event_id,
         a_task_account_id, a_task_list_id, a_task_id, a_people_contact_id,
         b_kind, b_note_id, b_mail_message_id, b_mail_todo_id,
         b_calendar_account_id, b_calendar_graph_event_id,
         b_task_account_id, b_task_list_id, b_task_id, b_people_contact_id,
         link_kind, created_at
       ) VALUES (
         @ref_a_key, @ref_b_key,
         @a_kind, @a_note_id, @a_mail_message_id, @a_mail_todo_id,
         @a_calendar_account_id, @a_calendar_graph_event_id,
         @a_task_account_id, @a_task_list_id, @a_task_id, @a_people_contact_id,
         @b_kind, @b_note_id, @b_mail_message_id, @b_mail_todo_id,
         @b_calendar_account_id, @b_calendar_graph_event_id,
         @b_task_account_id, @b_task_list_id, @b_task_id, @b_people_contact_id,
         @link_kind, datetime('now')
       )`
    )
    .run(cols)

  return Number(result.lastInsertRowid)
}

export function removeEntityLink(linkId: number): void {
  assertPositiveId(linkId, 'Verknuepfungs-ID')
  getDb().prepare('DELETE FROM entity_links WHERE id = ?').run(linkId)
}

export function removeEntityLinkIfMatches(linkId: number, anchor: ChronellEntityRef): void {
  assertPositiveId(linkId, 'Verknuepfungs-ID')
  const anchorKey = entityRefKey(anchor)
  getDb()
    .prepare(
      `DELETE FROM entity_links
       WHERE id = ? AND (ref_a_key = ? OR ref_b_key = ?)`
    )
    .run(linkId, anchorKey, anchorKey)
}

export function deleteAllEntityLinksForRef(ref: ChronellEntityRef): void {
  const key = entityRefKey(ref)
  getDb()
    .prepare('DELETE FROM entity_links WHERE ref_a_key = ? OR ref_b_key = ?')
    .run(key, key)
}

export function findEntityLinkId(a: ChronellEntityRef, b: ChronellEntityRef): number | null {
  const [refA, refB] = canonicalEntityRefPair(a, b)
  const row = getDb()
    .prepare('SELECT id FROM entity_links WHERE ref_a_key = ? AND ref_b_key = ?')
    .get(entityRefKey(refA), entityRefKey(refB)) as { id: number } | undefined
  return row?.id ?? null
}

export function entityLinkExists(a: ChronellEntityRef, b: ChronellEntityRef): boolean {
  return findEntityLinkId(a, b) != null
}

export function listAllEntityLinkRows(): EntityLinkRow[] {
  return getDb().prepare(`${SELECT_ENTITY_LINK} ORDER BY id`).all() as EntityLinkRow[]
}

/**
 * Ersetzt `from` in allen Verknuepfungen durch `to` (Peers bleiben erhalten).
 * Bestehende Paare werden per addEntityLink dedupliziert.
 */
export function rewireEntityLinks(from: ChronellEntityRef, to: ChronellEntityRef): number {
  if (entityRefsEqual(from, to)) return 0
  const fromKey = entityRefKey(from)
  const rows = getDb()
    .prepare(
      `${SELECT_ENTITY_LINK}
       WHERE ref_a_key = ? OR ref_b_key = ?
       ORDER BY id ASC`
    )
    .all(fromKey, fromKey) as EntityLinkRow[]

  let rewired = 0
  for (const row of rows) {
    const peer = peerRefForAnchor(row, fromKey)
    const linkKind = row.link_kind
    removeEntityLink(row.id)
    if (isSelfEntityLink(to, peer)) continue
    try {
      addEntityLink(to, peer, linkKind)
      rewired++
    } catch {
      /* Peer evtl. geloescht */
    }
  }
  return rewired
}

interface AdjacencyEdge {
  neighborKey: string
  linkId: number
  linkKind: string | null
}

function buildEntityRefKeyMap(): Map<string, ChronellEntityRef> {
  const map = new Map<string, ChronellEntityRef>()
  for (const row of listAllEntityLinkRows()) {
    try {
      const a = rowSideToRef(row, 'a')
      const b = rowSideToRef(row, 'b')
      if (entityRefExists(a)) map.set(entityRefKey(a), a)
      if (entityRefExists(b)) map.set(entityRefKey(b), b)
    } catch {
      /* verwaist */
    }
  }
  return map
}

function buildEntityLinksAdjacency(): Map<string, AdjacencyEdge[]> {
  const adj = new Map<string, AdjacencyEdge[]>()
  const add = (fromKey: string, toKey: string, linkId: number, linkKind: string | null): void => {
    const list = adj.get(fromKey) ?? []
    list.push({ neighborKey: toKey, linkId, linkKind })
    adj.set(fromKey, list)
  }
  for (const row of listAllEntityLinkRows()) {
    try {
      const a = rowSideToRef(row, 'a')
      const b = rowSideToRef(row, 'b')
      if (!entityRefExists(a) || !entityRefExists(b)) continue
      const aKey = entityRefKey(a)
      const bKey = entityRefKey(b)
      add(aKey, bKey, row.id, row.link_kind)
      add(bKey, aKey, row.id, row.link_kind)
    } catch {
      /* verwaist */
    }
  }
  return adj
}

function ensureGraphNode(nodeByKey: Map<string, EntityGraphNode>, ref: ChronellEntityRef): void {
  const key = entityRefKey(ref)
  if (nodeByKey.has(key)) return
  if (!entityRefExists(ref)) return
  const { title, subtitle } = resolveEntityRefTitleSubtitle(ref)
  const clusterKey = resolveGraphClusterKey(ref)
  const layout = resolveEntityGraphLayoutMeta(ref, clusterKey, getDb())
  nodeByKey.set(key, {
    key,
    ref,
    kind: ref.kind,
    title,
    subtitle,
    clusterKey,
    ...layout
  })
}

/** Subgraph um einen Anker (BFS bis `maxDepth` Hops). */
export function buildNeighborhoodSnapshot(
  anchor: ChronellEntityRef,
  maxDepth = 1
): EntityGraphSnapshot {
  if (!entityRefExists(anchor)) return { nodes: [], edges: [] }
  const depth = Math.max(0, Math.min(4, Math.floor(maxDepth)))
  const anchorKey = entityRefKey(anchor)
  const adj = buildEntityLinksAdjacency()

  const nodeKeys = new Set<string>([anchorKey])
  let frontier = new Set<string>([anchorKey])
  for (let d = 0; d < depth; d++) {
    const next = new Set<string>()
    for (const key of frontier) {
      for (const { neighborKey } of adj.get(key) ?? []) {
        if (!nodeKeys.has(neighborKey)) {
          nodeKeys.add(neighborKey)
          next.add(neighborKey)
        }
      }
    }
    frontier = next
    if (frontier.size === 0) break
  }

  const refByKey = buildEntityRefKeyMap()
  const nodeByKey = new Map<string, EntityGraphNode>()
  ensureGraphNode(nodeByKey, anchor)
  for (const key of nodeKeys) {
    const ref = key === anchorKey ? anchor : refByKey.get(key)
    if (ref) ensureGraphNode(nodeByKey, ref)
  }

  const edges: EntityGraphEdge[] = []
  const seenEdge = new Set<number>()
  for (const row of listAllEntityLinkRows()) {
    try {
      const a = rowSideToRef(row, 'a')
      const b = rowSideToRef(row, 'b')
      const aKey = entityRefKey(a)
      const bKey = entityRefKey(b)
      if (!nodeKeys.has(aKey) || !nodeKeys.has(bKey)) continue
      if (seenEdge.has(row.id)) continue
      seenEdge.add(row.id)
      ensureGraphNode(nodeByKey, a)
      ensureGraphNode(nodeByKey, b)
      edges.push({
        linkId: row.id,
        aKey,
        bKey,
        linkKind: row.link_kind
      })
    } catch {
      /* */
    }
  }

  const nodes = [...nodeByKey.values()].sort((x, y) =>
    x.title.localeCompare(y.title, undefined, { sensitivity: 'base' })
  )
  return { nodes, edges }
}

/** Kürzester Pfad zwischen zwei Objekten (ungerichtet). */
export function findEntityLinkPath(
  from: ChronellEntityRef,
  to: ChronellEntityRef,
  maxHops = 12
): EntityLinkPathResult | null {
  if (!entityRefExists(from) || !entityRefExists(to)) return null
  const fromKey = entityRefKey(from)
  const toKey = entityRefKey(to)
  if (fromKey === toKey) return null

  const limit = Math.max(1, Math.min(24, Math.floor(maxHops)))
  const adj = buildEntityLinksAdjacency()

  const queue: string[] = [fromKey]
  const visited = new Set<string>([fromKey])
  const depthByKey = new Map<string, number>([[fromKey, 0]])
  const parent = new Map<string, { prevKey: string; linkId: number }>()
  let found = false

  while (queue.length > 0) {
    const key = queue.shift()!
    if (key === toKey) {
      found = true
      break
    }
    const depth = depthByKey.get(key) ?? 0
    if (depth >= limit) continue
    for (const { neighborKey, linkId } of adj.get(key) ?? []) {
      if (visited.has(neighborKey)) continue
      visited.add(neighborKey)
      parent.set(neighborKey, { prevKey: key, linkId })
      depthByKey.set(neighborKey, depth + 1)
      queue.push(neighborKey)
    }
  }

  if (!found) return null

  const pathKeys: string[] = []
  const pathEdgeIds: number[] = []
  let cur: string | undefined = toKey
  while (cur) {
    pathKeys.unshift(cur)
    const p = parent.get(cur)
    if (!p) break
    pathEdgeIds.unshift(p.linkId)
    cur = p.prevKey
  }

  const refByKey = buildEntityRefKeyMap()
  const nodeByKey = new Map<string, EntityGraphNode>()
  for (const key of pathKeys) {
    const ref =
      key === fromKey ? from : key === toKey ? to : refByKey.get(key)
    if (ref) ensureGraphNode(nodeByKey, ref)
  }

  const edgeIdSet = new Set(pathEdgeIds)
  const edges: EntityGraphEdge[] = []
  for (const row of listAllEntityLinkRows()) {
    if (!edgeIdSet.has(row.id)) continue
    try {
      const a = rowSideToRef(row, 'a')
      const b = rowSideToRef(row, 'b')
      edges.push({
        linkId: row.id,
        aKey: entityRefKey(a),
        bKey: entityRefKey(b),
        linkKind: row.link_kind
      })
    } catch {
      /* */
    }
  }

  const nodes = pathKeys
    .map((k) => nodeByKey.get(k))
    .filter((n): n is EntityGraphNode => Boolean(n))

  if (nodes.length < 2) return null
  return { nodes, edges }
}

export function buildEntityLinksGraph(): EntityGraphSnapshot {
  const rows = listAllEntityLinkRows()
  const nodeByKey = new Map<string, EntityGraphNode>()

  const edges: EntityGraphEdge[] = []
  for (const row of rows) {
    try {
      const a = rowSideToRef(row, 'a')
      const b = rowSideToRef(row, 'b')
      if (!entityRefExists(a) || !entityRefExists(b)) continue
      ensureGraphNode(nodeByKey, a)
      ensureGraphNode(nodeByKey, b)
      edges.push({
        linkId: row.id,
        aKey: entityRefKey(a),
        bKey: entityRefKey(b),
        linkKind: row.link_kind
      })
    } catch {
      /* verwaist */
    }
  }

  const nodes = [...nodeByKey.values()].sort((x, y) =>
    x.title.localeCompare(y.title, undefined, { sensitivity: 'base' })
  )
  if (rows.length > 0 && edges.length === 0) {
    console.warn(
      `[db] entity_links graph: ${rows.length} Eintraege in DB, aber keine gueltigen Kanten (Ziele fehlen?)`
    )
  }
  return { nodes, edges }
}

export function listEntityLinksBetween(a: ChronellEntityRef, b: ChronellEntityRef): EntityLinkedItem[] {
  const anchorKey = entityRefKey(a)
  const peerKey = entityRefKey(b)
  const rows = getDb()
    .prepare(
      `${SELECT_ENTITY_LINK}
       WHERE (ref_a_key = ? AND ref_b_key = ?) OR (ref_a_key = ? AND ref_b_key = ?)`
    )
    .all(anchorKey, peerKey, peerKey, anchorKey) as EntityLinkRow[]
  return rows.map((row) => mapRowToLinkedItem(row, anchorKey))
}

/** Entfernt Verknuepfungen, deren Endpunkt nicht mehr in der DB existiert. */
export function purgeOrphanedEntityLinks(): number {
  const rows = listAllEntityLinkRows()
  let removed = 0
  for (const row of rows) {
    try {
      const a = rowSideToRef(row, 'a')
      const b = rowSideToRef(row, 'b')
      if (!entityRefExists(a) || !entityRefExists(b)) {
        removeEntityLink(row.id)
        removed++
      }
    } catch {
      removeEntityLink(row.id)
      removed++
    }
  }
  if (removed > 0) {
    console.log(`[db] entity_links: ${removed} verwaiste Verbindungen entfernt`)
  }
  return removed
}

export function getMailTodoMessageId(todoId: number): number | null {
  assertPositiveId(todoId, 'Mail-ToDo-ID')
  const row = getDb()
    .prepare('SELECT message_id FROM todos WHERE id = ?')
    .get(todoId) as { message_id: number } | undefined
  return row?.message_id ?? null
}

export function noteEntityRef(noteId: number): ChronellEntityRef {
  return { kind: 'note', noteId }
}

export function mailEntityRef(messageId: number): ChronellEntityRef {
  return { kind: 'mail', messageId }
}

export function mailTodoEntityRef(todoId: number): ChronellEntityRef {
  return { kind: 'mail_todo', todoId }
}

export function cloudTaskEntityRef(
  accountId: string,
  listId: string,
  taskId: string
): ChronellEntityRef {
  return {
    kind: 'cloud_task',
    accountId: accountId.trim(),
    listId: listId.trim(),
    taskId: taskId.trim()
  }
}

export { entityRefsEqual }
