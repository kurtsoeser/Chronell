import { normalizeMailSenderEmail } from './mail-sender-email'

/** Freemail-/Consumer-Postfächer: Domain-Favicon ist meist das Provider-Logo, nicht der Absender. */
const GENERIC_MAILBOX_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'msn.com',
  'yahoo.com',
  'yahoo.de',
  'gmx.de',
  'gmx.net',
  'gmx.at',
  'gmx.ch',
  'web.de',
  'icloud.com',
  'me.com',
  'mac.com',
  'aol.com',
  't-online.de',
  'mail.com',
  'proton.me',
  'protonmail.com',
  'zoho.com',
  'yandex.com',
  'yandex.ru'
])

/** Domain aus Absender-E-Mail (`user@firma.de` oder `Name <user@firma.de>`). */
export function extractEmailDomain(email: string | null | undefined): string | null {
  const norm = normalizeMailSenderEmail(email)
  if (!norm) return null
  const at = norm.lastIndexOf('@')
  if (at < 0 || at >= norm.length - 1) return null
  const domain = norm.slice(at + 1).trim().toLowerCase()
  return domain.length > 0 ? domain : null
}

export function isGenericMailboxDomain(domain: string | null | undefined): boolean {
  const d = domain?.trim().toLowerCase()
  if (!d) return false
  return GENERIC_MAILBOX_DOMAINS.has(d)
}

/**
 * Lookup-Kette von spezifischer Domain zur Root-Domain.
 * z. B. `newsletter.flyeralarm.com` → [`newsletter.flyeralarm.com`, `flyeralarm.com`]
 */
export function domainLookupCandidates(domain: string | null | undefined): string[] {
  const d = domain?.trim().toLowerCase()
  if (!d) return []
  const parts = d.split('.').filter(Boolean)
  if (parts.length <= 1) return [d]
  const out: string[] = []
  for (let i = 0; i <= parts.length - 2; i++) {
    const candidate = parts.slice(i).join('.')
    if (candidate.split('.').length >= 2 && !out.includes(candidate)) {
      out.push(candidate)
    }
  }
  return out
}
