import type { MailFull } from '@shared/types'

export interface ParsedRecipient {
  address: string
  name?: string
}

/**
 * Erkennt sowohl reine Adressen ("foo@bar.de") als auch das
 * "Name <foo@bar.de>"-Format. Kommas trennen Empfaenger.
 */
export function parseRecipients(input: string): ParsedRecipient[] {
  if (!input.trim()) return []
  const { complete, tail } = parseRecipientsWithTail(input)
  const last = parseRecipientEntry(tail)
  return last ? [...complete, last] : complete
}

export function formatRecipientsForInput(recipients: ParsedRecipient[]): string {
  return recipients
    .map((r) => (r.name ? `${r.name} <${r.address}>` : r.address))
    .join(', ')
}

const COMPLETE_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function parseRecipientEntry(entry: string): ParsedRecipient | null {
  const trimmed = entry.trim().replace(/[;,]+\s*$/, '')
  if (!trimmed) return null
  const match = trimmed.match(/^(.*?)<([^>]+)>\s*$/)
  if (match) {
    const name = match[1]?.trim().replace(/^["']|["']$/g, '') || undefined
    const address = match[2]?.trim() ?? ''
    if (!COMPLETE_EMAIL_RE.test(address)) return null
    return { address, name }
  }
  if (COMPLETE_EMAIL_RE.test(trimmed)) {
    return { address: trimmed }
  }
  // «Vorname Nachname email@domain» (häufig aus Outlook-Listen, mit/ohne Semikolon)
  const nameEmail = trimmed.match(/^(.+?)\s+([^\s@]+@[^\s@]+\.[^\s@]+)$/)
  if (nameEmail) {
    const name = nameEmail[1]?.trim().replace(/^["']|["']$/g, '') || undefined
    const address = nameEmail[2]?.trim() ?? ''
    if (COMPLETE_EMAIL_RE.test(address)) {
      return { address, ...(name ? { name } : {}) }
    }
  }
  return null
}

/**
 * Zerlegt die Empfaengerzeile in fertig erkannte Adressen und den Reststring
 * (aktuell getippter, evtl. unvollstaendiger Teil).
 */
export function parseRecipientsWithTail(input: string): {
  complete: ParsedRecipient[]
  tail: string
} {
  const normalized = input.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const complete: ParsedRecipient[] = []
  let buf = ''
  let depth = 0
  for (let i = 0; i < normalized.length; i++) {
    const c = normalized[i]
    if (c === '<') depth++
    else if (c === '>') depth = Math.max(0, depth - 1)
    if ((c === ',' || c === ';' || c === '\n') && depth === 0) {
      const part = buf.trim()
      buf = ''
      const one = parseRecipientEntry(part)
      if (one) complete.push(one)
      continue
    }
    buf += c
  }
  return { complete, tail: buf }
}

export function formatRecipientsWithTail(complete: ParsedRecipient[], tail: string): string {
  const base = formatRecipientsForInput(complete)
  if (!tail) {
    if (!base) return ''
    // Trailing delimiter so parseRecipientsWithTail keeps committed addresses in
    // `complete` (chips) instead of leaving the last one in `tail` (input only).
    return `${base},`
  }
  if (!base) return tail
  return `${base}, ${tail}`
}

/**
 * Mehrere Empfaenger aus Zwischenablage (Tabellen: Tab/Zeile, Listen: Komma/Semikolon).
 * Erkennt auch Zeilen «Name[TAB]email@…».
 */
export function parseRecipientsBulk(raw: string): ParsedRecipient[] {
  const out: ParsedRecipient[] = []
  const seen = new Set<string>()
  const push = (r: ParsedRecipient | null): void => {
    if (!r) return
    const key = r.address.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    out.push(r)
  }

  const parseTabSeparatedRow = (line: string): void => {
    const cells = line.split('\t').map((c) => c.trim()).filter(Boolean)
    if (cells.length === 0) return
    let pendingName: string | undefined
    for (const cell of cells) {
      if (/[,;]/.test(cell)) {
        for (const r of parseRecipients(cell)) {
          push(
            !r.name && pendingName ? { address: r.address, name: pendingName } : r
          )
          pendingName = undefined
        }
        continue
      }
      const one = parseRecipientEntry(cell)
      if (one) {
        push(
          !one.name && pendingName ? { address: one.address, name: pendingName } : one
        )
        pendingName = undefined
      } else if (!cell.includes('@')) {
        pendingName = cell
      }
    }
  }

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed) continue
    if (trimmed.includes('\t')) {
      parseTabSeparatedRow(trimmed)
      continue
    }
    for (const r of parseRecipients(trimmed)) {
      push(r)
    }
  }
  return out
}

export { normalizeRecipientSuggestionQuery } from '@shared/compose-recipient-query'

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function plainBodyOfMessage(message: MailFull): string {
  if (message.bodyHtml) return message.bodyHtml
  if (message.bodyText) {
    return escapeHtml(message.bodyText).replace(/\n/g, '<br>')
  }
  return ''
}

function quoteHeaderLine(message: MailFull): string {
  const date = message.receivedAt || message.sentAt
  const when = date ? new Date(date).toLocaleString('de-DE') : ''
  const who = message.fromName
    ? `${message.fromName}${message.fromAddr ? ` <${message.fromAddr}>` : ''}`
    : message.fromAddr ?? ''
  return `Am ${when} schrieb ${escapeHtml(who)}:`
}

export function buildReplyBody(message: MailFull): string {
  const header = quoteHeaderLine(message)
  const body = plainBodyOfMessage(message)
  return `<p></p><p></p><div style="border-left:3px solid #c2c2c2;padding-left:12px;color:#666;">
    <p style="margin:0 0 8px 0;font-size:12px;">${header}</p>
    ${body}
  </div>`
}

export function buildForwardBody(message: MailFull): string {
  const date = message.receivedAt || message.sentAt
  const when = date ? new Date(date).toLocaleString('de-DE') : ''
  const from = message.fromName
    ? `${message.fromName}${message.fromAddr ? ` &lt;${escapeHtml(message.fromAddr)}&gt;` : ''}`
    : escapeHtml(message.fromAddr ?? '')
  const body = plainBodyOfMessage(message)
  return `<p></p><p></p><div style="border-top:1px solid #d6d6db;padding-top:8px;">
    <p style="margin:0 0 4px 0;font-size:12px;color:#555;">
      <b>Von:</b> ${from}<br>
      <b>Gesendet:</b> ${escapeHtml(when)}<br>
      <b>An:</b> ${escapeHtml(message.toAddrs ?? '')}<br>
      ${message.ccAddrs ? `<b>Cc:</b> ${escapeHtml(message.ccAddrs)}<br>` : ''}
      <b>Betreff:</b> ${escapeHtml(message.subject ?? '')}
    </p>
    ${body}
  </div>`
}

export function withReplyPrefix(subject: string | null): string {
  const s = subject ?? ''
  return /^re:/i.test(s) ? s : `Re: ${s}`
}

export function withForwardPrefix(subject: string | null): string {
  const s = subject ?? ''
  return /^fwd?:/i.test(s) ? s : `Fwd: ${s}`
}

import { linkifyBareUrlsInHtmlFragment } from '@shared/calendar-event-body-html'

/**
 * Wandelt einen Plain-Text-Body in einfaches HTML (mit Zeilenumbruch),
 * damit Graph ihn als HTML akzeptiert.
 */
export function plainToHtml(plain: string): string {
  return linkifyBareUrlsInHtmlFragment(`<p>${escapeHtml(plain).replace(/\n/g, '<br>')}</p>`)
}
