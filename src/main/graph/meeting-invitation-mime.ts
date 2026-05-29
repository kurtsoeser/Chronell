import { ResponseType } from '@microsoft/microsoft-graph-client'
import { extractIcsFromMime } from '@shared/meeting-invitation-extract'
import { createGraphClient } from './client'
import { runGraphMailboxRequest } from './graph-account-request'
import { loadConfig } from '../config'

async function getClientFor(accountId: string): Promise<ReturnType<typeof createGraphClient>> {
  const config = await loadConfig()
  if (!config.microsoftClientId) {
    throw new Error('Keine Azure Client-ID konfiguriert.')
  }
  const homeAccountId = accountId.replace(/^ms:/, '')
  return createGraphClient(config.microsoftClientId, homeAccountId)
}

/** Liest MIME-Rohtext einer Mail und extrahiert eingebettetes ICS (text/calendar-Part). */
export async function fetchIcsTextFromGraphMessageMime(
  accountId: string,
  remoteMessageId: string
): Promise<string | null> {
  const client = await getClientFor(accountId)
  const mime = (await runGraphMailboxRequest(accountId, 'getMeetingMessageMime', () =>
    client
      .api(`/me/messages/${remoteMessageId}/$value`)
      .responseType(ResponseType.TEXT)
      .get()
  )) as string

  return extractIcsFromMime(mime)
}

interface GraphAttachmentRow {
  '@odata.type'?: string
  id?: string
  name?: string | null
  contentType?: string | null
  contentBytes?: string | null
}

/** Versucht ICS aus FileAttachments zu lesen (auch versteckte Kalender-Parts). */
export async function fetchIcsTextFromGraphMessageAttachments(
  accountId: string,
  remoteMessageId: string
): Promise<string | null> {
  const client = await getClientFor(accountId)
  const res = (await runGraphMailboxRequest(accountId, 'listMeetingAttachments', () =>
    client.api(`/me/messages/${remoteMessageId}/attachments`).get()
  )) as { value?: GraphAttachmentRow[] }

  for (const row of res.value ?? []) {
    const type = (row['@odata.type'] ?? '').toLowerCase()
    const name = (row.name ?? '').toLowerCase()
    const ct = (row.contentType ?? '').toLowerCase()
    if (!type.includes('fileattachment') || !row.id) continue

    const looksCalendar =
      ct.includes('calendar') ||
      ct.includes('ics') ||
      name.endsWith('.ics') ||
      name.includes('invite')
    if (!looksCalendar) continue

    try {
      const full = (await runGraphMailboxRequest(accountId, 'downloadMeetingIcsAttachment', () =>
        client.api(`/me/messages/${remoteMessageId}/attachments/${row.id}`).get()
      )) as GraphAttachmentRow
      if (!full.contentBytes) continue
      const text = Buffer.from(full.contentBytes, 'base64').toString('utf8')
      const block = extractIcsFromMime(text)
      if (block) return block
    } catch {
      // naechster Anhang
    }
  }

  return null
}
