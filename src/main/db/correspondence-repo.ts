import { normalizeMailSenderEmail } from '@shared/mail-sender-email'
import { addressLineContainsEmail } from '@shared/mail-correspondent'
import type { ListCorrespondenceInput, MailCorrespondenceItem } from '@shared/types'
import { getDb } from './index'
import { hasMessageParticipantsIndex } from './message-participants-repo'
import { rowToListItem, type MessageRow } from './messages-repo-core'

const CORRESPONDENCE_LIST_COLUMNS_M = `
  m.id, m.account_id, m.folder_id, m.thread_id, m.remote_id, m.remote_thread_id,
  m.subject, m.from_addr, m.from_name, m.to_addrs, m.cc_addrs, m.snippet,
  NULL as body_html, NULL as body_text,
  m.sent_at, m.received_at, m.is_read, m.is_flagged, m.has_attachments, m.importance,
  m.snoozed_until, m.waiting_for_reply_until, m.list_unsubscribe, m.list_unsubscribe_post
`

function resolveAccountOwnerEmailSet(args: ListCorrespondenceInput): Set<string> {
  const seen = new Set<string>()
  for (const raw of args.accountOwnerEmails ?? []) {
    const norm = normalizeMailSenderEmail(raw)
    if (norm) seen.add(norm)
  }
  return seen
}

function correspondenceIsFromMe(
  row: MessageRow,
  folderWellKnown: string | null,
  accountOwnerEmails: Set<string>
): boolean {
  const fromNorm = normalizeMailSenderEmail(row.from_addr)
  if (fromNorm && accountOwnerEmails.has(fromNorm)) return true
  const wk = folderWellKnown?.toLowerCase() ?? ''
  return wk === 'sentitems' || wk === 'drafts'
}

function resolveCorrespondenceEmails(args: ListCorrespondenceInput): string[] {
  const fromList = (args.emails ?? [])
    .map((e) => normalizeMailSenderEmail(e))
    .filter((e): e is string => Boolean(e))
  const primary = normalizeMailSenderEmail(args.email)
  const seen = new Set(fromList)
  if (primary) seen.add(primary)
  return [...seen]
}

function resolveAccountIds(args: ListCorrespondenceInput): string[] {
  if (args.accountIds && args.accountIds.length > 0) {
    return [...new Set(args.accountIds.map((a) => a.trim()).filter(Boolean))]
  }
  const single = args.accountId?.trim()
  return single ? [single] : []
}

function folderExcludeSql(exclude: boolean): string {
  if (!exclude) return ''
  return `AND (
    m.folder_id IS NULL
    OR f.id IS NULL
    OR LOWER(COALESCE(f.well_known, '')) NOT IN ('deleteditems', 'junkemail')
  )`
}

function mapCorrespondenceRows(
  rows: Array<MessageRow & { folder_well_known: string | null }>,
  accountOwnerEmails: Set<string>,
  filterEmails: string[]
): MailCorrespondenceItem[] {
  const out: MailCorrespondenceItem[] = []
  for (const r of rows) {
    if (
      filterEmails.length > 0 &&
      !filterEmails.some(
        (email) =>
          addressLineContainsEmail(r.from_addr, email) ||
          addressLineContainsEmail(r.to_addrs, email) ||
          addressLineContainsEmail(r.cc_addrs, email)
      )
    ) {
      continue
    }
    const folderWellKnown = r.folder_well_known
    out.push({
      ...rowToListItem(r),
      isFromMe: correspondenceIsFromMe(r, folderWellKnown, accountOwnerEmails),
      folderWellKnown
    })
  }
  return out
}

function listCorrespondenceViaParticipantsIndex(
  accountOwnerEmails: Set<string>,
  emails: string[],
  accountIds: string[],
  limit: number,
  offset: number,
  exclude: boolean
): MailCorrespondenceItem[] {
  const emailPh = emails.map(() => '?').join(', ')
  const accountPh = accountIds.map(() => '?').join(', ')
  const rows = getDb()
    .prepare(
      `SELECT DISTINCT ${CORRESPONDENCE_LIST_COLUMNS_M},
              f.well_known as folder_well_known
       FROM messages m
       INNER JOIN message_participants mp ON mp.message_id = m.id
       LEFT JOIN folders f ON f.id = m.folder_id
       WHERE mp.account_id IN (${accountPh})
         AND mp.email IN (${emailPh})
         ${folderExcludeSql(exclude)}
       ORDER BY COALESCE(m.received_at, m.sent_at) DESC NULLS LAST, m.id DESC
       LIMIT ? OFFSET ?`
    )
    .all(...accountIds, ...emails, limit, offset) as Array<
      MessageRow & { folder_well_known: string | null }
    >
  return mapCorrespondenceRows(rows, accountOwnerEmails, emails)
}

function countCorrespondenceViaParticipantsIndex(
  emails: string[],
  accountIds: string[],
  exclude: boolean
): number {
  const emailPh = emails.map(() => '?').join(', ')
  const accountPh = accountIds.map(() => '?').join(', ')
  const row = getDb()
    .prepare(
      `SELECT COUNT(DISTINCT m.id) as c
       FROM messages m
       INNER JOIN message_participants mp ON mp.message_id = m.id
       LEFT JOIN folders f ON f.id = m.folder_id
       WHERE mp.account_id IN (${accountPh})
         AND mp.email IN (${emailPh})
         ${folderExcludeSql(exclude)}`
    )
    .get(...accountIds, ...emails) as { c: number }
  return row?.c ?? 0
}

function listCorrespondenceViaLikeFallback(
  accountOwnerEmails: Set<string>,
  emails: string[],
  accountIds: string[],
  limit: number,
  offset: number,
  exclude: boolean
): MailCorrespondenceItem[] {
  const accountPh = accountIds.map(() => '?').join(', ')
  const orParts: string[] = []
  const params: unknown[] = [...accountIds]
  for (const email of emails) {
    const needle = `%${email.replace(/%/g, '').replace(/_/g, '')}%`
    orParts.push(
      `(m.from_addr IS NOT NULL AND lower(m.from_addr) LIKE ?)
       OR (m.to_addrs IS NOT NULL AND lower(m.to_addrs) LIKE ?)
       OR (m.cc_addrs IS NOT NULL AND lower(m.cc_addrs) LIKE ?)`
    )
    params.push(needle, needle, needle)
  }
  params.push(limit, offset)
  const rows = getDb()
    .prepare(
      `SELECT ${CORRESPONDENCE_LIST_COLUMNS_M},
              f.well_known as folder_well_known
       FROM messages m
       LEFT JOIN folders f ON f.id = m.folder_id
       WHERE m.account_id IN (${accountPh})
         AND (${orParts.join(' OR ')})
         ${folderExcludeSql(exclude)}
       ORDER BY COALESCE(m.received_at, m.sent_at) DESC NULLS LAST, m.id DESC
       LIMIT ? OFFSET ?`
    )
    .all(...params) as Array<MessageRow & { folder_well_known: string | null }>
  return mapCorrespondenceRows(rows, accountOwnerEmails, emails)
}

function countCorrespondenceViaLikeFallback(
  emails: string[],
  accountIds: string[],
  exclude: boolean
): number {
  const accountPh = accountIds.map(() => '?').join(', ')
  const emailClauses: string[] = []
  const params: unknown[] = [...accountIds]
  for (const email of emails) {
    const needle = `%${email.replace(/%/g, '').replace(/_/g, '')}%`
    emailClauses.push(
      `((m.from_addr IS NOT NULL AND lower(m.from_addr) LIKE ?)
        OR (m.to_addrs IS NOT NULL AND lower(m.to_addrs) LIKE ?)
        OR (m.cc_addrs IS NOT NULL AND lower(m.cc_addrs) LIKE ?))`
    )
    params.push(needle, needle, needle)
  }
  const row = getDb()
    .prepare(
      `SELECT COUNT(DISTINCT m.id) as c
       FROM messages m
       LEFT JOIN folders f ON f.id = m.folder_id
       WHERE m.account_id IN (${accountPh})
         AND (${emailClauses.join(' OR ')})
         ${folderExcludeSql(exclude)}`
    )
    .get(...params) as { c: number }
  return row?.c ?? 0
}

export function listCorrespondenceMessages(args: ListCorrespondenceInput): MailCorrespondenceItem[] {
  const emails = resolveCorrespondenceEmails(args)
  const accountIds = resolveAccountIds(args)
  if (emails.length === 0 || accountIds.length === 0) return []

  const limit = Math.min(Math.max(Math.floor(args.limit ?? 100), 1), 500)
  const offset = Math.max(Math.floor(args.offset ?? 0), 0)
  const exclude = args.excludeDeletedJunk !== false
  const accountOwnerEmails = resolveAccountOwnerEmailSet(args)

  if (hasMessageParticipantsIndex()) {
    return listCorrespondenceViaParticipantsIndex(
      accountOwnerEmails,
      emails,
      accountIds,
      limit,
      offset,
      exclude
    )
  }
  return listCorrespondenceViaLikeFallback(
    accountOwnerEmails,
    emails,
    accountIds,
    limit,
    offset,
    exclude
  )
}

export function countCorrespondenceMessages(args: ListCorrespondenceInput): number {
  const emails = resolveCorrespondenceEmails(args)
  const accountIds = resolveAccountIds(args)
  if (emails.length === 0 || accountIds.length === 0) return 0
  const exclude = args.excludeDeletedJunk !== false

  if (hasMessageParticipantsIndex()) {
    return countCorrespondenceViaParticipantsIndex(emails, accountIds, exclude)
  }
  return countCorrespondenceViaLikeFallback(emails, accountIds, exclude)
}
