import type { MailCorrespondenceItem, PeopleContactView } from '@shared/types'
import { htmlToReadablePlainText } from '@/lib/html-to-readable-plain-text'

const MAX_HISTORY_ROWS = 40
const MAX_FULL_BODIES = 5
const MAX_BODY_CHARS = 3_500
const MAX_CONTEXT_CHARS = 28_000

function clip(text: string, max: number): string {
  const t = text.trim()
  if (t.length <= max) return t
  return `${t.slice(0, max)}\n…`
}

function formatContactBlock(input: {
  displayName: string
  primaryEmail: string
  emails: string[]
  contact: PeopleContactView | null
}): string {
  const lines = [
    'CONTACT',
    `Name: ${input.displayName}`,
    `Primary email: ${input.primaryEmail}`,
    input.emails.length > 1 ? `All emails: ${input.emails.join(', ')}` : null
  ]
  const c = input.contact
  if (c) {
    if (c.company?.trim()) lines.push(`Company: ${c.company.trim()}`)
    if (c.jobTitle?.trim()) lines.push(`Job title: ${c.jobTitle.trim()}`)
    if (c.department?.trim()) lines.push(`Department: ${c.department.trim()}`)
    if (c.officeLocation?.trim()) lines.push(`Office: ${c.officeLocation.trim()}`)
    if (c.notes?.trim()) lines.push(`Contact notes: ${clip(c.notes, 1_500)}`)
  }
  return lines.filter((l) => l != null).join('\n')
}

function formatHistoryList(items: MailCorrespondenceItem[]): string {
  const rows = items.slice(0, MAX_HISTORY_ROWS).map((m, i) => {
    const when = m.receivedAt || m.sentAt || '?'
    const who = m.isFromMe ? 'Me' : m.fromName?.trim() || m.fromAddr?.trim() || '?'
    const subj = m.subject?.trim() || '(no subject)'
    const snip = m.snippet?.trim() || ''
    return `${i + 1}. [${when}] ${who} — ${subj}${snip ? `\n   ${snip}` : ''}`
  })
  return [
    'MAIL_CORRESPONDENCE',
    `Count shown: ${Math.min(items.length, MAX_HISTORY_ROWS)} of ${items.length}`,
    ...rows
  ].join('\n')
}

async function loadRecentBodies(items: MailCorrespondenceItem[]): Promise<string | null> {
  const getMessage = window.mailClient?.mail?.getMessage
  if (typeof getMessage !== 'function') return null
  const picked = items.slice(0, MAX_FULL_BODIES)
  if (picked.length === 0) return null

  const blocks: string[] = []
  for (const item of picked) {
    try {
      const message = await getMessage(item.id)
      if (!message) continue
      const plain =
        message.bodyText?.trim() ||
        (message.bodyHtml?.trim() ? htmlToReadablePlainText(message.bodyHtml) : '') ||
        item.snippet?.trim() ||
        ''
      if (!plain) continue
      const when = item.receivedAt || item.sentAt || '?'
      const who = item.isFromMe ? 'Me' : item.fromName?.trim() || item.fromAddr?.trim() || '?'
      const subj = item.subject?.trim() || '(no subject)'
      blocks.push(
        [`---`, `From: ${who}`, `When: ${when}`, `Subject: ${subj}`, '', clip(plain, MAX_BODY_CHARS)].join(
          '\n'
        )
      )
    } catch {
      // Einzelnachricht optional
    }
  }
  if (blocks.length === 0) return null
  return ['RECENT_MESSAGE_BODIES', ...blocks].join('\n')
}

export interface BuildContactCopilotContextInput {
  displayName: string
  primaryEmail: string
  emails: string[]
  contact: PeopleContactView | null
  historyItems: MailCorrespondenceItem[]
  /** Neueste Nachrichtenkörper nachladen (für bessere Zusammenfassung). */
  includeRecentBodies?: boolean
}

/**
 * Grounding für Kontakt-Zusammenfassung: Stammdaten + Mailverlauf (+ optional Körper).
 */
export async function buildContactCopilotContext(
  input: BuildContactCopilotContextInput
): Promise<string[]> {
  const parts: string[] = [
    formatContactBlock({
      displayName: input.displayName,
      primaryEmail: input.primaryEmail,
      emails: input.emails,
      contact: input.contact
    })
  ]

  if (input.historyItems.length > 0) {
    parts.push(formatHistoryList(input.historyItems))
  }

  if (input.includeRecentBodies !== false && input.historyItems.length > 0) {
    const bodies = await loadRecentBodies(input.historyItems)
    if (bodies) parts.push(bodies)
  }

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
