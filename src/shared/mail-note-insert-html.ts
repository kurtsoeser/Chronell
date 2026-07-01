import type { MailFull, MailListItem } from './types'

export interface MailNoteInsertLabels {
  from: string
  to: string
  date: string
  subject: string
  excerpt: string
}

export interface MailNoteInsertOptions {
  /** Nur markierter Text statt ganzer Mail. */
  selectionText?: string | null
  /** Maximale Zeichenanzahl für den Inhaltsauszug. */
  maxBodyChars?: number
  /** Locale für Datumsformatierung (z. B. de-DE). */
  locale?: string
}

const DEFAULT_MAX_BODY_CHARS = 12_000

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

export function formatMailFromLine(
  mail: Pick<MailListItem, 'fromName' | 'fromAddr'>
): string {
  const addr = mail.fromAddr?.trim()
  const name = mail.fromName?.trim()
  if (name && addr) return `${name} <${addr}>`
  return addr || name || '—'
}

function mailBodyPlain(
  mail: Pick<MailFull, 'bodyText' | 'bodyHtml'>,
  maxChars: number
): string {
  const raw = mail.bodyText?.trim() || htmlToPlainText(mail.bodyHtml ?? '')
  if (!raw) return ''
  if (raw.length <= maxChars) return raw
  return `${raw.slice(0, maxChars).trimEnd()}…`
}

function plainToParagraphHtml(plain: string): string {
  const trimmed = plain.trim()
  if (!trimmed) return '<p></p>'
  const paragraphs = trimmed.split(/\n{2,}/)
  return paragraphs
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

/** HTML-Snippet für Mail-Inhalt in freie Notiz (Metadaten + Auszug). */
export function buildMailNoteInsertHtml(
  mail: MailFull,
  labels: MailNoteInsertLabels,
  options?: MailNoteInsertOptions
): string {
  const locale = options?.locale ?? 'de-DE'
  const maxBodyChars = options?.maxBodyChars ?? DEFAULT_MAX_BODY_CHARS
  const subject = mail.subject?.trim() || '—'
  const from = formatMailFromLine(mail)
  const to = mail.toAddrs?.trim() || '—'
  const date = formatMailDate(mail, locale)

  const selection = options?.selectionText?.trim()
  const bodyPlain = selection || mailBodyPlain(mail, maxBodyChars)
  const bodyHtml = plainToParagraphHtml(bodyPlain)

  const lines: string[] = [
    `<h3>${escapeHtml(labels.excerpt)}</h3>`,
    `<p><strong>${escapeHtml(labels.subject)}:</strong> ${escapeHtml(subject)}</p>`,
    `<p><strong>${escapeHtml(labels.from)}:</strong> ${escapeHtml(from)}</p>`,
    `<p><strong>${escapeHtml(labels.to)}:</strong> ${escapeHtml(to)}</p>`,
    `<p><strong>${escapeHtml(labels.date)}:</strong> ${escapeHtml(date)}</p>`,
    '<hr>',
    bodyHtml || '<p></p>'
  ]

  return lines.join('')
}
