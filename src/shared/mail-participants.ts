import { normalizeMailSenderEmail } from './mail-sender-email'

const EMAIL_RE = /[^\s@]+@[^\s@]+\.[^\s@]+/gi

/** Alle normalisierten Adressen aus einer Header-Zeile (From/To/Cc/Bcc). */
export function extractEmailsFromAddressLine(line: string | null | undefined): string[] {
  if (!line?.trim()) return []
  const out: string[] = []
  const seen = new Set<string>()
  const emails = line.match(EMAIL_RE) ?? []
  for (const raw of emails) {
    const norm = normalizeMailSenderEmail(raw)
    if (norm && !seen.has(norm)) {
      seen.add(norm)
      out.push(norm)
    }
  }
  if (out.length === 0) {
    const single = normalizeMailSenderEmail(line)
    if (single && !seen.has(single)) out.push(single)
  }
  return out
}

export function collectMessageParticipantEmails(fields: {
  fromAddr?: string | null
  toAddrs?: string | null
  ccAddrs?: string | null
  bccAddrs?: string | null
}): string[] {
  const seen = new Set<string>()
  const lines = [fields.fromAddr, fields.toAddrs, fields.ccAddrs, fields.bccAddrs]
  for (const line of lines) {
    for (const em of extractEmailsFromAddressLine(line)) {
      seen.add(em)
    }
  }
  return [...seen]
}

/** Alle E-Mail-Adressen aus People `emails_json` (normalisiert, dedupliziert). */
export function parsePeopleContactEmails(emailsJson: string | null | undefined): string[] {
  if (!emailsJson?.trim()) return []
  try {
    const arr = JSON.parse(emailsJson) as unknown
    if (!Array.isArray(arr)) return []
    const seen = new Set<string>()
    for (const x of arr) {
      if (!x || typeof x !== 'object' || !('address' in x)) continue
      const address = (x as { address?: string }).address
      const norm = normalizeMailSenderEmail(
        typeof address === 'string' ? address : undefined
      )
      if (norm) seen.add(norm)
    }
    return [...seen]
  } catch {
    return []
  }
}

/** Primäradresse + optionale Aliase aus dem Adressbuch. */
export function resolveCorrespondenceEmailSet(
  primaryEmail: string | null | undefined,
  contactEmailsJson: string | null | undefined,
  includeAliases: boolean
): string[] {
  const primary = normalizeMailSenderEmail(primaryEmail)
  const seen = new Set<string>()
  if (primary) seen.add(primary)
  if (includeAliases) {
    for (const em of parsePeopleContactEmails(contactEmailsJson)) {
      seen.add(em)
    }
  }
  return [...seen]
}
