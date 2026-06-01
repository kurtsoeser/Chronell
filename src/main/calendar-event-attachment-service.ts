import { shell } from 'electron'
import type {
  CalendarEventAttachmentActionInput,
  CalendarEventAttachmentMeta,
  CalendarListEventAttachmentsInput,
  ComposeAttachment,
  ComposeReferenceAttachment
} from '@shared/types'
import { listAccounts } from './accounts'
import {
  downloadGraphEventAttachment,
  graphAddEventAttachments,
  listGraphEventAttachments
} from './graph/calendar-event-attachments'
import {
  downloadGoogleEventAttachment,
  googleAddEventAttachments,
  listGoogleEventAttachments
} from './google/calendar-google-attachments'
import { writeAttachmentCacheFile } from './attachment-cache'
import { sanitizeFileName } from './ipc/ipc-helpers'

export async function listCalendarEventAttachments(
  input: CalendarListEventAttachmentsInput
): Promise<CalendarEventAttachmentMeta[]> {
  const accounts = await listAccounts()
  const acc = accounts.find((a) => a.id === input.accountId)
  if (!acc) throw new Error('Konto nicht gefunden.')
  const graphEventId = input.graphEventId.trim()
  const graphCalendarId = input.graphCalendarId?.trim() || null
  if (acc.provider === 'google') {
    const calId = graphCalendarId
    if (!calId) throw new Error('Google: Kalender-ID fehlt (graphCalendarId).')
    return listGoogleEventAttachments(input.accountId, calId, graphEventId)
  }
  if (acc.provider !== 'microsoft') {
    return []
  }
  return listGraphEventAttachments(input.accountId, graphEventId, graphCalendarId)
}

export async function addCalendarEventAttachments(
  accountId: string,
  graphEventId: string,
  graphCalendarId: string | null | undefined,
  input: {
    files?: ComposeAttachment[] | null
    references?: ComposeReferenceAttachment[] | null
  }
): Promise<void> {
  const accounts = await listAccounts()
  const acc = accounts.find((a) => a.id === accountId)
  if (!acc) return
  const files = input.files?.filter((a) => a.dataBase64?.trim()) ?? []
  const references = input.references?.filter((r) => r.sourceUrl?.trim()) ?? []
  if (files.length === 0 && references.length === 0) return

  if (acc.provider === 'google') {
    const calId = graphCalendarId?.trim()
    if (!calId) throw new Error('Google: Kalender-ID fehlt (graphCalendarId).')
    if (references.length > 0) {
      throw new Error('Google-Kalender unterstuetzt keine OneDrive-Cloud-Anhaenge am Termin.')
    }
    await googleAddEventAttachments(accountId, calId, graphEventId, files)
    return
  }
  if (acc.provider === 'microsoft') {
    await graphAddEventAttachments(accountId, graphEventId, { files, references }, graphCalendarId)
  }
}

export async function openCalendarEventAttachment(
  input: CalendarEventAttachmentActionInput
): Promise<{ ok: boolean; error?: string }> {
  try {
    const meta = await findAttachmentMeta(input)
    if (!meta) return { ok: false, error: 'Anhang nicht gefunden.' }
    if (meta.kind === 'reference' || meta.kind === 'google_drive') {
      const url = meta.sourceUrl?.trim()
      if (!url) return { ok: false, error: 'Keine URL fuer diesen Anhang.' }
      await shell.openExternal(url)
      return { ok: true }
    }
    const file = await downloadCalendarEventAttachmentBytes(input)
    const target = await writeAttachmentCacheFile(
      input.attachmentId,
      sanitizeFileName(file.name),
      file.bytes
    )
    const err = await shell.openPath(target)
    if (err) return { ok: false, error: err }
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.startsWith('REFERENCE_URL:')) {
      await shell.openExternal(msg.slice('REFERENCE_URL:'.length))
      return { ok: true }
    }
    return { ok: false, error: msg }
  }
}

export async function saveCalendarEventAttachmentAs(
  input: CalendarEventAttachmentActionInput & { suggestedName?: string; filePath: string }
): Promise<{ ok: boolean; error?: string }> {
  try {
    const meta = await findAttachmentMeta(input)
    if (!meta) return { ok: false, error: 'Anhang nicht gefunden.' }
    if (meta.kind === 'reference' || meta.kind === 'google_drive') {
      const url = meta.sourceUrl?.trim()
      if (!url) return { ok: false, error: 'Cloud-Anhaenge koennen nur im Browser geoeffnet werden.' }
      await shell.openExternal(url)
      return { ok: true }
    }
    const file = await downloadCalendarEventAttachmentBytes(input)
    const fs = await import('node:fs/promises')
    await fs.writeFile(input.filePath, file.bytes)
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, error: msg }
  }
}

async function findAttachmentMeta(
  input: CalendarEventAttachmentActionInput
): Promise<CalendarEventAttachmentMeta | null> {
  const list = await listCalendarEventAttachments(input)
  return list.find((a) => a.id === input.attachmentId) ?? null
}

async function downloadCalendarEventAttachmentBytes(
  input: CalendarEventAttachmentActionInput
): Promise<{ name: string; contentType: string | null; bytes: Buffer }> {
  const accounts = await listAccounts()
  const acc = accounts.find((a) => a.id === input.accountId)
  if (!acc) throw new Error('Konto nicht gefunden.')
  if (acc.provider === 'google') {
    return downloadGoogleEventAttachment(input.accountId, input.attachmentId)
  }
  if (acc.provider !== 'microsoft') {
    throw new Error('Anhang-Download fuer dieses Konto nicht unterstuetzt.')
  }
  return downloadGraphEventAttachment(
    input.accountId,
    input.graphEventId,
    input.attachmentId,
    input.graphCalendarId ?? null
  )
}
