import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getDb } from '../db'
import { sanitizeFileName } from '../ipc/ipc-helpers'

export const NOTE_ATTACHMENTS_BUCKET = 'chronell-note-attachments'

interface AttachmentRow {
  id: number
  note_id: number
  kind: string
  name: string
  local_path: string | null
  storage_path: string | null
  content_type: string | null
}

function storageObjectPath(userId: string, noteId: number, attachmentId: number, fileName: string): string {
  return `${userId}/${noteId}/${attachmentId}/${sanitizeFileName(fileName)}`
}

export async function pushLocalNoteAttachmentsToCloud(
  client: SupabaseClient,
  userId: string
): Promise<number> {
  const rows = getDb()
    .prepare(
      `SELECT id, note_id, kind, name, local_path, storage_path, content_type
       FROM user_note_attachments
       WHERE kind = 'local' AND local_path IS NOT NULL AND local_path != ''`
    )
    .all() as AttachmentRow[]

  let uploaded = 0
  const updateStmt = getDb().prepare(
    'UPDATE user_note_attachments SET storage_path = ? WHERE id = ?'
  )

  for (const row of rows) {
    if (row.storage_path?.startsWith(`${userId}/`)) continue
    if (!row.local_path) continue
    try {
      const bytes = await readFile(row.local_path)
      const objectPath = storageObjectPath(userId, row.note_id, row.id, row.name)
      const { error } = await client.storage.from(NOTE_ATTACHMENTS_BUCKET).upload(objectPath, bytes, {
        upsert: true,
        contentType: row.content_type ?? 'application/octet-stream'
      })
      if (error) {
        console.warn('[profile-sync] attachment upload failed:', objectPath, error.message)
        continue
      }
      updateStmt.run(objectPath, row.id)
      uploaded++
    } catch (e) {
      console.warn('[profile-sync] attachment read/upload:', row.id, e)
    }
  }
  return uploaded
}

export async function pullNoteAttachmentsFromCloud(
  client: SupabaseClient,
  userId: string
): Promise<number> {
  const rows = getDb()
    .prepare(
      `SELECT id, note_id, kind, name, local_path, storage_path, content_type
       FROM user_note_attachments
       WHERE kind = 'local' AND storage_path IS NOT NULL AND storage_path != ''`
    )
    .all() as AttachmentRow[]

  let downloaded = 0
  const updatePathStmt = getDb().prepare(
    'UPDATE user_note_attachments SET local_path = ?, size = ? WHERE id = ?'
  )

  for (const row of rows) {
    if (!row.storage_path?.startsWith(`${userId}/`)) continue
    try {
      const { data, error } = await client.storage
        .from(NOTE_ATTACHMENTS_BUCKET)
        .download(row.storage_path)
      if (error || !data) {
        console.warn('[profile-sync] attachment download failed:', row.storage_path, error?.message)
        continue
      }
      const buffer = Buffer.from(await data.arrayBuffer())
      const localPath =
        row.local_path ??
        (await defaultLocalPathForAttachment(row.note_id, row.id, row.name))
      await mkdir(dirname(localPath), { recursive: true })
      await writeFile(localPath, buffer)
      updatePathStmt.run(localPath, buffer.length, row.id)
      downloaded++
    } catch (e) {
      console.warn('[profile-sync] attachment download:', row.storage_path, e)
    }
  }
  return downloaded
}

async function defaultLocalPathForAttachment(
  noteId: number,
  attachmentId: number,
  name: string
): Promise<string> {
  const { app } = await import('electron')
  const path = await import('node:path')
  const dir = path.join(app.getPath('userData'), 'note-attachments', String(noteId))
  await mkdir(dir, { recursive: true })
  return path.join(dir, `${attachmentId}-${sanitizeFileName(name)}`)
}
