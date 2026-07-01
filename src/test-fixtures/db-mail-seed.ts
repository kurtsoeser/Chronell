import type Database from 'better-sqlite3'

export interface TestFolderSeed {
  id: number
  accountId: string
  wellKnown: string | null
  name: string
}

export interface TestMessageSeed {
  id: number
  accountId: string
  folderId: number
  subject: string
  isRead: boolean
  isFlagged: boolean
  hasAttachments: boolean
  fromAddr: string | null
}

export function insertTestFolder(
  db: Database.Database,
  input: {
    accountId: string
    remoteId: string
    name: string
    wellKnown?: string | null
  }
): TestFolderSeed {
  const res = db
    .prepare(
      `INSERT INTO folders (account_id, remote_id, name, well_known, is_favorite, unread_count, total_count)
       VALUES (?, ?, ?, ?, 0, 0, 0)`
    )
    .run(input.accountId, input.remoteId, input.name, input.wellKnown ?? null)
  return {
    id: Number(res.lastInsertRowid),
    accountId: input.accountId,
    wellKnown: input.wellKnown ?? null,
    name: input.name
  }
}

export function insertTestNote(
  db: Database.Database,
  input?: { title?: string; body?: string }
): number {
  const res = db
    .prepare(
      `INSERT INTO user_notes (kind, body, created_at, updated_at, title)
       VALUES ('standalone', ?, datetime('now'), datetime('now'), ?)`
    )
    .run(input?.body ?? '', input?.title ?? 'Test-Notiz')
  return Number(res.lastInsertRowid)
}

export function insertTestMessage(
  db: Database.Database,
  input: {
    accountId: string
    folderId: number
    remoteId: string
    subject: string
    isRead?: boolean
    isFlagged?: boolean
    hasAttachments?: boolean
    fromAddr?: string | null
    fromName?: string | null
    bodyText?: string | null
    receivedAt?: string
  }
): TestMessageSeed {
  const res = db
    .prepare(
      `INSERT INTO messages (
         account_id, folder_id, remote_id, subject, from_addr, from_name,
         body_text, is_read, is_flagged, has_attachments, received_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      input.accountId,
      input.folderId,
      input.remoteId,
      input.subject,
      input.fromAddr ?? null,
      input.fromName ?? null,
      input.bodyText ?? null,
      input.isRead ? 1 : 0,
      input.isFlagged ? 1 : 0,
      input.hasAttachments ? 1 : 0,
      input.receivedAt ?? '2026-01-15T10:00:00.000Z'
    )
  return {
    id: Number(res.lastInsertRowid),
    accountId: input.accountId,
    folderId: input.folderId,
    subject: input.subject,
    isRead: input.isRead ?? false,
    isFlagged: input.isFlagged ?? false,
    hasAttachments: input.hasAttachments ?? false,
    fromAddr: input.fromAddr ?? null
  }
}
