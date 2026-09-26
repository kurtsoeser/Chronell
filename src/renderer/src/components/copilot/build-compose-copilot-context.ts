import type { ComposeDraft, ComposeMode } from '@/stores/compose'
import { parseRecipients } from '@/lib/compose-helpers'
import { htmlToReadablePlainText } from '@/lib/html-to-readable-plain-text'
import { normalizeMailSenderEmail } from '@shared/mail-sender-email'

const MAX_BODY_CHARS = 10_000
const MAX_CORRESPONDENCE = 12
const MAX_THREAD_ITEMS = 20
const MAX_CONTEXT_CHARS = 28_000

function clip(text: string, max: number): string {
  const t = text.trim()
  if (t.length <= max) return t
  return `${t.slice(0, max)}\n…`
}

function formatRecipientLine(to: string, cc: string, bcc: string): string {
  const lines: string[] = []
  if (to.trim()) lines.push(`To: ${to.trim()}`)
  if (cc.trim()) lines.push(`Cc: ${cc.trim()}`)
  if (bcc.trim()) lines.push(`Bcc: ${bcc.trim()}`)
  return lines.join('\n')
}

function draftBodyPlain(draft: ComposeDraft): string {
  const html = draft.prependRichHtml?.trim()
  if (!html) return draft.prependPlain?.trim() || ''
  return htmlToReadablePlainText(html).trim()
}

function quotedPlain(draft: ComposeDraft): string {
  const html = draft.quotedHtml?.trim()
  if (!html) return ''
  return htmlToReadablePlainText(html).trim()
}

function collectRecipientEmails(draft: ComposeDraft): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const field of [draft.to, draft.cc]) {
    for (const r of parseRecipients(field)) {
      const norm = normalizeMailSenderEmail(r.address)
      if (!norm || seen.has(norm)) continue
      seen.add(norm)
      out.push(norm)
    }
  }
  return out
}

function isReplyLike(mode: ComposeMode): boolean {
  return mode === 'reply' || mode === 'replyAll' || mode === 'forward'
}

async function loadOriginalMessageContext(draft: ComposeDraft): Promise<string | null> {
  if (draft.replyToMessageId == null) return null
  const getMessage = window.mailClient?.mail?.getMessage
  if (typeof getMessage !== 'function') return null
  try {
    const message = await getMessage(draft.replyToMessageId)
    if (!message) return null
    const plain =
      message.bodyText?.trim() ||
      (message.bodyHtml?.trim() ? htmlToReadablePlainText(message.bodyHtml) : '')
    const header = [
      'ORIGINAL_EMAIL',
      message.subject?.trim() ? `Subject: ${message.subject.trim()}` : null,
      message.fromAddr?.trim()
        ? `From: ${message.fromName?.trim() || message.fromAddr.trim()}`
        : null,
      message.toAddrs?.trim() ? `To: ${message.toAddrs.trim()}` : null,
      message.ccAddrs?.trim() ? `Cc: ${message.ccAddrs.trim()}` : null,
      message.receivedAt ? `Received: ${message.receivedAt}` : null,
      message.sentAt ? `Sent: ${message.sentAt}` : null,
      '',
      clip(plain || '(no body text)', MAX_BODY_CHARS)
    ]
      .filter((line) => line != null)
      .join('\n')
    return header
  } catch {
    return null
  }
}

async function loadThreadContext(draft: ComposeDraft): Promise<string | null> {
  if (draft.replyToMessageId == null) return null
  const getMessage = window.mailClient?.mail?.getMessage
  const listByThreads = window.mailClient?.mail?.listMessagesByThreads
  if (typeof getMessage !== 'function' || typeof listByThreads !== 'function') return null
  try {
    const origin = await getMessage(draft.replyToMessageId)
    const threadKey = origin?.remoteThreadId?.trim()
    if (!threadKey) return null
    const items = await listByThreads({
      accountId: draft.accountId,
      threadKeys: [threadKey]
    })
    if (!items.length) return null
    const lines = items
      .slice(0, MAX_THREAD_ITEMS)
      .map((m, i) => {
        const when = m.receivedAt || m.sentAt || '?'
        const from = m.fromName?.trim() || m.fromAddr?.trim() || '?'
        const subj = m.subject?.trim() || '(no subject)'
        const snip = m.snippet?.trim() || ''
        return `${i + 1}. [${when}] ${from} — ${subj}${snip ? `\n   ${snip}` : ''}`
      })
    return ['CONVERSATION_THREAD', ...lines].join('\n')
  } catch {
    return null
  }
}

async function loadCorrespondenceContext(draft: ComposeDraft): Promise<string | null> {
  const emails = collectRecipientEmails(draft)
  if (emails.length === 0) return null
  const listCorrespondence = window.mailClient?.mail?.listCorrespondence
  if (typeof listCorrespondence !== 'function') return null
  try {
    const result = await listCorrespondence({
      email: emails[0]!,
      emails,
      accountIds: [draft.accountId],
      limit: MAX_CORRESPONDENCE,
      excludeDeletedJunk: true
    })
    if (!result.items.length) return null
    const lines = result.items.map((m, i) => {
      const when = m.receivedAt || m.sentAt || '?'
      const who = m.isFromMe ? 'Me' : m.fromName?.trim() || m.fromAddr?.trim() || '?'
      const subj = m.subject?.trim() || '(no subject)'
      const snip = m.snippet?.trim() || ''
      return `${i + 1}. [${when}] ${who} — ${subj}${snip ? `\n   ${snip}` : ''}`
    })
    return [
      'PRIOR_CORRESPONDENCE_WITH_RECIPIENTS',
      `Recipients: ${emails.join(', ')}`,
      ...lines
    ].join('\n')
  } catch {
    return null
  }
}

/**
 * Baut Grounding-Kontext für Compose-Copilot:
 * - Reply/Forward: Originalmail + Thread (+ aktueller Entwurf)
 * - Neu: Empfänger + bisheriger Schriftwechsel (+ aktueller Entwurf)
 */
export async function buildComposeCopilotContext(draft: ComposeDraft): Promise<string[]> {
  const parts: string[] = []

  const draftMeta = [
    'COMPOSE_DRAFT',
    `Mode: ${draft.mode}`,
    draft.subject?.trim() ? `Subject: ${draft.subject.trim()}` : 'Subject: (empty)',
    formatRecipientLine(draft.to, draft.cc, draft.bcc) || 'Recipients: (none yet)'
  ].join('\n')
  parts.push(draftMeta)

  const body = draftBodyPlain(draft)
  if (body) {
    parts.push(`CURRENT_DRAFT_BODY\n${clip(body, 4_000)}`)
  }

  if (isReplyLike(draft.mode)) {
    const original = await loadOriginalMessageContext(draft)
    if (original) parts.push(original)

    const quoted = quotedPlain(draft)
    if (quoted && (!original || quoted.length > 80)) {
      parts.push(`QUOTED_MAIL\n${clip(quoted, MAX_BODY_CHARS)}`)
    }

    const thread = await loadThreadContext(draft)
    if (thread) parts.push(thread)
  } else {
    const correspondence = await loadCorrespondenceContext(draft)
    if (correspondence) parts.push(correspondence)
  }

  // Gesamtbudget — ältere/längere Blöcke hinten kürzen
  let total = 0
  const clipped: string[] = []
  for (const p of parts) {
    if (total >= MAX_CONTEXT_CHARS) break
    const remain = MAX_CONTEXT_CHARS - total
    const next = p.length > remain ? `${p.slice(0, remain)}\n…` : p
    clipped.push(next)
    total += next.length
  }
  return clipped
}

export function composeCopilotNeedsRecipients(draft: ComposeDraft): boolean {
  if (isReplyLike(draft.mode)) return true
  return collectRecipientEmails(draft).length > 0 || Boolean(draft.subject?.trim())
}
