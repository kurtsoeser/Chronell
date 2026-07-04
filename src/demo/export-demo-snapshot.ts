import Database from 'better-sqlite3'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildDemoAccounts } from './seed-accounts'
import { buildDemoDatabase } from './build-demo-db'
import { seedDemoPackManifest } from './seed-content'

export interface DemoWebSnapshot {
  version: number
  builtAt: string
  scenario: string
  accounts: ReturnType<typeof buildDemoAccounts>
  messages: Array<{
    id: number
    accountId: string
    subject: string
    fromName: string
    fromAddr: string
    snippet: string
    isRead: boolean
    isFlagged: boolean
    hasAttachments: boolean
    importance: string
    receivedAt: string
    snoozedUntil: string | null
    waitingForReplyUntil: string | null
  }>
  calendarEvents: Array<{
    id: string
    accountId: string
    accountEmail: string
    colorClass: string
    title: string
    startIso: string
    endIso: string
    isAllDay: boolean
    location: string | null
    organizer: string | null
  }>
  cloudTasks: Array<{
    accountId: string
    listId: string
    listName: string
    taskId: string
    title: string
    completed: boolean
    dueIso: string | null
    notes: string | null
  }>
  graphNodes: Array<{
    id: string
    kind: string
    label: string
    sublabel?: string
    x: number
    y: number
  }>
  graphEdges: Array<{ from: string; to: string }>
}

function nodeId(kind: string, raw: string): string {
  return `${kind}:${raw}`
}

export function buildDemoWebSnapshot(): DemoWebSnapshot {
  const tmpDb = join(tmpdir(), `chronell-demo-snapshot-${process.pid}.db`)
  rmSync(tmpDb, { force: true })
  buildDemoDatabase(tmpDb)

  const db = new Database(tmpDb, { readonly: true })
  try {
    const messages = (
      db
        .prepare(
          `
        SELECT m.id, m.account_id, m.subject, m.from_name, m.from_addr, m.snippet,
               m.is_read, m.is_flagged, m.has_attachments, m.importance,
               m.received_at, m.snoozed_until, m.waiting_for_reply_until
        FROM messages m
        JOIN folders f ON f.id = m.folder_id
        WHERE f.well_known = 'inbox'
        ORDER BY m.received_at DESC
      `
        )
        .all() as Array<Record<string, unknown>>
    ).map((row) => ({
      id: row.id as number,
      accountId: row.account_id as string,
      subject: row.subject as string,
      fromName: (row.from_name as string) || (row.from_addr as string),
      fromAddr: row.from_addr as string,
      snippet: row.snippet as string,
      isRead: Boolean(row.is_read),
      isFlagged: Boolean(row.is_flagged),
      hasAttachments: Boolean(row.has_attachments),
      importance: (row.importance as string) || 'normal',
      receivedAt: row.received_at as string,
      snoozedUntil: (row.snoozed_until as string) || null,
      waitingForReplyUntil: (row.waiting_for_reply_until as string) || null
    }))

    const calendarEvents = (
      db
        .prepare(
          `
        SELECT id, account_id, account_email, account_color_class, title,
               start_iso, end_iso, is_all_day, location, organizer
        FROM calendar_events
        ORDER BY start_iso ASC
      `
        )
        .all() as Array<Record<string, unknown>>
    ).map((row) => ({
      id: row.id as string,
      accountId: row.account_id as string,
      accountEmail: row.account_email as string,
      colorClass: row.account_color_class as string,
      title: row.title as string,
      startIso: row.start_iso as string,
      endIso: row.end_iso as string,
      isAllDay: Boolean(row.is_all_day),
      location: (row.location as string) || null,
      organizer: (row.organizer as string) || null
    }))

    const listNames = new Map<string, string>()
    for (const row of db
      .prepare('SELECT account_id, list_id, name FROM task_lists')
      .all() as Array<{ account_id: string; list_id: string; name: string }>) {
      listNames.set(`${row.account_id}:${row.list_id}`, row.name)
    }

    const cloudTasks = (
      db
        .prepare(
          `
        SELECT account_id, list_id, task_id, title, completed, due_iso, notes
        FROM cloud_tasks
        ORDER BY completed ASC, due_iso ASC NULLS LAST, title ASC
      `
        )
        .all() as Array<Record<string, unknown>>
    ).map((row) => {
      const accountId = row.account_id as string
      const listId = row.list_id as string
      return {
        accountId,
        listId,
        listName: listNames.get(`${accountId}:${listId}`) || listId,
        taskId: row.task_id as string,
        title: row.title as string,
        completed: Boolean(row.completed),
        dueIso: (row.due_iso as string) || null,
        notes: (row.notes as string) || null
      }
    })

    const graphNodes: DemoWebSnapshot['graphNodes'] = []
    const graphEdges: DemoWebSnapshot['graphEdges'] = []
    const nodeIndex = new Map<string, number>()

    function ensureNode(id: string, kind: string, label: string, sublabel?: string): void {
      if (nodeIndex.has(id)) return
      const n = graphNodes.length
      nodeIndex.set(id, n)
      const col = n % 4
      const row = Math.floor(n / 4)
      graphNodes.push({
        id,
        kind,
        label,
        sublabel,
        x: 80 + col * 140,
        y: 60 + row * 90
      })
    }

    function addEdge(from: string, to: string): void {
      if (from === to) return
      graphEdges.push({ from, to })
    }

    const links = db.prepare(`
      SELECT a_kind, a_note_id, a_mail_message_id, a_calendar_graph_event_id,
             a_task_account_id, a_task_list_id, a_task_id, a_people_contact_id,
             b_kind, b_note_id, b_mail_message_id, b_calendar_graph_event_id,
             b_task_account_id, b_task_list_id, b_task_id, b_people_contact_id
      FROM entity_links
    `).all() as Array<Record<string, unknown>>

    const noteTitles = new Map<number, string>()
    for (const row of db
      .prepare('SELECT id, title FROM user_notes')
      .all() as Array<{ id: number; title: string }>) {
      noteTitles.set(row.id, row.title)
    }

    const contactNames = new Map<number, string>()
    for (const row of db
      .prepare('SELECT id, display_name FROM people_contacts')
      .all() as Array<{ id: number; display_name: string }>) {
      contactNames.set(row.id, row.display_name)
    }

    const mailSubjects = new Map<number, string>()
    for (const row of db
      .prepare('SELECT id, subject FROM messages')
      .all() as Array<{ id: number; subject: string }>) {
      mailSubjects.set(row.id, row.subject)
    }

    const eventTitles = new Map<string, string>()
    for (const ev of calendarEvents) {
      eventTitles.set(ev.id.split(':').slice(1).join(':'), ev.title)
    }

    const taskTitles = new Map<string, string>()
    for (const t of cloudTasks) {
      taskTitles.set(`${t.accountId}:${t.listId}:${t.taskId}`, t.title)
    }

    function resolveSide(
      prefix: 'a' | 'b',
      row: Record<string, unknown>
    ): { id: string; kind: string; label: string; sublabel?: string } | null {
      const kind = row[`${prefix}_kind`] as string
      if (kind === 'mail' && row[`${prefix}_mail_message_id`]) {
        const mid = row[`${prefix}_mail_message_id`] as number
        const subj = mailSubjects.get(mid) || `Mail #${mid}`
        return { id: nodeId('mail', String(mid)), kind: 'mail', label: subj.length > 36 ? `${subj.slice(0, 34)}…` : subj }
      }
      if (kind === 'note' && row[`${prefix}_note_id`]) {
        const nid = row[`${prefix}_note_id`] as number
        const title = noteTitles.get(nid) || `Notiz #${nid}`
        return { id: nodeId('note', String(nid)), kind: 'note', label: title }
      }
      if (kind === 'calendar_event' && row[`${prefix}_calendar_graph_event_id`]) {
        const eid = row[`${prefix}_calendar_graph_event_id`] as string
        const title = eventTitles.get(eid) || eid
        return { id: nodeId('event', eid), kind: 'calendar', label: title }
      }
      if (kind === 'cloud_task' && row[`${prefix}_task_id`]) {
        const aid = row[`${prefix}_task_account_id`] as string
        const lid = row[`${prefix}_task_list_id`] as string
        const tid = row[`${prefix}_task_id`] as string
        const key = `${aid}:${lid}:${tid}`
        const title = taskTitles.get(key) || tid
        return { id: nodeId('task', key), kind: 'task', label: title }
      }
      if (kind === 'people_contact' && row[`${prefix}_people_contact_id`]) {
        const cid = row[`${prefix}_people_contact_id`] as number
        const name = contactNames.get(cid) || `Kontakt #${cid}`
        return { id: nodeId('contact', String(cid)), kind: 'contact', label: name }
      }
      return null
    }

    for (const row of links) {
      const left = resolveSide('a', row)
      const right = resolveSide('b', row)
      if (!left || !right) continue
      ensureNode(left.id, left.kind, left.label, left.sublabel)
      ensureNode(right.id, right.kind, right.label, right.sublabel)
      addEdge(left.id, right.id)
    }

    // Layout: radial cluster for graph preview
    const centerX = 280
    const centerY = 200
    const radius = 150
    graphNodes.forEach((node, i) => {
      const angle = (i / Math.max(graphNodes.length, 1)) * Math.PI * 2 - Math.PI / 2
      node.x = Math.round(centerX + Math.cos(angle) * radius)
      node.y = Math.round(centerY + Math.sin(angle) * radius)
    })

    const manifest = seedDemoPackManifest()
    return {
      version: (manifest.version as number) || 3,
      builtAt: new Date().toISOString(),
      scenario: (manifest.scenario as string) || 'nordlicht-consulting',
      accounts: buildDemoAccounts(),
      messages,
      calendarEvents,
      cloudTasks,
      graphNodes,
      graphEdges
    }
  } finally {
    db.close()
    rmSync(tmpDb, { force: true })
  }
}

export function writeDemoWebSnapshot(outPath: string): DemoWebSnapshot {
  const snapshot = buildDemoWebSnapshot()
  mkdirSync(join(outPath, '..'), { recursive: true })
  writeFileSync(outPath, JSON.stringify(snapshot, null, 2), 'utf8')
  return snapshot
}
