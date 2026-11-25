import type { MailFull } from '../../shared/types'
import type {
  EventsOsInboxKind,
  EventsOsSendMailResult
} from '../../shared/types/events-os'
import { ensureMessageBodyLoaded } from '../message-body-fetch'
import { getMessageById } from '../db/messages-repo'
import { collectMailAttachmentsForEventsOs } from './events-os-mail-attachments'
import { postMailToEventsOs } from './studio-client'

function htmlToPlainText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function bodyPlain(mail: MailFull): string {
  if (mail.bodyText?.trim()) return mail.bodyText.trim()
  if (mail.bodyHtml?.trim()) return htmlToPlainText(mail.bodyHtml)
  return mail.snippet?.trim() || ''
}

function formatFromLine(mail: MailFull): string {
  const addr = mail.fromAddr?.trim()
  const name = mail.fromName?.trim()
  if (name && addr) return `${name} <${addr}>`
  return addr || name || ''
}

/** Stabile Idempotenz-ID für Studio (lokal + Graph remoteId). */
function chronellMessageKey(mail: MailFull): string {
  const remote = mail.remoteId?.trim()
  if (remote) return `chronell:${mail.accountId}:${remote}`
  return `chronell:local:${mail.id}`
}

export async function sendMailToEventsOs(input: {
  messageId: number
  eventId: string
  kind?: EventsOsInboxKind
}): Promise<EventsOsSendMailResult> {
  const eventId = String(input.eventId || '').trim()
  if (!eventId) throw new Error('eventId fehlt')

  const mail =
    (await ensureMessageBodyLoaded(input.messageId)) ??
    getMessageById(input.messageId)
  if (!mail) throw new Error('Mail nicht gefunden.')

  const subject = mail.subject?.trim() || ''
  const body = bodyPlain(mail)
  const from = formatFromLine(mail)
  const kind = input.kind || 'sonstiges'

  const { attachments, skipped } = await collectMailAttachmentsForEventsOs(mail)

  const result = await postMailToEventsOs({
    eventId,
    kind,
    subject,
    body,
    from,
    to: mail.toAddrs?.trim() || undefined,
    messageId: chronellMessageKey(mail),
    receivedAt: mail.receivedAt || mail.sentAt || new Date().toISOString(),
    title: subject || 'Aus Chronell',
    personName: mail.fromName?.trim() || undefined,
    personEmail: mail.fromAddr?.trim() || undefined,
    attachments: attachments.length ? attachments : undefined
  })

  if (!result.ok) {
    throw new Error(result.error || 'Events OS hat die Mail nicht gespeichert.')
  }

  return {
    ...result,
    attachmentCount: attachments.length,
    attachmentsSkipped: skipped.length ? skipped : undefined
  }
}

/** Fortbildungs-/Kurscode aus Betreff vorschlagen (z. B. 27F6B0B004). */
export function suggestEventsOsSearchQuery(subject?: string | null): string {
  const s = String(subject || '').trim()
  if (!s) return ''
  const code = s.match(/\b(\d{2}[A-Z0-9]{6,})\b/i)
  if (code) return code[1]
  // „Abmeldung Fortbildung …“ → Rest ohne Präfix
  const cleaned = s
    .replace(/^(abmeldung|anmeldung|storno|absage)\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim()
  return cleaned.slice(0, 80)
}
