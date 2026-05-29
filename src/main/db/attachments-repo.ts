import { normalizeMailSenderEmail } from '@shared/mail-sender-email'
import type { FilesListMailQuery, FilesMailSortBy, MailFileIndexRow } from '@shared/files'
import {
  matchesFilesMailCategory,
  type FilesMailCategory
} from '@shared/attachment-category'
import { MIN_MAIL_ATTACHMENT_SIZE_BYTES } from '@shared/mail-attachment-filter'
import { getDb } from './index'
import { hasMessageParticipantsIndex } from './message-participants-repo'

interface AttachmentRow {
  id: number
  message_id: number
  remote_id: string | null
  name: string
  mime: string | null
  size: number | null
  is_inline: number
  account_id: string | null
  received_at: string | null
  subject: string | null
  from_addr: string | null
}

function rowToMailFile(r: AttachmentRow): MailFileIndexRow {
  return {
    id: r.id,
    messageId: r.message_id,
    accountId: r.account_id ?? '',
    remoteAttachmentId: r.remote_id ?? '',
    name: r.name,
    mime: r.mime,
    size: r.size,
    receivedAt: r.received_at,
    subject: r.subject ?? '',
    fromAddr: r.from_addr,
    elementType: 'email'
  }
}

const REAL_ATTACHMENT_SQL = `(a.is_inline = 0 AND (a.size IS NULL OR a.size >= ${MIN_MAIL_ATTACHMENT_SIZE_BYTES}))`

export function countMessagesNeedingAttachmentIndex(): number {
  const row = getDb()
    .prepare(
      `SELECT COUNT(*) as c FROM messages m
       WHERE m.has_attachments = 1
         AND m.attachments_indexed_at IS NULL
         AND m.remote_id IS NOT NULL AND trim(m.remote_id) != ''`
    )
    .get() as { c: number }
  return row.c
}

export function listMessageIdsNeedingAttachmentIndex(limit: number): number[] {
  const cap = Math.min(Math.max(Math.floor(limit), 1), 20)
  const rows = getDb()
    .prepare(
      `SELECT m.id FROM messages m
       WHERE m.has_attachments = 1
         AND m.attachments_indexed_at IS NULL
         AND m.remote_id IS NOT NULL AND trim(m.remote_id) != ''
       ORDER BY m.received_at DESC NULLS LAST, m.id DESC
       LIMIT ?`
    )
    .all(cap) as Array<{ id: number }>
  return rows.map((r) => r.id)
}

export function isMessageAttachmentsIndexed(messageId: number): boolean {
  const row = getDb()
    .prepare('SELECT attachments_indexed_at FROM messages WHERE id = ?')
    .get(messageId) as { attachments_indexed_at: string | null } | undefined
  return Boolean(row?.attachments_indexed_at)
}

export function markMessageAttachmentsIndexed(messageId: number): void {
  getDb()
    .prepare(`UPDATE messages SET attachments_indexed_at = datetime('now') WHERE id = ?`)
    .run(messageId)
}

export function clearMessageAttachmentsIndexed(messageId: number): void {
  getDb()
    .prepare(`UPDATE messages SET attachments_indexed_at = NULL WHERE id = ?`)
    .run(messageId)
}

export interface AttachmentUpsertInput {
  remoteId: string
  name: string
  mime: string | null
  size: number | null
  contentId: string | null
  isInline: boolean
  accountId: string
  receivedAt: string | null
  subject: string
  fromAddr: string | null
}

export function replaceMessageAttachments(
  messageId: number,
  rows: AttachmentUpsertInput[]
): void {
  const db = getDb()
  const del = db.prepare('DELETE FROM attachments WHERE message_id = ?')
  const ins = db.prepare(
    `INSERT INTO attachments (
       message_id, remote_id, name, mime, size, content_id, is_inline,
       account_id, received_at, subject, from_addr
     ) VALUES (
       @messageId, @remoteId, @name, @mime, @size, @contentId, @isInline,
       @accountId, @receivedAt, @subject, @fromAddr
     )`
  )
  const txn = db.transaction(() => {
    del.run(messageId)
    for (const r of rows) {
      ins.run({
        messageId,
        remoteId: r.remoteId,
        name: r.name,
        mime: r.mime,
        size: r.size,
        contentId: r.contentId,
        isInline: r.isInline ? 1 : 0,
        accountId: r.accountId,
        receivedAt: r.receivedAt,
        subject: r.subject,
        fromAddr: r.fromAddr
      })
    }
  })
  txn()
}

function sortColumn(sortBy: FilesMailSortBy): string {
  switch (sortBy) {
    case 'name':
      return 'a.name COLLATE NOCASE'
    case 'size':
      return 'a.size'
    case 'subject':
      return 'a.subject COLLATE NOCASE'
    case 'receivedAt':
    default:
      return 'a.received_at'
  }
}

function categorySqlCondition(category: FilesMailCategory): string | null {
  switch (category) {
    case 'images':
      return `lower(coalesce(a.mime, '')) LIKE 'image/%'`
    case 'media':
      return `(lower(coalesce(a.mime, '')) LIKE 'video/%' OR lower(coalesce(a.mime, '')) LIKE 'audio/%')`
    case 'documents':
      return `(
        lower(coalesce(a.mime, '')) = 'application/pdf'
        OR lower(coalesce(a.mime, '')) LIKE 'text/%'
        OR lower(coalesce(a.mime, '')) LIKE '%word%'
        OR lower(coalesce(a.mime, '')) LIKE '%excel%'
        OR lower(coalesce(a.mime, '')) LIKE '%spreadsheet%'
        OR lower(coalesce(a.mime, '')) LIKE '%powerpoint%'
        OR lower(coalesce(a.mime, '')) LIKE '%presentation%'
        OR lower(a.name) LIKE '%.pdf'
        OR lower(a.name) LIKE '%.doc%'
        OR lower(a.name) LIKE '%.xls%'
        OR lower(a.name) LIKE '%.ppt%'
        OR lower(a.name) LIKE '%.odt'
        OR lower(a.name) LIKE '%.ods'
        OR lower(a.name) LIKE '%.odp'
        OR lower(a.name) LIKE '%.txt'
        OR lower(a.name) LIKE '%.csv'
        OR lower(a.name) LIKE '%.md'
        OR lower(a.name) LIKE '%.rtf'
      )`
    case 'archive':
      return `(
        lower(coalesce(a.mime, '')) LIKE '%zip%'
        OR lower(coalesce(a.mime, '')) LIKE '%rar%'
        OR lower(coalesce(a.mime, '')) LIKE '%7z%'
        OR lower(coalesce(a.mime, '')) LIKE '%tar%'
        OR lower(a.name) LIKE '%.zip'
        OR lower(a.name) LIKE '%.rar'
        OR lower(a.name) LIKE '%.7z'
        OR lower(a.name) LIKE '%.tar'
        OR lower(a.name) LIKE '%.gz'
      )`
  }
  return null
}

function buildListQuery(
  query: FilesListMailQuery
): { sql: string; params: unknown[]; category: FilesMailCategory } {
  const category = query.category ?? 'all'
  const sortBy = query.sortBy ?? 'receivedAt'
  const sortDir = query.sortDir === 'asc' ? 'ASC' : 'DESC'
  const conditions = [REAL_ATTACHMENT_SQL]
  const params: unknown[] = []

  const catSql = categorySqlCondition(category)
  if (catSql) conditions.push(catSql)

  if (query.accountIds && query.accountIds.length > 0) {
    const placeholders = query.accountIds.map(() => '?').join(', ')
    conditions.push(`a.account_id IN (${placeholders})`)
    params.push(...query.accountIds)
  }

  const search = query.search?.trim()
  if (search) {
    conditions.push(`(a.name LIKE ? COLLATE NOCASE OR a.subject LIKE ? COLLATE NOCASE)`)
    const like = `%${search}%`
    params.push(like, like)
  }

  const contactEmails = [
    ...new Set(
      [
        ...(query.contactEmails ?? []),
        ...(query.contactEmail ? [query.contactEmail] : [])
      ]
        .map((e) => normalizeMailSenderEmail(e))
        .filter((e): e is string => Boolean(e))
    )
  ]
  if (contactEmails.length > 0) {
    const excludeJunk = query.excludeDeletedJunk !== false
    const folderExclude = excludeJunk
      ? `AND (
           m.folder_id IS NULL
           OR f.id IS NULL
           OR LOWER(COALESCE(f.well_known, '')) NOT IN ('deleteditems', 'junkemail')
         )`
      : ''
    const emailPh = contactEmails.map(() => '?').join(', ')
    if (hasMessageParticipantsIndex()) {
      conditions.push(
        `EXISTS (
           SELECT 1 FROM message_participants mp
           INNER JOIN messages m ON m.id = mp.message_id
           LEFT JOIN folders f ON f.id = m.folder_id
           WHERE mp.message_id = a.message_id
             AND mp.email IN (${emailPh})
             ${folderExclude}
         )`
      )
      params.push(...contactEmails)
    } else {
      const orParts: string[] = []
      for (const email of contactEmails) {
        const needle = `%${email.replace(/%/g, '').replace(/_/g, '')}%`
        orParts.push(
          `((m.from_addr IS NOT NULL AND lower(m.from_addr) LIKE ?)
            OR (m.to_addrs IS NOT NULL AND lower(m.to_addrs) LIKE ?)
            OR (m.cc_addrs IS NOT NULL AND lower(m.cc_addrs) LIKE ?))`
        )
        params.push(needle, needle, needle)
      }
      conditions.push(
        `EXISTS (
           SELECT 1 FROM messages m
           LEFT JOIN folders f ON f.id = m.folder_id
           WHERE m.id = a.message_id
             AND (${orParts.join(' OR ')})
             ${folderExclude}
         )`
      )
    }
  }

  const where = conditions.join(' AND ')
  const order = `${sortColumn(sortBy)} ${sortDir}, a.id ${sortDir}`
  const baseFrom = `FROM attachments a WHERE ${where}`

  return {
    category,
    sql: `SELECT a.* ${baseFrom} ORDER BY ${order}`,
    params
  }
}

export function listMailFiles(query: FilesListMailQuery): MailFileIndexRow[] {
  const limit = Math.min(Math.max(query.limit ?? 500, 1), 2000)
  const offset = Math.max(query.offset ?? 0, 0)
  const { sql, params, category } = buildListQuery(query)
  const rows = getDb()
    .prepare(`${sql} LIMIT ? OFFSET ?`)
    .all(...params, limit, offset) as AttachmentRow[]

  const mapped = rows.map(rowToMailFile)
  if (category === 'all') return mapped
  return mapped.filter((r) => matchesFilesMailCategory(category, r.mime, r.name))
}

export function countMailFiles(query: FilesListMailQuery): number {
  const { sql, params } = buildListQuery(query)
  const countSql = sql.replace('SELECT a.*', 'SELECT COUNT(*) as c').replace(/ ORDER BY .+$/i, '')
  const row = getDb().prepare(countSql).get(...params) as { c: number }
  return row.c
}

export function getMailFileById(id: number): MailFileIndexRow | null {
  const row = getDb()
    .prepare(`SELECT a.* FROM attachments a WHERE a.id = ? AND ${REAL_ATTACHMENT_SQL}`)
    .get(id) as AttachmentRow | undefined
  return row ? rowToMailFile(row) : null
}
