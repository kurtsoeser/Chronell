/** Normalisiert Absender-E-Mail aus Mail-Feldern (`user@x.de` oder `Name <user@x.de>`). */
export function normalizeMailSenderEmail(raw: string | null | undefined): string | null {
  const t = raw?.trim()
  if (!t) return null
  const angle = /<([^>]+)>/.exec(t)
  if (angle) {
    const inner = angle[1]?.trim()
    return inner && inner.includes('@') ? inner.toLowerCase() : null
  }
  if (t.includes('@')) return t.toLowerCase()
  return null
}

/** Prüft, ob `emails_json` (People-Sync) die normalisierte Adresse enthält. */
export function contactEmailsJsonContains(
  emailsJson: string | null | undefined,
  normalizedEmail: string
): boolean {
  if (!emailsJson?.trim() || !normalizedEmail) return false
  try {
    const arr = JSON.parse(emailsJson) as unknown
    if (!Array.isArray(arr)) return false
    return arr.some((x) => {
      if (!x || typeof x !== 'object' || !('address' in x)) return false
      const address = (x as { address?: string }).address
      return typeof address === 'string' && address.trim().toLowerCase() === normalizedEmail
    })
  } catch {
    return false
  }
}
