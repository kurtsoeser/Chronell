import type { CalendarEventAttachmentMeta, ComposeAttachment, ComposeReferenceAttachment } from '@shared/types'
import { createGraphClient } from './client'
import { graphEventInstancePath } from './calendar-graph'
import { loadConfig } from '../config'

const INLINE_ATTACHMENT_LIMIT = 3 * 1024 * 1024

async function getClientFor(accountId: string): Promise<ReturnType<typeof createGraphClient>> {
  const config = await loadConfig()
  if (!config.microsoftClientId) {
    throw new Error('Keine Azure Client-ID konfiguriert.')
  }
  const homeAccountId = accountId.replace(/^ms:/, '')
  return createGraphClient(config.microsoftClientId, homeAccountId)
}

interface GraphEventAttachment {
  '@odata.type'?: string
  id: string
  name?: string | null
  contentType?: string | null
  size?: number | null
  contentBytes?: string | null
  sourceUrl?: string | null
  isInline?: boolean
}

function mapGraphEventAttachment(a: GraphEventAttachment): CalendarEventAttachmentMeta | null {
  const id = a.id?.trim()
  if (!id) return null
  const odata = a['@odata.type'] ?? ''
  if (odata.includes('referenceAttachment')) {
    return {
      id,
      name: a.name?.trim() || 'Anhang',
      contentType: a.contentType ?? null,
      size: typeof a.size === 'number' ? a.size : null,
      kind: 'reference',
      sourceUrl: a.sourceUrl?.trim() || null,
      isInline: false
    }
  }
  if (odata.includes('itemAttachment')) {
    return null
  }
  return {
    id,
    name: a.name?.trim() || 'Anhang',
    contentType: a.contentType ?? null,
    size: typeof a.size === 'number' ? a.size : null,
    kind: 'file',
    isInline: Boolean(a.isInline)
  }
}

function eventAttachmentsPath(graphEventId: string, graphCalendarId?: string | null): string {
  return `${graphEventInstancePath(graphEventId, graphCalendarId)}/attachments`
}

function partitionFileAttachments(atts: ComposeAttachment[]): {
  inline: ComposeAttachment[]
  large: ComposeAttachment[]
} {
  const inline: ComposeAttachment[] = []
  const large: ComposeAttachment[] = []
  for (const a of atts) {
    const bytes = Math.ceil((a.dataBase64.length * 3) / 4)
    if (bytes > INLINE_ATTACHMENT_LIMIT) large.push(a)
    else inline.push(a)
  }
  return { inline, large }
}

async function uploadLargeGraphEventAttachment(
  client: ReturnType<typeof createGraphClient>,
  attachmentsPath: string,
  att: ComposeAttachment
): Promise<void> {
  const buffer = Buffer.from(att.dataBase64, 'base64')
  const session = (await client.api(`${attachmentsPath}/createUploadSession`).post({
    AttachmentItem: {
      attachmentType: 'file',
      name: att.name,
      size: buffer.byteLength,
      contentType: att.contentType
    }
  })) as { uploadUrl: string }

  const chunkSize = 5 * 1024 * 1024
  for (let start = 0; start < buffer.byteLength; start += chunkSize) {
    const end = Math.min(start + chunkSize, buffer.byteLength)
    const chunk = buffer.subarray(start, end)
    const res = await fetch(session.uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Length': String(chunk.byteLength),
        'Content-Range': `bytes ${start}-${end - 1}/${buffer.byteLength}`
      },
      body: chunk
    })
    if (!res.ok) {
      const txt = await res.text().catch(() => '')
      throw new Error(`Upload des Termin-Anhangs fehlgeschlagen (${res.status}): ${txt.slice(0, 200)}`)
    }
  }
}

export async function listGraphEventAttachments(
  accountId: string,
  graphEventId: string,
  graphCalendarId?: string | null
): Promise<CalendarEventAttachmentMeta[]> {
  const client = await getClientFor(accountId)
  const path = eventAttachmentsPath(graphEventId, graphCalendarId)
  const res = (await client.api(path).get()) as { value?: GraphEventAttachment[] }
  const out: CalendarEventAttachmentMeta[] = []
  for (const raw of res.value ?? []) {
    const mapped = mapGraphEventAttachment(raw)
    if (mapped) out.push(mapped)
  }
  return out
}

export async function downloadGraphEventAttachment(
  accountId: string,
  graphEventId: string,
  attachmentId: string,
  graphCalendarId?: string | null
): Promise<{ name: string; contentType: string | null; bytes: Buffer }> {
  const client = await getClientFor(accountId)
  const path = `${eventAttachmentsPath(graphEventId, graphCalendarId)}/${encodeURIComponent(attachmentId)}`
  const full = (await client.api(path).get()) as GraphEventAttachment
  const odata = full['@odata.type'] ?? ''
  if (odata.includes('referenceAttachment')) {
    const url = full.sourceUrl?.trim()
    if (!url) throw new Error('Cloud-Anhang hat keine Quell-URL.')
    throw new Error(`REFERENCE_URL:${url}`)
  }
  if (!full.contentBytes) {
    throw new Error('Anhang enthaelt keine Daten (vermutlich kein FileAttachment).')
  }
  return {
    name: full.name?.trim() || 'attachment',
    contentType: full.contentType ?? null,
    bytes: Buffer.from(full.contentBytes, 'base64')
  }
}

export async function graphAddEventAttachments(
  accountId: string,
  graphEventId: string,
  input: {
    files?: ComposeAttachment[] | null
    references?: ComposeReferenceAttachment[] | null
  },
  graphCalendarId?: string | null
): Promise<void> {
  const files = input.files?.filter((a) => a.name?.trim() && a.dataBase64?.trim()) ?? []
  const references = input.references?.filter((r) => r.name?.trim() && r.sourceUrl?.trim()) ?? []
  if (files.length === 0 && references.length === 0) return

  const client = await getClientFor(accountId)
  const path = eventAttachmentsPath(graphEventId, graphCalendarId)
  const { inline, large } = partitionFileAttachments(files)

  for (const att of inline) {
    await client.api(path).post({
      '@odata.type': '#microsoft.graph.fileAttachment',
      name: att.name,
      contentType: att.contentType,
      contentBytes: att.dataBase64
    })
  }
  for (const att of large) {
    await uploadLargeGraphEventAttachment(client, path, att)
  }
  for (const ref of references) {
    await client.api(path).post({
      '@odata.type': '#microsoft.graph.referenceAttachment',
      name: ref.name,
      sourceUrl: ref.sourceUrl,
      providerType: ref.providerType ?? 'oneDriveBusiness'
    })
  }
}

/** @deprecated Nutze graphAddEventAttachments. */
export async function graphAddEventFileAttachments(
  accountId: string,
  graphEventId: string,
  attachments: ComposeAttachment[],
  graphCalendarId?: string | null
): Promise<void> {
  await graphAddEventAttachments(accountId, graphEventId, { files: attachments }, graphCalendarId)
}
