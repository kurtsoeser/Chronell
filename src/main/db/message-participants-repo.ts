import { collectMessageParticipantEmails } from '@shared/mail-participants'
import { getDb } from './index'

const BACKFILL_BATCH = 400

export function hasMessageParticipantsIndex(): boolean {
  const row = getDb()
    .prepare('SELECT 1 as ok FROM message_participants LIMIT 1')
    .get() as { ok: number } | undefined
  return row?.ok === 1
}

export function countMessagesNeedingParticipantBackfill(): number {
  const row = getDb()
    .prepare(
      `SELECT COUNT(*) as c FROM messages m
       WHERE NOT EXISTS (
         SELECT 1 FROM message_participants mp WHERE mp.message_id = m.id
       )`
    )
    .get() as { c: number }
  return row?.c ?? 0
}

export function replaceMessageParticipants(
  messageId: number,
  accountId: string,
  emails: string[]
): void {
  const db = getDb()
  const del = db.prepare('DELETE FROM message_participants WHERE message_id = ?')
  const ins = db.prepare(
    `INSERT OR IGNORE INTO message_participants (message_id, account_id, email)
     VALUES (?, ?, ?)`
  )
  const txn = db.transaction(() => {
    del.run(messageId)
    for (const email of emails) {
      ins.run(messageId, accountId, email)
    }
  })
  txn()
}

export function syncParticipantsForMessageRow(row: {
  id: number
  account_id: string
  from_addr: string | null
  to_addrs: string | null
  cc_addrs: string | null
  bcc_addrs?: string | null
}): void {
  const emails = collectMessageParticipantEmails({
    fromAddr: row.from_addr,
    toAddrs: row.to_addrs,
    ccAddrs: row.cc_addrs,
    bccAddrs: row.bcc_addrs
  })
  replaceMessageParticipants(row.id, row.account_id, emails)
}

export function syncParticipantsAfterUpsert(accountId: string, remoteIds: string[]): void {
  const ids = [...new Set(remoteIds.filter((r) => r.trim().length > 0))]
  if (ids.length === 0) return
  const db = getDb()
  const placeholders = ids.map(() => '?').join(', ')
  const rows = db
    .prepare(
      `SELECT id, account_id, from_addr, to_addrs, cc_addrs, bcc_addrs
       FROM messages
       WHERE account_id = ? AND remote_id IN (${placeholders})`
    )
    .all(accountId, ...ids) as Array<{
    id: number
    account_id: string
    from_addr: string | null
    to_addrs: string | null
    cc_addrs: string | null
    bcc_addrs: string | null
  }>
  const txn = db.transaction(() => {
    for (const row of rows) {
      syncParticipantsForMessageRow(row)
    }
  })
  txn()
}

export function backfillMessageParticipantsBatch(limit: number): number {
  const cap = Math.min(Math.max(Math.floor(limit), 1), BACKFILL_BATCH)
  const db = getDb()
  const rows = db
    .prepare(
      `SELECT m.id, m.account_id, m.from_addr, m.to_addrs, m.cc_addrs, m.bcc_addrs
       FROM messages m
       WHERE NOT EXISTS (
         SELECT 1 FROM message_participants mp WHERE mp.message_id = m.id
       )
       ORDER BY m.id ASC
       LIMIT ?`
    )
    .all(cap) as Array<{
    id: number
    account_id: string
    from_addr: string | null
    to_addrs: string | null
    cc_addrs: string | null
    bcc_addrs: string | null
  }>
  if (rows.length === 0) return 0
  const txn = db.transaction(() => {
    for (const row of rows) {
      syncParticipantsForMessageRow(row)
    }
  })
  txn()
  return rows.length
}

let backfillScheduled = false

/** Hintergrund-Backfill nach Schema-Migration (blockiert UI nicht). */
export function scheduleMessageParticipantsBackfillIfNeeded(): void {
  if (backfillScheduled) return
  const pending = countMessagesNeedingParticipantBackfill()
  if (pending === 0) return
  backfillScheduled = true
  setImmediate(() => {
    void runMessageParticipantsBackfillLoop()
  })
}

async function runMessageParticipantsBackfillLoop(): Promise<void> {
  try {
    let total = 0
    for (;;) {
      const n = backfillMessageParticipantsBatch(BACKFILL_BATCH)
      total += n
      if (n < BACKFILL_BATCH) break
      await new Promise<void>((resolve) => setImmediate(resolve))
    }
    if (total > 0) {
      console.log(`[message-participants] Backfill abgeschlossen: ${total} Mails indexiert`)
    }
  } catch (e) {
    console.warn('[message-participants] Backfill fehlgeschlagen:', e)
  } finally {
    backfillScheduled = false
  }
}
