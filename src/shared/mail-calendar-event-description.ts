import type { MailFull, MailListItem } from './types'
import { formatMailFromLine } from './mail-note-insert-html'

const DEFAULT_MAX_BODY_CHARS = 50_000

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function htmlToPlainText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/\s+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

function stripUnsafeHtmlTags(html: string): string {
  return html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '')
}

function plainToParagraphHtml(plain: string): string {
  const trimmed = plain.trim()
  if (!trimmed) return ''
  return trimmed
    .split(/\n{2,}/)
    .map((para) => {
      const lines = para.split('\n').map((line) => escapeHtml(line.trim())).filter(Boolean)
      if (lines.length === 0) return ''
      return `<p>${lines.join('<br>')}</p>`
    })
    .filter(Boolean)
    .join('')
}

function formatMailDate(
  mail: Pick<MailListItem, 'receivedAt' | 'sentAt'>,
  locale: string
): string {
  const iso = mail.receivedAt || mail.sentAt
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' })
  } catch {
    return iso
  }
}

function truncatePlainText(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text
  return `${text.slice(0, maxChars).trimEnd()}…`
}

function mailBodyHtmlFragment(
  mail: Pick<MailFull, 'bodyHtml' | 'bodyText'>,
  maxBodyChars: number
): string {
  const rawHtml = mail.bodyHtml?.trim()
  if (rawHtml && /<[a-z][\s\S]*>/i.test(rawHtml)) {
    const cleaned = stripUnsafeHtmlTags(rawHtml)
    if (cleaned.length <= maxBodyChars) return cleaned
    const plain = truncatePlainText(htmlToPlainText(cleaned), maxBodyChars)
    return plainToParagraphHtml(plain)
  }

  const plain = truncatePlainText(
    mail.bodyText?.trim() || (rawHtml ? htmlToPlainText(rawHtml) : ''),
    maxBodyChars
  )
  return plainToParagraphHtml(plain) || '<p></p>'
}

export interface MailCalendarEventDescriptionLabels {
  reference: string
  from: string
  date: string
  noSubject: string
}

const DEFAULT_LABELS: MailCalendarEventDescriptionLabels = {
  reference: 'Bezug',
  from: 'Von',
  date: 'Datum',
  noSubject: '(Kein Betreff)'
}

/** HTML-Beschreibung fuer Kalendertermine aus einer Mail (Metadaten + Mail-Inhalt als HTML). */
export function buildMailCalendarEventDescriptionHtml(
  mail: Pick<
    MailFull,
    'subject' | 'fromName' | 'fromAddr' | 'receivedAt' | 'sentAt' | 'bodyHtml' | 'bodyText'
  >,
  options?: {
    labels?: Partial<MailCalendarEventDescriptionLabels>
    locale?: string
    maxBodyChars?: number
  }
): string {
  const labels = { ...DEFAULT_LABELS, ...options?.labels }
  const locale = options?.locale ?? 'de-DE'
  const maxBodyChars = options?.maxBodyChars ?? DEFAULT_MAX_BODY_CHARS
  const subject = mail.subject?.trim() || labels.noSubject
  const from = formatMailFromLine(mail)
  const date = formatMailDate(mail, locale)
  const bodyHtml = mailBodyHtmlFragment(mail, maxBodyChars)

  return [
    `<p><strong>${escapeHtml(labels.reference)}:</strong> ${escapeHtml(subject)}</p>`,
    `<p><strong>${escapeHtml(labels.from)}:</strong> ${escapeHtml(from)}</p>`,
    `<p><strong>${escapeHtml(labels.date)}:</strong> ${escapeHtml(date)}</p>`,
    '<hr>',
    bodyHtml || '<p></p>'
  ].join('')
}
