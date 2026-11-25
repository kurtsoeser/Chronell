import type { AttachmentMeta, MailFull } from '@shared/types'
import {
  downloadMailAttachmentBytes,
  fetchMailAttachmentsMeta
} from '../mail-attachment-fetch'

const MAX_ATTACHMENTS = 12
const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024

export type EventsOsMailAttachmentPayload = {
  fileName: string
  mimeType?: string
  contentBase64: string
}

export type EventsOsMailAttachmentsResult = {
  attachments: EventsOsMailAttachmentPayload[]
  skipped: string[]
}

function isEligibleAttachment(meta: AttachmentMeta): boolean {
  if (meta.isInline) return false
  if (meta.size != null && meta.size > MAX_ATTACHMENT_BYTES) return false
  return true
}

/**
 * Lädt sichtbare Mail-Anhänge (ohne Inline-Bilder) als Base64 für Events-OS-Ablage.
 * Graph / EWS / Gmail über mail-attachment-fetch.
 */
export async function collectMailAttachmentsForEventsOs(
  mail: MailFull
): Promise<EventsOsMailAttachmentsResult> {
  if (!mail.hasAttachments) {
    return { attachments: [], skipped: [] }
  }

  const all = await fetchMailAttachmentsMeta(mail.id)
  const eligible = all.filter(isEligibleAttachment).slice(0, MAX_ATTACHMENTS)
  const attachments: EventsOsMailAttachmentPayload[] = []
  const skipped: string[] = []

  const skippedInline = all.filter((a) => a.isInline).length
  if (skippedInline > 0) {
    skipped.push(`${skippedInline} eingebettete Bild(er) übersprungen`)
  }
  const oversizedMeta = all.filter(
    (a) => !a.isInline && a.size != null && a.size > MAX_ATTACHMENT_BYTES
  )
  for (const meta of oversizedMeta) {
    skipped.push(`${meta.name} (zu groß)`)
  }
  if (all.filter((a) => !a.isInline).length > MAX_ATTACHMENTS) {
    skipped.push(`mehr als ${MAX_ATTACHMENTS} Anhänge — Rest übersprungen`)
  }

  for (const meta of eligible) {
    try {
      const file = await downloadMailAttachmentBytes(mail.id, meta.id)
      if (file.bytes.length > MAX_ATTACHMENT_BYTES) {
        skipped.push(`${meta.name} (zu groß)`)
        continue
      }
      if (file.bytes.length === 0) {
        skipped.push(`${meta.name} (leer)`)
        continue
      }
      attachments.push({
        fileName: (file.name || meta.name || 'anhang').trim() || 'anhang',
        mimeType: file.contentType ?? meta.contentType ?? undefined,
        contentBase64: file.bytes.toString('base64')
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      skipped.push(`${meta.name}: ${msg}`)
    }
  }

  return { attachments, skipped }
}
