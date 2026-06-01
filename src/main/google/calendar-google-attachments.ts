import { Readable } from 'node:stream'
import type { calendar_v3 } from 'googleapis'
import type { CalendarEventAttachmentMeta, ComposeAttachment } from '@shared/types'
import { getGoogleCredentials } from './google-credentials-store'
import {
  GOOGLE_DRIVE_FILE_SCOPE_URL,
  parseStoredScopeParts,
  storedGoogleScopeIncludesDriveFile
} from '../auth/google-scopes'
import { getGoogleApis } from './google-auth-client'
import { google } from 'googleapis'
import { loadConfig } from '../config'
import { createGoogleOAuth2Client } from '../auth/google'

function assertGoogleDriveFileScope(scope: string | null | undefined): void {
  if (storedGoogleScopeIncludesDriveFile(scope)) return
  throw new Error(
    `Google-Termin-Anhaenge erfordern den OAuth-Scope «${GOOGLE_DRIVE_FILE_SCOPE_URL}». ` +
      'Bitte das Google-Konto in den Einstellungen entfernen und erneut verbinden.'
  )
}

async function getGoogleCalendarAndDrive(accountId: string): Promise<{
  calendar: ReturnType<typeof google.calendar>
  drive: ReturnType<typeof google.drive>
}> {
  const stored = await getGoogleCredentials(accountId)
  assertGoogleDriveFileScope(stored?.scope)
  const { calendar } = await getGoogleApis(accountId)
  const config = await loadConfig()
  const clientId = config.googleClientId?.trim()
  const clientSecret = config.googleClientSecret?.trim()
  if (!clientId || !stored?.refresh_token) {
    throw new Error('Google-Konto ist nicht angemeldet.')
  }
  const oauth2 = createGoogleOAuth2Client(clientId, clientSecret ?? undefined)
  oauth2.setCredentials({
    refresh_token: stored.refresh_token,
    access_token: stored.access_token ?? undefined,
    expiry_date: stored.expiry_date ?? undefined
  })
  return {
    calendar,
    drive: google.drive({ version: 'v3', auth: oauth2 })
  }
}

function mapGoogleEventAttachment(
  a: calendar_v3.Schema$EventAttachment
): CalendarEventAttachmentMeta | null {
  const fileId = a.fileId?.trim()
  if (!fileId) return null
  return {
    id: fileId,
    name: a.title?.trim() || 'Anhang',
    contentType: a.mimeType ?? null,
    size: null,
    kind: 'google_drive',
    sourceUrl: a.fileUrl?.trim() || null
  }
}

export async function listGoogleEventAttachments(
  accountId: string,
  calendarId: string,
  eventId: string
): Promise<CalendarEventAttachmentMeta[]> {
  const { calendar } = await getGoogleApis(accountId)
  const res = await calendar.events.get({
    calendarId,
    eventId,
    fields: 'attachments(fileId,title,mimeType,fileUrl,iconLink)'
  })
  const out: CalendarEventAttachmentMeta[] = []
  for (const raw of res.data.attachments ?? []) {
    const mapped = mapGoogleEventAttachment(raw)
    if (mapped) out.push(mapped)
  }
  return out
}

export async function downloadGoogleEventAttachment(
  accountId: string,
  fileId: string
): Promise<{ name: string; contentType: string | null; bytes: Buffer }> {
  const { drive } = await getGoogleCalendarAndDrive(accountId)
  const meta = await drive.files.get({ fileId, fields: 'name,mimeType' })
  const res = await drive.files.get(
    { fileId, alt: 'media' },
    { responseType: 'arraybuffer' }
  )
  const data = res.data
  const bytes = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer)
  return {
    name: meta.data.name?.trim() || 'attachment',
    contentType: meta.data.mimeType ?? null,
    bytes
  }
}

async function fetchGoogleEventAttachmentList(
  calendar: ReturnType<typeof google.calendar>,
  calendarId: string,
  eventId: string
): Promise<calendar_v3.Schema$EventAttachment[]> {
  const res = await calendar.events.get({
    calendarId,
    eventId,
    fields: 'attachments(fileId,title,mimeType,fileUrl)'
  })
  return res.data.attachments ?? []
}

export async function googleAddEventAttachments(
  accountId: string,
  calendarId: string,
  eventId: string,
  attachments: ComposeAttachment[]
): Promise<void> {
  if (!attachments.length) return
  const calId = calendarId.trim() || 'primary'
  const { calendar, drive } = await getGoogleCalendarAndDrive(accountId)
  const existing = await fetchGoogleEventAttachmentList(calendar, calId, eventId)
  const next: calendar_v3.Schema$EventAttachment[] = [...existing]

  for (const att of attachments) {
    const name = att.name?.trim()
    const contentType = att.contentType?.trim() || 'application/octet-stream'
    const dataBase64 = att.dataBase64?.trim()
    if (!name || !dataBase64) continue
    const buffer = Buffer.from(dataBase64, 'base64')
    const uploaded = await drive.files.create({
      requestBody: { name },
      media: { mimeType: contentType, body: Readable.from(buffer) },
      fields: 'id,mimeType,webViewLink'
    })
    const fileId = uploaded.data.id?.trim()
    if (!fileId) continue
    next.push({
      fileId,
      title: name,
      mimeType: contentType,
      fileUrl: uploaded.data.webViewLink ?? undefined
    })
  }

  await calendar.events.patch({
    calendarId: calId,
    eventId,
    supportsAttachments: true,
    requestBody: { attachments: next }
  })
}
