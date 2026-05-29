import { normalizeMailSenderEmail } from './mail-sender-email'

export interface MailCorrespondent {
  email: string
  displayName: string | null
}

export interface ResolveCorrespondentInput {
  fromAddr: string | null | undefined
  fromName: string | null | undefined
  toAddrs: string | null | undefined
  ccAddrs?: string | null | undefined
  accountEmail: string | null | undefined
  folderWellKnown?: string | null
}

const EMAIL_RE = /[^\s@]+@[^\s@]+\.[^\s@]+/gi

function extractFirstEmailFromLine(line: string | null | undefined): string | null {
  if (!line?.trim()) return null
  const emails = line.match(EMAIL_RE) ?? []
  for (const em of emails) {
    const norm = normalizeMailSenderEmail(em)
    if (norm) return norm
  }
  return normalizeMailSenderEmail(line)
}

function displayNameBeforeEmail(line: string | null | undefined, email: string): string | null {
  if (!line?.trim()) return null
  const lower = email.toLowerCase()
  const angle = new RegExp(`^\\s*(.+?)\\s*<\\s*${escapeRegExp(lower)}\\s*>`, 'i').exec(line)
  if (angle?.[1]) {
    const name = angle[1].replace(/^["']|["']$/g, '').trim()
    return name.length > 0 ? name : null
  }
  const idx = line.toLowerCase().indexOf(lower)
  if (idx > 0) {
    const prefix = line.slice(0, idx).replace(/[,;]+$/, '').trim()
    if (prefix && !prefix.includes('@')) return prefix
  }
  return null
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Ermittelt die Gegenpartei einer Mail (Korrespondent) fuer Kontaktdetails / Verlauf.
 * Bei gesendeten Mails oder wenn der Absender das eigene Konto ist: erster Empfaenger.
 */
export function resolveCorrespondentFromMessage(
  input: ResolveCorrespondentInput
): MailCorrespondent | null {
  const accountNorm = normalizeMailSenderEmail(input.accountEmail)
  const fromNorm = normalizeMailSenderEmail(input.fromAddr)
  const wk = input.folderWellKnown?.toLowerCase() ?? ''
  const isOutboundFolder = wk === 'sentitems' || wk === 'drafts'
  const fromIsSelf = Boolean(accountNorm && fromNorm && fromNorm === accountNorm)

  if (isOutboundFolder || fromIsSelf) {
    const to =
      extractFirstEmailFromLine(input.toAddrs) ?? extractFirstEmailFromLine(input.ccAddrs)
    if (!to || (accountNorm && to === accountNorm)) return null
    return {
      email: to,
      displayName: displayNameBeforeEmail(input.toAddrs, to) ?? displayNameBeforeEmail(input.ccAddrs, to)
    }
  }

  if (!fromNorm) return null
  if (accountNorm && fromNorm === accountNorm) {
    const to = extractFirstEmailFromLine(input.toAddrs)
    if (to && to !== accountNorm) {
      return {
        email: to,
        displayName: displayNameBeforeEmail(input.toAddrs, to)
      }
    }
    return null
  }

  return {
    email: fromNorm,
    displayName: input.fromName?.trim() || null
  }
}

/** Prueft, ob eine Adresszeile die normalisierte Kontakt-E-Mail enthaelt. */
export function addressLineContainsEmail(
  line: string | null | undefined,
  normalizedEmail: string
): boolean {
  if (!line?.trim() || !normalizedEmail) return false
  const emails = line.match(EMAIL_RE) ?? []
  for (const em of emails) {
    if (normalizeMailSenderEmail(em) === normalizedEmail) return true
  }
  return line.toLowerCase().includes(normalizedEmail)
}
