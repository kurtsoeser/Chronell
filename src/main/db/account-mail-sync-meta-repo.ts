import { BrowserWindow } from 'electron'
import { getDb } from './index'

function broadcastMailSyncMetaChanged(accountId: string): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('mail:sync-meta-changed', { accountId })
  }
}

export interface AccountMailSyncMeta {
  accountId: string
  lastSyncFinishedAt: string | null
  lastSyncError: string | null
  /** Fallback: letzte lokale Aktualisierung aus Ordnern/Nachrichten. */
  lastActivityAt: string | null
}

export function touchAccountMailSyncFinished(accountId: string): void {
  const db = getDb()
  const now = new Date().toISOString()
  db.prepare(
    `INSERT INTO account_mail_sync_meta (account_id, last_finished_at, last_error)
     VALUES (?, ?, NULL)
     ON CONFLICT(account_id) DO UPDATE SET
       last_finished_at = excluded.last_finished_at,
       last_error = NULL`
  ).run(accountId, now)
  broadcastMailSyncMetaChanged(accountId)
}

export function touchAccountMailSyncError(accountId: string, error: string): void {
  const db = getDb()
  db.prepare(
    `INSERT INTO account_mail_sync_meta (account_id, last_finished_at, last_error)
     VALUES (?, NULL, ?)
     ON CONFLICT(account_id) DO UPDATE SET last_error = excluded.last_error`
  ).run(accountId, error.slice(0, 500))
  broadcastMailSyncMetaChanged(accountId)
}

function lastActivityAtForAccount(accountId: string): string | null {
  const db = getDb()
  const row = db
    .prepare(
      `SELECT MAX(ts) as m FROM (
         SELECT MAX(last_synced_at) AS ts FROM messages WHERE account_id = ?
         UNION ALL
         SELECT MAX(last_synced_at) AS ts FROM folders WHERE account_id = ?
       )`
    )
    .get(accountId, accountId) as { m: string | null } | undefined
  return row?.m ?? null
}

export function listAccountMailSyncMeta(): AccountMailSyncMeta[] {
  const db = getDb()
  const metaRows = db
    .prepare(`SELECT account_id, last_finished_at, last_error FROM account_mail_sync_meta`)
    .all() as Array<{ account_id: string; last_finished_at: string | null; last_error: string | null }>
  const metaByAccount = new Map(metaRows.map((r) => [r.account_id, r]))

  const accountIds = db
    .prepare(`SELECT DISTINCT account_id FROM folders`)
    .all() as Array<{ account_id: string }>

  const seen = new Set<string>()
  const out: AccountMailSyncMeta[] = []

  for (const row of metaRows) {
    seen.add(row.account_id)
    out.push({
      accountId: row.account_id,
      lastSyncFinishedAt: row.last_finished_at,
      lastSyncError: row.last_error,
      lastActivityAt: lastActivityAtForAccount(row.account_id)
    })
  }

  for (const { account_id } of accountIds) {
    if (seen.has(account_id)) continue
    seen.add(account_id)
    const m = metaByAccount.get(account_id)
    out.push({
      accountId: account_id,
      lastSyncFinishedAt: m?.last_finished_at ?? null,
      lastSyncError: m?.last_error ?? null,
      lastActivityAt: lastActivityAtForAccount(account_id)
    })
  }

  return out
}
