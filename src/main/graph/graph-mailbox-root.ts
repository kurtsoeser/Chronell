/** Normalisierte SMTP-Adresse (klein, getrimmt). */
export function normalizeComposeEmail(email: string): string {
  return email.trim().toLowerCase()
}

/**
 * Graph-Pfad fuer Mailbox-Operationen.
 * Primaeres Konto: `/me`; freigegebenes Postfach / Alias: `/users/{smtp}`.
 */
export function graphMailboxRoot(primaryEmail: string, sendFromEmail?: string | null): string {
  const primary = normalizeComposeEmail(primaryEmail)
  const from = sendFromEmail?.trim() ? normalizeComposeEmail(sendFromEmail) : primary
  if (!from || from === primary) return '/me'
  return `/users/${encodeURIComponent(sendFromEmail!.trim())}`
}
